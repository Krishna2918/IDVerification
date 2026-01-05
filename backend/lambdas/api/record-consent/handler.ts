import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const AUDIT_TABLE = process.env.AUDIT_TABLE!;

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

    // Verify session exists
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

    // Check session is in correct state
    if (session.status !== 'created') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Consent already recorded for this session` }),
      };
    }

    const now = new Date().toISOString();
    const ipAddress = event.requestContext.identity?.sourceIp || 'unknown';
    const userAgent = event.headers['User-Agent'] || 'unknown';

    // Update session with consent
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET #status = :status, consentGiven = :consent, consentAt = :now, consentIp = :ip, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'consent_given',
          ':consent': true,
          ':now': now,
          ':ip': ipAddress,
        },
      })
    );

    // Create audit log
    await docClient.send(
      new PutCommand({
        TableName: AUDIT_TABLE,
        Item: {
          pk: `SESSION#${sessionId}`,
          sk: `AUDIT#${now}#${randomUUID()}`,
          eventType: 'CONSENT_GIVEN',
          sessionId,
          actor: {
            type: 'user',
            ip: ipAddress,
          },
          action: 'CONSENT_ACCEPTED',
          details: {
            userAgent,
          },
          timestamp: now,
          ipAddress,
          userAgent,
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Consent recorded successfully',
        sessionId,
        status: 'consent_given',
      }),
    };
  } catch (error) {
    console.error('Error recording consent:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
