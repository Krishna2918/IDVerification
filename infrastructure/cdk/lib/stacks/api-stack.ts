import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';
import { LambdaFunctions } from './compute-stack';

export interface ApiStackProps extends cdk.StackProps {
  projectName: string;
  envConfig: EnvironmentConfig;
  lambdaFunctions: LambdaFunctions;
  userPool: cognito.UserPool;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { projectName, envConfig, lambdaFunctions, userPool } = props;
    const prefix = `${projectName}-${envConfig.name}`;

    // Create WAF Web ACL
    const webAcl = new wafv2.CfnWebACL(this, 'ApiWaf', {
      name: `${prefix}-api-waf`,
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${prefix}-api-waf`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rate limiting
        {
          name: 'RateLimitRule',
          priority: 1,
          action: { block: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
            sampledRequestsEnabled: true,
          },
          statement: {
            rateBasedStatement: {
              limit: 1000, // Requests per 5 minutes per IP
              aggregateKeyType: 'IP',
            },
          },
        },
        // AWS Managed Rules - Common Rule Set
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesCommonRuleSet',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
        },
        // AWS Managed Rules - Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 3,
          overrideAction: { none: {} },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
            sampledRequestsEnabled: true,
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
        },
        // AWS Managed Rules - Bot Control (optional, costs extra)
        // {
        //   name: 'AWSManagedRulesBotControlRuleSet',
        //   priority: 4,
        //   overrideAction: { none: {} },
        //   visibilityConfig: {
        //     cloudWatchMetricsEnabled: true,
        //     metricName: 'AWSManagedRulesBotControlRuleSet',
        //     sampledRequestsEnabled: true,
        //   },
        //   statement: {
        //     managedRuleGroupStatement: {
        //       vendorName: 'AWS',
        //       name: 'AWSManagedRulesBotControlRuleSet',
        //     },
        //   },
        // },
      ],
    });

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'VerificationApi', {
      restApiName: `${prefix}-verification-api`,
      description: 'Bank-grade ID Verification API',
      deployOptions: {
        stageName: envConfig.name,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: !envConfig.isProd,
        metricsEnabled: true,
        throttlingRateLimit: 100,
        throttlingBurstLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Associate WAF with API Gateway
    new wafv2.CfnWebACLAssociation(this, 'ApiWafAssociation', {
      resourceArn: this.api.deploymentStage.stageArn,
      webAclArn: webAcl.attrArn,
    });

    // Create Cognito Authorizer for admin endpoints
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: `${prefix}-cognito-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Helper to create Lambda integration
    const createIntegration = (fn: lambda.Function) => {
      return new apigateway.LambdaIntegration(fn, {
        proxy: true,
      });
    };

    // ==================== PUBLIC ENDPOINTS ====================
    // /v1/sessions
    const v1 = this.api.root.addResource('v1');
    const sessions = v1.addResource('sessions');

    // POST /v1/sessions - Create verification session
    sessions.addMethod('POST', createIntegration(lambdaFunctions.createSession), {
      apiKeyRequired: false,
    });

    // /v1/sessions/{sessionId}
    const session = sessions.addResource('{sessionId}');

    // GET /v1/sessions/{sessionId} - Get session status
    session.addMethod('GET', createIntegration(lambdaFunctions.getSessionStatus));

    // /v1/sessions/{sessionId}/document
    const document = session.addResource('document');

    // POST /v1/sessions/{sessionId}/document - Request upload URL
    document.addMethod('POST', createIntegration(lambdaFunctions.uploadDocument));

    // /v1/sessions/{sessionId}/document/confirm
    const documentConfirm = document.addResource('confirm');
    documentConfirm.addMethod('POST', createIntegration(lambdaFunctions.uploadDocument));

    // /v1/sessions/{sessionId}/liveness
    const liveness = session.addResource('liveness');

    // POST /v1/sessions/{sessionId}/liveness - Create liveness session
    liveness.addMethod('POST', createIntegration(lambdaFunctions.createLivenessSession));

    // /v1/sessions/{sessionId}/liveness/result
    const livenessResult = liveness.addResource('result');
    livenessResult.addMethod('GET', createIntegration(lambdaFunctions.getLivenessResult));

    // /v1/sessions/{sessionId}/verify
    const verify = session.addResource('verify');
    verify.addMethod('POST', createIntegration(lambdaFunctions.submitVerification));

    // ==================== ADMIN ENDPOINTS (Cognito Protected) ====================
    const admin = v1.addResource('admin');

    // /v1/admin/reviews
    const reviews = admin.addResource('reviews');

    // GET /v1/admin/reviews - Get review queue
    reviews.addMethod('GET', createIntegration(lambdaFunctions.getReviewQueue), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /v1/admin/reviews/{reviewId}
    const review = reviews.addResource('{reviewId}');

    // GET /v1/admin/reviews/{reviewId} - Get review details
    review.addMethod('GET', createIntegration(lambdaFunctions.getReviewItem), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /v1/admin/reviews/{reviewId}/assign
    const assignReview = review.addResource('assign');
    assignReview.addMethod('POST', createIntegration(lambdaFunctions.submitReviewDecision), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /v1/admin/reviews/{reviewId}/decision
    const reviewDecision = review.addResource('decision');
    reviewDecision.addMethod('POST', createIntegration(lambdaFunctions.submitReviewDecision), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /v1/admin/stats
    const stats = admin.addResource('stats');
    stats.addMethod('GET', createIntegration(lambdaFunctions.getReviewQueue), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${prefix}-api-url`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${prefix}-api-id`,
    });
  }
}
