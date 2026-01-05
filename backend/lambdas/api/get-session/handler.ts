import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
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

    const result = await docClient.send(
      new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Session not found' }),
      };
    }

    const session = result.Item;
    const attemptCount = session.attemptCount || 0;

    // Calculate if retry is allowed
    const canRetry =
      (session.status === 'completed' && session.decision === 'FAIL') ||
      session.status === 'liveness_failed';
    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - attemptCount);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        sessionId: session.sessionId,
        status: session.status,
        decision: session.decision || null,
        reason: session.decisionReason || null,
        canRetry: canRetry && attemptsRemaining > 0,
        attemptsRemaining,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        completedAt: session.completedAt || null,
      }),
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
