import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  CreateSessionRequest,
  CreateSessionResponse,
  VerificationSession,
} from '../../../shared/src/types/verification';
import {
  createSuccessResponse,
  createErrorResponse,
  AppError,
} from '../../../shared/src/utils/error-handler';
import { ERROR_CODES } from '../../../shared/src/constants/error-codes';
import { OPERATIONAL_LIMITS } from '../../../shared/src/constants/thresholds';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.SESSIONS_TABLE!;

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    if (!event.body) {
      throw new AppError(ERROR_CODES.INVALID_REQUEST, 'Request body is required');
    }

    const request: CreateSessionRequest = JSON.parse(event.body);

    // Validate consent
    if (!request.consentGiven) {
      throw new AppError(ERROR_CODES.CONSENT_NOT_GIVEN);
    }

    // Generate session ID and expiry
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OPERATIONAL_LIMITS.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Extract client info from request
    const ipAddress = event.requestContext.identity?.sourceIp || 'unknown';
    const userAgent = event.headers['User-Agent'] || event.headers['user-agent'] || 'unknown';

    // Create session record
    const session: VerificationSession = {
      sessionId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: Math.floor(expiresAt.getTime() / 1000), // TTL in seconds
      status: 'INITIATED',
      externalReferenceId: request.externalReferenceId,
      callbackUrl: request.callbackUrl,
      consentGiven: true,
      consentTimestamp: request.consentTimestamp || now.toISOString(),
      consentIpAddress: ipAddress,
      userAgent,
      attemptCount: 0,
      attemptHistory: [],
      auditTrail: [
        {
          timestamp: now.toISOString(),
          action: 'Session created',
          actor: 'SYSTEM',
          details: {
            externalReferenceId: request.externalReferenceId,
          },
          ipAddress,
        },
      ],
    };

    // Save to DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: SESSIONS_TABLE,
        Item: session,
        ConditionExpression: 'attribute_not_exists(sessionId)',
      })
    );

    // Return response
    const response: CreateSessionResponse = {
      sessionId,
      status: session.status,
      expiresAt: expiresAt.toISOString(),
    };

    return createSuccessResponse(response, 201);
  } catch (error) {
    console.error('Error creating session:', error);
    return createErrorResponse(error);
  }
}
