import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;

interface ConfirmRequest {
  uploadId: string;
  documentSide?: 'front' | 'back';
}

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

    const body: ConfirmRequest = JSON.parse(event.body || '{}');
    const { uploadId } = body;

    if (!uploadId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Upload ID is required' }),
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

    // Find which document matches the uploadId
    let documentSide: 'front' | 'back' | null = null;
    let s3Key: string | null = null;

    if (session.documentFront?.uploadId === uploadId) {
      documentSide = 'front';
      s3Key = session.documentFront.s3Key;
    } else if (session.documentBack?.uploadId === uploadId) {
      documentSide = 'back';
      s3Key = session.documentBack.s3Key;
    }

    if (!documentSide || !s3Key) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Upload ID not found in session' }),
      };
    }

    // Verify file exists in S3
    try {
      await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
        })
      );
    } catch (err: any) {
      if (err.name === 'NotFound') {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'File not found in storage. Please upload again.' }),
        };
      }
      throw err;
    }

    const now = new Date().toISOString();
    const documentField = documentSide === 'front' ? 'documentFront' : 'documentBack';

    // Update session with confirmed upload
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: `SET ${documentField}.#status = :status, ${documentField}.uploadedAt = :now, #sessionStatus = :sessionStatus, updatedAt = :now`,
        ExpressionAttributeNames: {
          '#status': 'status',
          '#sessionStatus': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'confirmed',
          ':now': now,
          ':sessionStatus': 'document_uploaded',
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Upload confirmed successfully',
        sessionId,
        documentSide,
        status: 'document_uploaded',
      }),
    };
  } catch (error) {
    console.error('Error confirming upload:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
