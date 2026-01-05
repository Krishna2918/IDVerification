import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const REVIEW_TABLE = process.env.REVIEW_TABLE!;
const REVIEW_QUEUE_URL = process.env.REVIEW_QUEUE_URL!;

interface QueueInput {
  sessionId: string;
  reason: string;
  scores: {
    similarity: number;
    ocrConfidence: number;
    livenessConfidence: number;
  };
  qualityIssues: string[];
  extractedData: Record<string, any>;
  documentFrontKey: string;
  documentBackKey?: string;
  livenessReferenceKey: string;
}

interface QueueOutput {
  sessionId: string;
  reviewId: string;
  priority: 'high' | 'medium' | 'low';
  queuedAt: string;
}

export const handler = async (event: QueueInput): Promise<QueueOutput> => {
  const {
    sessionId,
    reason,
    scores,
    qualityIssues,
    extractedData,
    documentFrontKey,
    documentBackKey,
    livenessReferenceKey,
  } = event;

  console.log(`Queuing session ${sessionId} for review. Reason: ${reason}`);

  try {
    const reviewId = `REV-${randomUUID().slice(0, 8).toUpperCase()}`;
    const queuedAt = new Date().toISOString();

    // Determine priority based on scores and issues
    const priority = determinePriority(scores, qualityIssues);

    // Create review record
    const reviewItem = {
      reviewId,
      sessionId,
      status: 'pending',
      priority,
      reasons: [reason, ...qualityIssues.map(q => `QUALITY: ${q}`)],
      scores,
      extractedData: {
        documentType: extractedData.documentType,
        expiryDate: extractedData.expiryDate,
        issuingCountry: extractedData.issuingCountry,
      },
      images: {
        documentFront: documentFrontKey,
        documentBack: documentBackKey || null,
        selfie: livenessReferenceKey,
      },
      createdAt: queuedAt,
      updatedAt: queuedAt,
      assignedTo: null,
      assignedAt: null,
      decision: null,
      decisionNotes: null,
      decidedAt: null,
    };

    // Save review item to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: REVIEW_TABLE,
        Item: reviewItem,
      })
    );

    // Update session with review reference
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId },
        UpdateExpression: 'SET reviewId = :reviewId, updatedAt = :now',
        ExpressionAttributeValues: {
          ':reviewId': reviewId,
          ':now': queuedAt,
        },
      })
    );

    // Send message to SQS for real-time notifications
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: REVIEW_QUEUE_URL,
        MessageBody: JSON.stringify({
          reviewId,
          sessionId,
          priority,
          reason,
          queuedAt,
        }),
        MessageAttributes: {
          priority: {
            DataType: 'String',
            StringValue: priority,
          },
        },
        // Use priority for message grouping (FIFO queues)
        MessageGroupId: priority,
        MessageDeduplicationId: reviewId,
      })
    );

    return {
      sessionId,
      reviewId,
      priority,
      queuedAt,
    };
  } catch (error) {
    console.error('Error queuing for review:', error);
    throw error;
  }
};

function determinePriority(
  scores: { similarity: number; ocrConfidence: number },
  qualityIssues: string[]
): 'high' | 'medium' | 'low' {
  // High priority: borderline cases that need quick decision
  if (scores.similarity >= 85 && scores.similarity < 90) {
    return 'high'; // Close to auto-pass threshold
  }

  if (scores.similarity < 75) {
    return 'high'; // Close to auto-fail threshold
  }

  // Medium priority: quality issues but decent scores
  if (qualityIssues.length > 0 && scores.similarity >= 80) {
    return 'medium';
  }

  // Low priority: clear review cases with time
  return 'low';
}
