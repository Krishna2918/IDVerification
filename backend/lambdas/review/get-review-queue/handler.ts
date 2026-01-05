import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const REVIEW_TABLE = process.env.REVIEW_TABLE!;

interface ReviewQueueItem {
  reviewId: string;
  sessionId: string;
  status: string;
  priority: string;
  reasons: string[];
  scores: {
    similarity: number;
    ocrConfidence: number;
  };
  createdAt: string;
  assignedTo?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  try {
    // Get query parameters
    const status = event.queryStringParameters?.status || 'pending';
    const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
    const lastKey = event.queryStringParameters?.lastKey;

    // Query reviews by status (using GSI)
    const queryParams: any = {
      TableName: REVIEW_TABLE,
      IndexName: 'status-priority-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
      Limit: limit,
      ScanIndexForward: false, // Most recent first
    };

    if (lastKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastKey, 'base64').toString());
    }

    const result = await docClient.send(new QueryCommand(queryParams));

    const reviews: ReviewQueueItem[] = (result.Items || []).map((item) => ({
      reviewId: item.reviewId,
      sessionId: item.sessionId,
      status: item.status,
      priority: item.priority,
      reasons: item.reasons,
      scores: item.scores,
      createdAt: item.createdAt,
      assignedTo: item.assignedTo,
    }));

    // Create pagination token
    let nextKey: string | undefined;
    if (result.LastEvaluatedKey) {
      nextKey = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }

    // Get counts for each status
    const stats = await getQueueStats();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reviews,
        nextKey,
        stats,
      }),
    };
  } catch (error) {
    console.error('Error getting review queue:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getQueueStats(): Promise<{
  pending: number;
  inProgress: number;
  completedToday: number;
}> {
  // In production, use atomic counters or pre-computed stats
  // This is a simplified version
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pendingResult, inProgressResult] = await Promise.all([
    docClient.send(
      new QueryCommand({
        TableName: REVIEW_TABLE,
        IndexName: 'status-priority-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'pending' },
        Select: 'COUNT',
      })
    ),
    docClient.send(
      new QueryCommand({
        TableName: REVIEW_TABLE,
        IndexName: 'status-priority-index',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': 'in_progress' },
        Select: 'COUNT',
      })
    ),
  ]);

  return {
    pending: pendingResult.Count || 0,
    inProgress: inProgressResult.Count || 0,
    completedToday: 0, // Would need additional query with date filter
  };
}
