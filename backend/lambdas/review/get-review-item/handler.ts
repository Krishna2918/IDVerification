import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const kmsClient = new KMSClient({ region: process.env.AWS_REGION });

const REVIEW_TABLE = process.env.REVIEW_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const BUCKET_NAME = process.env.DOCUMENTS_BUCKET!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  try {
    const reviewId = event.pathParameters?.reviewId;
    const reviewerEmail = event.requestContext.authorizer?.claims?.email || 'unknown';

    if (!reviewId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Review ID is required' }),
      };
    }

    // Get review item
    const reviewResult = await docClient.send(
      new GetCommand({
        TableName: REVIEW_TABLE,
        Key: { reviewId },
      })
    );

    if (!reviewResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Review not found' }),
      };
    }

    const review = reviewResult.Item;

    // Auto-assign if not already assigned
    if (!review.assignedTo) {
      await docClient.send(
        new UpdateCommand({
          TableName: REVIEW_TABLE,
          Key: { reviewId },
          UpdateExpression: 'SET assignedTo = :reviewer, assignedAt = :now, #status = :status, updatedAt = :now',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':reviewer': reviewerEmail,
            ':now': new Date().toISOString(),
            ':status': 'in_progress',
          },
          ConditionExpression: 'attribute_not_exists(assignedTo) OR assignedTo = :null',
          ExpressionAttributeValues: {
            ':reviewer': reviewerEmail,
            ':now': new Date().toISOString(),
            ':status': 'in_progress',
            ':null': null,
          },
        })
      );
      review.assignedTo = reviewerEmail;
      review.status = 'in_progress';
    }

    // Get session for encrypted PII
    const sessionResult = await docClient.send(
      new GetCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId: review.sessionId },
      })
    );

    const session = sessionResult.Item;

    // Decrypt PII for reviewer
    let decryptedPII = {};
    if (session?.encryptedPII) {
      decryptedPII = await decryptPII(session.encryptedPII);
    }

    // Generate presigned URLs for images
    const imageUrls: Record<string, string> = {};
    if (review.images) {
      for (const [key, s3Key] of Object.entries(review.images)) {
        if (s3Key) {
          const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key as string,
          });
          imageUrls[key] = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        }
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reviewId: review.reviewId,
        sessionId: review.sessionId,
        status: review.status,
        priority: review.priority,
        reasons: review.reasons,
        scores: review.scores,
        extractedData: {
          ...review.extractedData,
          ...decryptedPII, // Merge decrypted PII
        },
        images: imageUrls,
        createdAt: review.createdAt,
        assignedTo: review.assignedTo,
        assignedAt: review.assignedAt,
      }),
    };
  } catch (error) {
    console.error('Error getting review item:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function decryptPII(encryptedPII: string): Promise<Record<string, string>> {
  try {
    const ciphertext = Buffer.from(encryptedPII, 'base64');

    const command = new DecryptCommand({
      CiphertextBlob: ciphertext,
      EncryptionContext: {
        purpose: 'pii-storage',
      },
    });

    const result = await kmsClient.send(command);

    if (!result.Plaintext) {
      throw new Error('Failed to decrypt PII');
    }

    const plaintext = Buffer.from(result.Plaintext).toString('utf-8');
    return JSON.parse(plaintext);
  } catch (error) {
    console.error('Error decrypting PII:', error);
    return {};
  }
}
