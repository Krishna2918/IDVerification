import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const sfnClient = new SFNClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN!;
const MAX_ATTEMPTS = 3;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session ID is required' }),
      };
    }

    // Get session
    const sessionResult = await docClient.send(
      new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
      })
    );

    if (!sessionResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    const session = sessionResult.Item;

    // Validate session is ready for verification
    if (session.status !== 'liveness_completed') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: `Cannot submit verification in current state: ${session.status}`,
          requiredState: 'liveness_completed'
        }),
      };
    }

    // Check attempt count
    const attemptCount = session.attemptCount || 0;
    if (attemptCount >= MAX_ATTEMPTS) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Maximum verification attempts exceeded',
          maxAttempts: MAX_ATTEMPTS
        }),
      };
    }

    // Verify required data is present
    if (!session.documentFront?.s3Key) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Document front image is required' }),
      };
    }

    if (!session.livenessSession?.result?.passed) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Liveness check must be passed before verification' }),
      };
    }

    // Update session status to processing
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET #status = :status, attemptCount = :count, processingStartedAt = :now, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'processing',
          ':count': attemptCount + 1,
          ':now': new Date().toISOString(),
        },
      })
    );

    // Start Step Functions execution
    const executionName = `verification-${sessionId}-${Date.now()}`;
    await sfnClient.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        name: executionName,
        input: JSON.stringify({
          sessionId,
          attemptNumber: attemptCount + 1,
          documentFrontKey: session.documentFront.s3Key,
          documentBackKey: session.documentBack?.s3Key || null,
          livenessReferenceKey: session.livenessSession.result.referenceImageKey,
          livenessConfidence: session.livenessSession.result.confidence,
        }),
      })
    );

    return {
      statusCode: 202,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Verification submitted successfully',
        sessionId,
        attemptNumber: attemptCount + 1,
        status: 'processing',
      }),
    };
  } catch (error) {
    console.error('Error submitting verification:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
