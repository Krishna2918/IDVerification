import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BUCKET_NAME = process.env.DOCUMENTS_BUCKET!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;

interface UploadRequest {
  documentSide: 'front' | 'back';
  contentType: string;
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

    const body: UploadRequest = JSON.parse(event.body || '{}');
    const { documentSide, contentType } = body;

    if (!documentSide || !['front', 'back'].includes(documentSide)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid document side (front/back) is required' }),
      };
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!contentType || !allowedTypes.includes(contentType)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Content type must be image/jpeg, image/png, or application/pdf' }),
      };
    }

    // Verify session exists and is in correct state
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
    if (session.status !== 'consent_given' && session.status !== 'document_uploaded') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Cannot upload document in current state: ${session.status}` }),
      };
    }

    // Generate unique file key
    const fileExtension = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : 'jpg';
    const fileKey = `sessions/${sessionId}/documents/original/${documentSide}.${fileExtension}`;
    const uploadId = randomUUID();

    // Generate presigned URL for upload
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
      ContentType: contentType,
      Metadata: {
        sessionId,
        documentSide,
        uploadId,
      },
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    // Update session with pending upload info
    const documentField = documentSide === 'front' ? 'documentFront' : 'documentBack';
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: `SET ${documentField} = :doc, updatedAt = :now`,
        ExpressionAttributeValues: {
          ':doc': {
            uploadId,
            s3Key: fileKey,
            contentType,
            status: 'pending',
            uploadedAt: null,
          },
          ':now': new Date().toISOString(),
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        uploadUrl: presignedUrl,
        uploadId,
        fileKey,
        expiresIn: 300,
      }),
    };
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
