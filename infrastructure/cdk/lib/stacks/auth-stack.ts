import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface AuthStackProps extends cdk.StackProps {
  projectName: string;
  envConfig: EnvironmentConfig;
}

export class AuthStack extends cdk.Stack {
  public readonly reviewerUserPool: cognito.UserPool;
  public readonly reviewerUserPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { projectName, envConfig } = props;
    const prefix = `${projectName}-${envConfig.name}`;

    // Cognito User Pool for Reviewers (Admin users)
    this.reviewerUserPool = new cognito.UserPool(this, 'ReviewerUserPool', {
      userPoolName: `${prefix}-reviewer-pool`,
      selfSignUpEnabled: false, // Admins create reviewer accounts
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        familyName: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({
          mutable: true,
          minLen: 1,
          maxLen: 50,
        }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: envConfig.isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
      userInvitation: {
        emailSubject: 'ID Verification System - Your Reviewer Account',
        emailBody: `Hello {username},

You have been invited to join the ID Verification Review team.

Your temporary password is: {####}

Please sign in at the admin portal and change your password.

This invitation expires in 7 days.

Best regards,
ID Verification Team`,
      },
      userVerification: {
        emailSubject: 'Verify your email for ID Verification System',
        emailBody: 'Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
    });

    // Add admin group
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.reviewerUserPool.userPoolId,
      groupName: 'admin',
      description: 'Administrators with full access',
      precedence: 0,
    });

    // Add reviewer group
    new cognito.CfnUserPoolGroup(this, 'ReviewerGroup', {
      userPoolId: this.reviewerUserPool.userPoolId,
      groupName: 'reviewer',
      description: 'Reviewers who can approve/reject verifications',
      precedence: 1,
    });

    // User Pool Client for Admin Dashboard
    this.reviewerUserPoolClient = this.reviewerUserPool.addClient('AdminDashboardClient', {
      userPoolClientName: `${prefix}-admin-dashboard`,
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: envConfig.isProd
          ? ['https://admin.yourdomain.com/callback']
          : ['http://localhost:3000/callback', 'http://localhost:5173/callback'],
        logoutUrls: envConfig.isProd
          ? ['https://admin.yourdomain.com']
          : ['http://localhost:3000', 'http://localhost:5173'],
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(7),
    });

    // Identity Pool for user sessions (end users doing verification)
    this.identityPool = new cognito.CfnIdentityPool(this, 'VerificationIdentityPool', {
      identityPoolName: `${prefix}_verification_identity`,
      allowUnauthenticatedIdentities: true, // End users don't need to authenticate
      allowClassicFlow: false,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.reviewerUserPool.userPoolId,
      description: 'Cognito User Pool ID for reviewers',
      exportName: `${prefix}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.reviewerUserPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${prefix}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, 'IdentityPoolId', {
      value: this.identityPool.ref,
      description: 'Cognito Identity Pool ID',
      exportName: `${prefix}-identity-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: this.reviewerUserPool.userPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${prefix}-user-pool-arn`,
    });
  }
}
