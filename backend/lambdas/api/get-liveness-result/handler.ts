import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { RekognitionClient, GetFaceLivenessSessionResultsCommand } from '@aws-sdk/client-rekognition';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const rekognitionClient = new RekognitionClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const LIVENESS_MIN_CONFIDENCE = 90;

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

    // Get session to retrieve liveness session ID
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
    const livenessSessionId = session.livenessSession?.livenessSessionId;

    if (!livenessSessionId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No liveness session found for this verification' }),
      };
    }

    // Get liveness results from Rekognition
    const livenessCommand = new GetFaceLivenessSessionResultsCommand({
      SessionId: livenessSessionId,
    });

    const livenessResult = await rekognitionClient.send(livenessCommand);

    const confidence = livenessResult.Confidence || 0;
    const status = livenessResult.Status;
    const passed = status === 'SUCCEEDED' && confidence >= LIVENESS_MIN_CONFIDENCE;

    // Get reference image S3 location if available
    const referenceImage = livenessResult.ReferenceImage?.S3Object;

    // Update session with liveness results
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET livenessSession.#result = :result, livenessSession.#status = :livenessStatus, #sessionStatus = :sessionStatus, updatedAt = :now',
        ExpressionAttributeNames: {
          '#result': 'result',
          '#status': 'status',
          '#sessionStatus': 'status',
        },
        ExpressionAttributeValues: {
          ':result': {
            confidence,
            passed,
            referenceImageKey: referenceImage?.Name || null,
            completedAt: new Date().toISOString(),
          },
          ':livenessStatus': passed ? 'passed' : 'failed',
          ':sessionStatus': passed ? 'liveness_completed' : 'liveness_failed',
          ':now': new Date().toISOString(),
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: passed ? 'PASSED' : 'FAILED',
        confidence,
        message: passed
          ? 'Liveness check passed'
          : 'Liveness check failed. Please try again with better lighting.',
      }),
    };
  } catch (error) {
    console.error('Error getting liveness result:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
