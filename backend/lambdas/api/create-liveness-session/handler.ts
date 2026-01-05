import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RekognitionClient, CreateFaceLivenessSessionCommand } from '@aws-sdk/client-rekognition';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;

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

    // Verify session exists and has document uploaded
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

    // Validate session state
    if (session.status !== 'document_uploaded') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Cannot start liveness in current state: ${session.status}` }),
      };
    }

    // Check if document front is uploaded
    if (!session.documentFront?.s3Key) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Document front must be uploaded before liveness check' }),
      };
    }

    // Create Rekognition Face Liveness session
    const livenessCommand = new CreateFaceLivenessSessionCommand({
      Settings: {
        OutputConfig: {
          S3Bucket: process.env.DOCUMENTS_BUCKET!,
          S3KeyPrefix: `sessions/${sessionId}/liveness/`,
        },
        AuditImagesLimit: 4,
      },
      ClientRequestToken: `${sessionId}-${Date.now()}`,
    });

    const livenessResponse = await rekognitionClient.send(livenessCommand);
    const livenessSessionId = livenessResponse.SessionId;

    if (!livenessSessionId) {
      throw new Error('Failed to create liveness session');
    }

    // Update verification session with liveness session info
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET livenessSession = :ls, #status = :status, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':ls': {
            livenessSessionId,
            status: 'created',
            createdAt: new Date().toISOString(),
          },
          ':status': 'liveness_started',
          ':now': new Date().toISOString(),
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        livenessSessionId,
        region: process.env.AWS_REGION,
      }),
    };
  } catch (error) {
    console.error('Error creating liveness session:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
