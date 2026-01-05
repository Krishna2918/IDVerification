import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { LambdaFunctions } from './compute-stack';

export interface OrchestrationStackProps extends cdk.StackProps {
  projectName: string;
  envConfig: EnvironmentConfig;
  lambdaFunctions: LambdaFunctions;
  reviewQueueTable: dynamodb.Table;
}

export class OrchestrationStack extends cdk.Stack {
  public readonly verificationStateMachine: sfn.StateMachine;
  public readonly reviewQueue: sqs.Queue;
  public readonly alertsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: OrchestrationStackProps) {
    super(scope, id, props);

    const { projectName, envConfig, lambdaFunctions } = props;
    const prefix = `${projectName}-${envConfig.name}`;

    // Create SQS Dead Letter Queue
    const deadLetterQueue = new sqs.Queue(this, 'ReviewDeadLetterQueue', {
      queueName: `${prefix}-review-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create SQS Review Queue
    this.reviewQueue = new sqs.Queue(this, 'ReviewQueue', {
      queueName: `${prefix}-review-queue`,
      visibilityTimeout: cdk.Duration.minutes(5),
      retentionPeriod: cdk.Duration.days(7),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Create SNS Topic for Alerts
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `${prefix}-alerts`,
      displayName: 'ID Verification Alerts',
    });

    // ==================== STEP FUNCTIONS STATE MACHINE ====================

    // Define task states
    const extractDocumentData = new tasks.LambdaInvoke(this, 'ExtractDocumentData', {
      lambdaFunction: lambdaFunctions.extractDocumentData,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const getLivenessResultTask = new tasks.LambdaInvoke(this, 'GetLivenessResult', {
      lambdaFunction: lambdaFunctions.getLivenessResult,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const compareFacesTask = new tasks.LambdaInvoke(this, 'CompareFaces', {
      lambdaFunction: lambdaFunctions.compareFaces,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const decisionEngineTask = new tasks.LambdaInvoke(this, 'DecisionEngine', {
      lambdaFunction: lambdaFunctions.decisionEngine,
      outputPath: '$.Payload',
      retryOnServiceExceptions: true,
    });

    const finalizePassTask = new tasks.LambdaInvoke(this, 'FinalizePass', {
      lambdaFunction: lambdaFunctions.finalizeVerification,
      payload: sfn.TaskInput.fromObject({
        sessionId: sfn.JsonPath.stringAt('$.sessionId'),
        decision: 'PASS',
        reason: sfn.JsonPath.stringAt('$.decisionResult.reason'),
        metadata: sfn.JsonPath.objectAt('$.decisionResult.metadata'),
      }),
      outputPath: '$.Payload',
    });

    const finalizeFailTask = new tasks.LambdaInvoke(this, 'FinalizeFail', {
      lambdaFunction: lambdaFunctions.finalizeVerification,
      payload: sfn.TaskInput.fromObject({
        sessionId: sfn.JsonPath.stringAt('$.sessionId'),
        decision: 'FAIL',
        reason: sfn.JsonPath.stringAt('$.decisionResult.reason'),
        metadata: sfn.JsonPath.objectAt('$.decisionResult.metadata'),
      }),
      outputPath: '$.Payload',
    });

    const queueForReviewTask = new tasks.LambdaInvoke(this, 'QueueForReview', {
      lambdaFunction: lambdaFunctions.queueForReview,
      outputPath: '$.Payload',
    });

    const auditLogSuccessTask = new tasks.LambdaInvoke(this, 'AuditLogSuccess', {
      lambdaFunction: lambdaFunctions.auditLogger,
      payload: sfn.TaskInput.fromObject({
        sessionId: sfn.JsonPath.stringAt('$.sessionId'),
        eventType: 'VERIFICATION_PASSED',
        details: sfn.JsonPath.objectAt('$'),
      }),
      outputPath: '$.Payload',
    });

    const auditLogFailureTask = new tasks.LambdaInvoke(this, 'AuditLogFailure', {
      lambdaFunction: lambdaFunctions.auditLogger,
      payload: sfn.TaskInput.fromObject({
        sessionId: sfn.JsonPath.stringAt('$.sessionId'),
        eventType: 'VERIFICATION_FAILED',
        details: sfn.JsonPath.objectAt('$'),
      }),
      outputPath: '$.Payload',
    });

    const auditLogReviewTask = new tasks.LambdaInvoke(this, 'AuditLogReview', {
      lambdaFunction: lambdaFunctions.auditLogger,
      payload: sfn.TaskInput.fromObject({
        sessionId: sfn.JsonPath.stringAt('$.sessionId'),
        eventType: 'QUEUED_FOR_REVIEW',
        details: sfn.JsonPath.objectAt('$'),
      }),
      outputPath: '$.Payload',
    });

    // Define end states
    const successEnd = new sfn.Succeed(this, 'VerificationSucceeded');
    const failEnd = new sfn.Succeed(this, 'VerificationFailed');
    const reviewEnd = new sfn.Succeed(this, 'QueuedForReview');

    // Parallel processing of document and liveness
    const parallelProcessing = new sfn.Parallel(this, 'ParallelProcessing', {
      resultPath: '$.parallelResults',
    });

    parallelProcessing.branch(extractDocumentData);
    parallelProcessing.branch(getLivenessResultTask);

    // Check liveness result
    const checkLiveness = new sfn.Choice(this, 'CheckLivenessPass')
      .when(
        sfn.Condition.booleanEquals('$.parallelResults[1].isLive', false),
        new tasks.LambdaInvoke(this, 'LivenessFailure', {
          lambdaFunction: lambdaFunctions.finalizeVerification,
          payload: sfn.TaskInput.fromObject({
            sessionId: sfn.JsonPath.stringAt('$.sessionId'),
            decision: 'FAIL',
            reason: 'LIVENESS_FAILED',
            metadata: {
              livenessConfidence: sfn.JsonPath.numberAt('$.parallelResults[1].confidence'),
            },
          }),
          outputPath: '$.Payload',
        }).next(auditLogFailureTask).next(failEnd)
      )
      .otherwise(new sfn.Pass(this, 'LivenessPass'));

    // Check document expiry
    const checkExpiry = new sfn.Choice(this, 'CheckDocumentExpiry')
      .when(
        sfn.Condition.booleanEquals('$.parallelResults[0].isExpired', true),
        new tasks.LambdaInvoke(this, 'ExpiredDocFailure', {
          lambdaFunction: lambdaFunctions.finalizeVerification,
          payload: sfn.TaskInput.fromObject({
            sessionId: sfn.JsonPath.stringAt('$.sessionId'),
            decision: 'FAIL',
            reason: 'DOCUMENT_EXPIRED',
            metadata: {
              expiryDate: sfn.JsonPath.stringAt('$.parallelResults[0].expiryDate'),
            },
          }),
          outputPath: '$.Payload',
        }).next(auditLogFailureTask).next(failEnd)
      )
      .otherwise(new sfn.Pass(this, 'DocumentValid'));

    // Route based on decision
    const routeByDecision = new sfn.Choice(this, 'RouteByDecision')
      .when(
        sfn.Condition.stringEquals('$.decisionResult.decision', 'PASS'),
        finalizePassTask.next(auditLogSuccessTask).next(successEnd)
      )
      .when(
        sfn.Condition.stringEquals('$.decisionResult.decision', 'FAIL'),
        finalizeFailTask.next(auditLogFailureTask).next(failEnd)
      )
      .otherwise(
        queueForReviewTask.next(auditLogReviewTask).next(reviewEnd)
      );

    // Build the workflow
    const definition = parallelProcessing
      .next(checkLiveness)
      .next(checkExpiry)
      .next(compareFacesTask)
      .next(decisionEngineTask)
      .next(routeByDecision);

    // Create the state machine
    const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/stepfunctions/${prefix}-verification-workflow`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: envConfig.isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    this.verificationStateMachine = new sfn.StateMachine(this, 'VerificationStateMachine', {
      stateMachineName: `${prefix}-verification-workflow`,
      definition,
      timeout: cdk.Duration.minutes(5),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    // Grant Step Functions permission to invoke Lambdas
    Object.values(lambdaFunctions).forEach((fn) => {
      if (fn) {
        fn.grantInvoke(this.verificationStateMachine);
      }
    });

    // Grant SQS permissions
    this.reviewQueue.grantSendMessages(lambdaFunctions.queueForReview);

    // Outputs
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.verificationStateMachine.stateMachineArn,
      description: 'Verification State Machine ARN',
      exportName: `${prefix}-state-machine-arn`,
    });

    new cdk.CfnOutput(this, 'ReviewQueueUrl', {
      value: this.reviewQueue.queueUrl,
      description: 'Review Queue URL',
      exportName: `${prefix}-review-queue-url`,
    });

    new cdk.CfnOutput(this, 'AlertsTopicArn', {
      value: this.alertsTopic.topicArn,
      description: 'Alerts SNS Topic ARN',
      exportName: `${prefix}-alerts-topic-arn`,
    });
  }
}
