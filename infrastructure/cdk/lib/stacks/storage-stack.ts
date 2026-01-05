import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { OPERATIONAL_LIMITS } from '../config/thresholds';

export interface StorageStackProps extends cdk.StackProps {
  projectName: string;
  envConfig: EnvironmentConfig;
  kmsKey: kms.Key;
}

export class StorageStack extends cdk.Stack {
  public readonly documentsBucket: s3.Bucket;
  public readonly sessionsTable: dynamodb.Table;
  public readonly reviewQueueTable: dynamodb.Table;
  public readonly auditLogsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    const { projectName, envConfig, kmsKey } = props;
    const prefix = `${projectName}-${envConfig.name}`;

    // S3 Bucket for documents (ID images, selfies, liveness frames)
    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `${prefix}-documents-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: envConfig.isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !envConfig.isProd,
      cors: [
        {
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Will be restricted in production
          exposedHeaders: ['ETag'],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          id: 'DeleteSessionImagesAfterRetention',
          prefix: 'sessions/',
          expiration: cdk.Duration.days(OPERATIONAL_LIMITS.IMAGE_RETENTION_DAYS),
          noncurrentVersionExpiration: cdk.Duration.days(7),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
        {
          id: 'DeleteReviewDataAfterRetention',
          prefix: 'review/',
          expiration: cdk.Duration.days(OPERATIONAL_LIMITS.IMAGE_RETENTION_DAYS),
        },
        {
          id: 'TransitionComplianceToGlacier',
          prefix: 'compliance/',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(OPERATIONAL_LIMITS.AUDIT_LOG_RETENTION_YEARS * 365),
        },
      ],
    });

    // DynamoDB Table: Verification Sessions
    this.sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: `${prefix}-verification-sessions`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: envConfig.isProd,
      removalPolicy: envConfig.isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiresAt',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI: Query by status and creation time
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: Query by external reference ID
    this.sessionsTable.addGlobalSecondaryIndex({
      indexName: 'externalReference-index',
      partitionKey: { name: 'externalReferenceId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // DynamoDB Table: Review Queue
    this.reviewQueueTable = new dynamodb.Table(this, 'ReviewQueueTable', {
      tableName: `${prefix}-review-queue`,
      partitionKey: { name: 'reviewId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: envConfig.isProd,
      removalPolicy: envConfig.isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'expiresAt',
    });

    // GSI: Query by status and priority
    this.reviewQueueTable.addGlobalSecondaryIndex({
      indexName: 'status-priority-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'priority', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: Query by assigned reviewer
    this.reviewQueueTable.addGlobalSecondaryIndex({
      indexName: 'assignedTo-status-index',
      partitionKey: { name: 'assignedTo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: Query by SLA deadline
    this.reviewQueueTable.addGlobalSecondaryIndex({
      indexName: 'slaDeadline-index',
      partitionKey: { name: 'slaDeadlineDate', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'slaDeadline', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.KEYS_ONLY,
    });

    // DynamoDB Table: Audit Logs
    this.auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: `${prefix}-audit-logs`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: true, // Always enable for audit logs
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Never delete audit logs
      timeToLiveAttribute: 'expiresAt',
    });

    // GSI: Query by event type and timestamp
    this.auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'eventType-timestamp-index',
      partitionKey: { name: 'eventType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI: Query by actor ID
    this.auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'actorId-timestamp-index',
      partitionKey: { name: 'actorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DocumentsBucketName', {
      value: this.documentsBucket.bucketName,
      description: 'S3 bucket for ID verification documents',
      exportName: `${prefix}-documents-bucket-name`,
    });

    new cdk.CfnOutput(this, 'SessionsTableName', {
      value: this.sessionsTable.tableName,
      description: 'DynamoDB table for verification sessions',
      exportName: `${prefix}-sessions-table-name`,
    });

    new cdk.CfnOutput(this, 'ReviewQueueTableName', {
      value: this.reviewQueueTable.tableName,
      description: 'DynamoDB table for review queue',
      exportName: `${prefix}-review-queue-table-name`,
    });

    new cdk.CfnOutput(this, 'AuditLogsTableName', {
      value: this.auditLogsTable.tableName,
      description: 'DynamoDB table for audit logs',
      exportName: `${prefix}-audit-logs-table-name`,
    });
  }
}
