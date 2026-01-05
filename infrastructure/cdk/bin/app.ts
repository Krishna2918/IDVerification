#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from '../lib/stacks/foundation-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { ComputeStack } from '../lib/stacks/compute-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { OrchestrationStack } from '../lib/stacks/orchestration-stack';
import { getEnvironmentConfig } from '../lib/config/environments';

const app = new cdk.App();

// Get environment from context
const envName = app.node.tryGetContext('environment') || 'development';
const envConfig = getEnvironmentConfig(envName);
const projectName = app.node.tryGetContext('projectName') || 'idv';

// Stack naming convention: {project}-{stack}-{env}
const stackPrefix = `${projectName}-${envConfig.name}`;

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: envConfig.region,
};

// 1. Foundation Stack (KMS keys, core security)
const foundationStack = new FoundationStack(app, `${stackPrefix}-foundation`, {
  env,
  projectName,
  envConfig,
  description: 'ID Verification - Foundation (KMS, Security)',
});

// 2. Storage Stack (S3, DynamoDB)
const storageStack = new StorageStack(app, `${stackPrefix}-storage`, {
  env,
  projectName,
  envConfig,
  kmsKey: foundationStack.kmsKey,
  description: 'ID Verification - Storage (S3, DynamoDB)',
});
storageStack.addDependency(foundationStack);

// 3. Auth Stack (Cognito)
const authStack = new AuthStack(app, `${stackPrefix}-auth`, {
  env,
  projectName,
  envConfig,
  description: 'ID Verification - Authentication (Cognito)',
});

// 4. Compute Stack (Lambda functions)
const computeStack = new ComputeStack(app, `${stackPrefix}-compute`, {
  env,
  projectName,
  envConfig,
  kmsKey: foundationStack.kmsKey,
  documentsBucket: storageStack.documentsBucket,
  sessionsTable: storageStack.sessionsTable,
  reviewQueueTable: storageStack.reviewQueueTable,
  auditLogsTable: storageStack.auditLogsTable,
  description: 'ID Verification - Compute (Lambda)',
});
computeStack.addDependency(storageStack);

// 5. API Stack (API Gateway, WAF)
const apiStack = new ApiStack(app, `${stackPrefix}-api`, {
  env,
  projectName,
  envConfig,
  lambdaFunctions: computeStack.lambdaFunctions,
  userPool: authStack.reviewerUserPool,
  description: 'ID Verification - API (API Gateway, WAF)',
});
apiStack.addDependency(computeStack);
apiStack.addDependency(authStack);

// 6. Orchestration Stack (Step Functions, SQS)
const orchestrationStack = new OrchestrationStack(app, `${stackPrefix}-orchestration`, {
  env,
  projectName,
  envConfig,
  lambdaFunctions: computeStack.lambdaFunctions,
  reviewQueueTable: storageStack.reviewQueueTable,
  description: 'ID Verification - Orchestration (Step Functions, SQS)',
});
orchestrationStack.addDependency(computeStack);

// Add tags to all stacks
const stacks = [
  foundationStack,
  storageStack,
  authStack,
  computeStack,
  apiStack,
  orchestrationStack,
];

stacks.forEach(stack => {
  cdk.Tags.of(stack).add('Project', projectName);
  cdk.Tags.of(stack).add('Environment', envConfig.name);
  cdk.Tags.of(stack).add('ManagedBy', 'CDK');
});

app.synth();
