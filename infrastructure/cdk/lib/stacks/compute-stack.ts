import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import * as path from 'path';

export interface ComputeStackProps extends cdk.StackProps {
  projectName: string;
  envConfig: EnvironmentConfig;
  kmsKey: kms.Key;
  documentsBucket: s3.Bucket;
  sessionsTable: dynamodb.Table;
  reviewQueueTable: dynamodb.Table;
  auditLogsTable: dynamodb.Table;
}

export interface LambdaFunctions {
  createSession: lambda.Function;
  getSession: lambda.Function;
  recordConsent: lambda.Function;
  uploadDocument: lambda.Function;
  confirmUpload: lambda.Function;
  createLivenessSession: lambda.Function;
  getLivenessResult: lambda.Function;
  submitVerification: lambda.Function;
  extractDocumentData: lambda.Function;
  compareFaces: lambda.Function;
  decisionEngine: lambda.Function;
  finalizeVerification: lambda.Function;
  queueForReview: lambda.Function;
  getReviewQueue: lambda.Function;
  getReviewItem: lambda.Function;
  submitReviewDecision: lambda.Function;
  auditLogger: lambda.Function;
}

export class ComputeStack extends cdk.Stack {
  public readonly lambdaFunctions: LambdaFunctions;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const { projectName, envConfig, kmsKey, documentsBucket, sessionsTable, reviewQueueTable, auditLogsTable } = props;
    const prefix = `${projectName}-${envConfig.name}`;

    // Common environment variables for all Lambdas
    const commonEnvVars = {
      ENVIRONMENT: envConfig.name,
      DOCUMENTS_BUCKET: documentsBucket.bucketName,
      SESSIONS_TABLE: sessionsTable.tableName,
      REVIEW_QUEUE_TABLE: reviewQueueTable.tableName,
      AUDIT_LOGS_TABLE: auditLogsTable.tableName,
      KMS_KEY_ID: kmsKey.keyId,
      REGION: props.env?.region || 'ca-central-1',
    };

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
      environment: commonEnvVars,
    };

    // Create base IAM role for API Lambdas
    const apiLambdaRole = new iam.Role(this, 'ApiLambdaRole', {
      roleName: `${prefix}-api-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Add permissions for API Lambdas
    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query'],
      resources: [
        sessionsTable.tableArn,
        `${sessionsTable.tableArn}/index/*`,
      ],
    }));

    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:GetObject'],
      resources: [`${documentsBucket.bucketArn}/*`],
    }));

    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
      resources: [kmsKey.keyArn],
    }));

    apiLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['rekognition:CreateFaceLivenessSession', 'rekognition:GetFaceLivenessSessionResults'],
      resources: ['*'],
    }));

    // Create base IAM role for Processing Lambdas
    const processingLambdaRole = new iam.Role(this, 'ProcessingLambdaRole', {
      roleName: `${prefix}-processing-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayDaemonWriteAccess'),
      ],
    });

    // Add permissions for Processing Lambdas
    processingLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem', 'dynamodb:Query', 'dynamodb:BatchWriteItem'],
      resources: [
        sessionsTable.tableArn,
        `${sessionsTable.tableArn}/index/*`,
        reviewQueueTable.tableArn,
        `${reviewQueueTable.tableArn}/index/*`,
        auditLogsTable.tableArn,
        `${auditLogsTable.tableArn}/index/*`,
      ],
    }));

    processingLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`${documentsBucket.bucketArn}/*`],
    }));

    processingLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey', 'kms:DescribeKey'],
      resources: [kmsKey.keyArn],
    }));

    processingLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['textract:AnalyzeID', 'textract:DetectDocumentText'],
      resources: ['*'],
    }));

    processingLambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['rekognition:CompareFaces', 'rekognition:DetectFaces', 'rekognition:GetFaceLivenessSessionResults'],
      resources: ['*'],
    }));

    // Helper function to create Lambda
    const createLambda = (
      name: string,
      handlerPath: string,
      role: iam.Role,
      options: Partial<lambda.FunctionProps> = {}
    ): lambda.Function => {
      return new lambda.Function(this, name, {
        ...commonLambdaProps,
        functionName: `${prefix}-${name.toLowerCase().replace(/([A-Z])/g, '-$1').replace(/^-/, '')}`,
        handler: 'handler.handler',
        code: lambda.Code.fromAsset(handlerPath),
        role,
        ...options,
      });
    };

    // Base path for Lambda code
    const lambdaBasePath = path.join(__dirname, '../../../../backend/lambdas');

    // API Lambda Functions
    this.lambdaFunctions = {
      // Session Management
      createSession: createLambda(
        'CreateSession',
        path.join(lambdaBasePath, 'api/create-session'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),

      getSession: createLambda(
        'GetSession',
        path.join(lambdaBasePath, 'api/get-session'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(5) }
      ),

      recordConsent: createLambda(
        'RecordConsent',
        path.join(lambdaBasePath, 'api/record-consent'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),

      uploadDocument: createLambda(
        'UploadDocument',
        path.join(lambdaBasePath, 'api/upload-document'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),

      confirmUpload: createLambda(
        'ConfirmUpload',
        path.join(lambdaBasePath, 'api/confirm-upload'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),

      // Liveness
      createLivenessSession: createLambda(
        'CreateLivenessSession',
        path.join(lambdaBasePath, 'api/create-liveness-session'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(15) }
      ),

      getLivenessResult: createLambda(
        'GetLivenessResult',
        path.join(lambdaBasePath, 'api/get-liveness-result'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),

      submitVerification: createLambda(
        'SubmitVerification',
        path.join(lambdaBasePath, 'api/submit-verification'),
        apiLambdaRole,
        { timeout: cdk.Duration.seconds(15) }
      ),

      // Processing Functions
      extractDocumentData: createLambda(
        'ExtractDocumentData',
        path.join(lambdaBasePath, 'processing/extract-document-data'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(60), memorySize: 512 }
      ),

      compareFaces: createLambda(
        'CompareFaces',
        path.join(lambdaBasePath, 'processing/compare-faces'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(30), memorySize: 512 }
      ),

      decisionEngine: createLambda(
        'DecisionEngine',
        path.join(lambdaBasePath, 'processing/decision-engine'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(15) }
      ),

      finalizeVerification: createLambda(
        'FinalizeVerification',
        path.join(lambdaBasePath, 'processing/finalize-verification'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(15) }
      ),

      // Review Functions
      queueForReview: createLambda(
        'QueueForReview',
        path.join(lambdaBasePath, 'processing/queue-for-review'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(15) }
      ),

      getReviewQueue: createLambda(
        'GetReviewQueue',
        path.join(lambdaBasePath, 'review/get-review-queue'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),

      getReviewItem: createLambda(
        'GetReviewItem',
        path.join(lambdaBasePath, 'review/get-review-item'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(15), memorySize: 512 }
      ),

      submitReviewDecision: createLambda(
        'SubmitReviewDecision',
        path.join(lambdaBasePath, 'review/submit-review-decision'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(15) }
      ),

      // Audit
      auditLogger: createLambda(
        'AuditLogger',
        path.join(lambdaBasePath, 'audit/audit-logger'),
        processingLambdaRole,
        { timeout: cdk.Duration.seconds(10) }
      ),
    };
  }
}
