import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const REVIEW_TABLE = process.env.REVIEW_TABLE!;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;
const AUDIT_TABLE = process.env.AUDIT_TABLE!;

interface DecisionRequest {
  decision: 'approve' | 'reject';
  reason?: string;
  notes?: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };

  try {
    const reviewId = event.pathParameters?.reviewId;
    const reviewerEmail = event.requestContext.authorizer?.claims?.email || 'unknown';
    const reviewerSub = event.requestContext.authorizer?.claims?.sub || 'unknown';

    if (!reviewId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Review ID is required' }),
      };
    }

    const body: DecisionRequest = JSON.parse(event.body || '{}');
    const { decision, reason, notes } = body;

    if (!decision || !['approve', 'reject'].includes(decision)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Valid decision (approve/reject) is required' }),
      };
    }

    if (decision === 'reject' && !reason) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Rejection reason is required' }),
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

    // Verify reviewer is assigned
    if (review.assignedTo !== reviewerEmail) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'You are not assigned to this review' }),
      };
    }

    // Check review is still in progress
    if (review.status !== 'in_progress') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Review is not in progress. Current status: ${review.status}` }),
      };
    }

    const decidedAt = new Date().toISOString();
    const finalDecision = decision === 'approve' ? 'PASS' : 'FAIL';
    const finalReason = decision === 'approve' ? 'MANUAL_APPROVAL' : reason;

    // Update review record
    await docClient.send(
      new UpdateCommand({
        TableName: REVIEW_TABLE,
        Key: { reviewId },
        UpdateExpression: `
          SET #status = :status,
              decision = :decision,
              decisionReason = :reason,
              decisionNotes = :notes,
              decidedBy = :reviewer,
              decidedAt = :decidedAt,
              updatedAt = :decidedAt
        `,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':decision': finalDecision,
          ':reason': finalReason,
          ':notes': notes || null,
          ':reviewer': reviewerEmail,
          ':decidedAt': decidedAt,
        },
      })
    );

    // Update session with final decision
    await docClient.send(
      new UpdateCommand({
        TableName: SESSIONS_TABLE,
        Key: { sessionId: review.sessionId },
        UpdateExpression: `
          SET #status = :status,
              decision = :decision,
              decisionReason = :reason,
              reviewDecision = :reviewDecision,
              completedAt = :completedAt,
              updatedAt = :updatedAt
        `,
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':decision': finalDecision,
          ':reason': finalReason,
          ':reviewDecision': {
            reviewId,
            decision: finalDecision,
            reason: finalReason,
            notes: notes || null,
            reviewer: reviewerEmail,
            decidedAt,
          },
          ':completedAt': decidedAt,
          ':updatedAt': decidedAt,
        },
      })
    );

    // Create audit log entry
    await docClient.send(
      new PutCommand({
        TableName: AUDIT_TABLE,
        Item: {
          pk: `SESSION#${review.sessionId}`,
          sk: `AUDIT#${decidedAt}#${randomUUID()}`,
          eventType: 'REVIEW_DECISION',
          sessionId: review.sessionId,
          reviewId,
          actor: {
            type: 'reviewer',
            id: reviewerSub,
            email: reviewerEmail,
          },
          action: decision === 'approve' ? 'APPROVED' : 'REJECTED',
          details: {
            decision: finalDecision,
            reason: finalReason,
            notes: notes ? '[REDACTED]' : null, // Don't log full notes in audit
          },
          timestamp: decidedAt,
          ipAddress: event.requestContext.identity?.sourceIp || 'unknown',
          userAgent: event.headers['User-Agent'] || 'unknown',
        },
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Decision submitted successfully',
        reviewId,
        sessionId: review.sessionId,
        decision: finalDecision,
        decidedAt,
      }),
    };
  } catch (error) {
    console.error('Error submitting review decision:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
