import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface FoundationStackProps extends cdk.StackProps {
  projectName: string;
  envConfig: EnvironmentConfig;
}

export class FoundationStack extends cdk.Stack {
  public readonly kmsKey: kms.Key;

  constructor(scope: Construct, id: string, props: FoundationStackProps) {
    super(scope, id, props);

    const { projectName, envConfig } = props;

    // Customer-managed KMS key for encrypting all data
    this.kmsKey = new kms.Key(this, 'DocumentsEncryptionKey', {
      alias: `${projectName}-${envConfig.name}-documents-key`,
      description: 'KMS key for encrypting ID verification documents and PII',
      enableKeyRotation: true,
      pendingWindow: cdk.Duration.days(7),
      removalPolicy: envConfig.isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      policy: new iam.PolicyDocument({
        statements: [
          // Allow root account full access
          new iam.PolicyStatement({
            sid: 'EnableRootPermissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // Allow CloudWatch Logs to use the key
          new iam.PolicyStatement({
            sid: 'AllowCloudWatchLogs',
            effect: iam.Effect.ALLOW,
            principals: [
              new iam.ServicePrincipal(`logs.${props.env?.region || 'ca-central-1'}.amazonaws.com`),
            ],
            actions: [
              'kms:Encrypt*',
              'kms:Decrypt*',
              'kms:ReEncrypt*',
              'kms:GenerateDataKey*',
              'kms:Describe*',
            ],
            resources: ['*'],
            conditions: {
              ArnLike: {
                'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${props.env?.region || 'ca-central-1'}:${props.env?.account}:*`,
              },
            },
          }),
        ],
      }),
    });

    // Outputs
    new cdk.CfnOutput(this, 'KmsKeyArn', {
      value: this.kmsKey.keyArn,
      description: 'KMS Key ARN for document encryption',
      exportName: `${projectName}-${envConfig.name}-kms-key-arn`,
    });

    new cdk.CfnOutput(this, 'KmsKeyId', {
      value: this.kmsKey.keyId,
      description: 'KMS Key ID',
      exportName: `${projectName}-${envConfig.name}-kms-key-id`,
    });
  }
}
