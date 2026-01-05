import { Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog,
  AuditEventType,
  AuditEventCategory,
  AuditActorType,
  AuditResultStatus,
} from '../../../shared/src/types/audit';
import { OPERATIONAL_LIMITS } from '../../../shared/src/constants/thresholds';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUDIT_LOGS_TABLE = process.env.AUDIT_LOGS_TABLE!;

interface AuditLoggerInput {
  sessionId?: string;
  userId?: string;
  eventType: AuditEventType;
  eventCategory?: AuditEventCategory;
  actorType?: AuditActorType;
  actorId?: string;
  action?: string;
  details?: Record<string, unknown>;
  resultStatus?: AuditResultStatus;
  errorCode?: string;
  errorMessage?: string;
  dataAccessed?: string[];
  dataModified?: string[];
  requestId?: string;
  sourceService?: string;
}

interface AuditLoggerOutput {
  success: boolean;
  eventId: string;
  timestamp: string;
}

// Map event types to categories
const EVENT_CATEGORY_MAP: Record<AuditEventType, AuditEventCategory> = {
  SESSION_CREATED: 'VERIFICATION',
  CONSENT_GIVEN: 'VERIFICATION',
  DOCUMENT_UPLOADED: 'VERIFICATION',
  LIVENESS_STARTED: 'VERIFICATION',
  LIVENESS_COMPLETED: 'VERIFICATION',
  PROCESSING_STARTED: 'VERIFICATION',
  OCR_COMPLETED: 'VERIFICATION',
  FACE_COMPARISON_COMPLETED: 'VERIFICATION',
  DECISION_MADE: 'VERIFICATION',
  QUEUED_FOR_REVIEW: 'REVIEW',
  REVIEW_ASSIGNED: 'REVIEW',
  REVIEW_STARTED: 'REVIEW',
  REVIEW_COMPLETED: 'REVIEW',
  PII_ACCESSED: 'SECURITY',
  IMAGE_ACCESSED: 'SECURITY',
  VERIFICATION_PASSED: 'VERIFICATION',
  VERIFICATION_FAILED: 'VERIFICATION',
  SESSION_EXPIRED: 'SYSTEM',
  MAX_ATTEMPTS_REACHED: 'SECURITY',
  SUSPICIOUS_ACTIVITY: 'SECURITY',
  DATA_EXPORTED: 'ADMIN',
  DATA_DELETED: 'ADMIN',
};

// Map event types to human-readable actions
const EVENT_ACTION_MAP: Record<AuditEventType, string> = {
  SESSION_CREATED: 'Created verification session',
  CONSENT_GIVEN: 'User gave consent',
  DOCUMENT_UPLOADED: 'Document uploaded',
  LIVENESS_STARTED: 'Liveness check started',
  LIVENESS_COMPLETED: 'Liveness check completed',
  PROCESSING_STARTED: 'Verification processing started',
  OCR_COMPLETED: 'Document OCR completed',
  FACE_COMPARISON_COMPLETED: 'Face comparison completed',
  DECISION_MADE: 'Verification decision made',
  QUEUED_FOR_REVIEW: 'Queued for manual review',
  REVIEW_ASSIGNED: 'Review assigned to reviewer',
  REVIEW_STARTED: 'Review started',
  REVIEW_COMPLETED: 'Review completed',
  PII_ACCESSED: 'PII data accessed',
  IMAGE_ACCESSED: 'Image data accessed',
  VERIFICATION_PASSED: 'Verification passed',
  VERIFICATION_FAILED: 'Verification failed',
  SESSION_EXPIRED: 'Session expired',
  MAX_ATTEMPTS_REACHED: 'Maximum attempts reached',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity detected',
  DATA_EXPORTED: 'Data exported',
  DATA_DELETED: 'Data deleted',
};

export async function handler(event: AuditLoggerInput, context: Context): Promise<AuditLoggerOutput> {
  console.log('Audit logger input:', JSON.stringify(event, null, 2));

  const now = new Date();
  const eventId = uuidv4();

  // Determine partition key
  const pk = event.sessionId
    ? `SESSION#${event.sessionId}`
    : event.userId
    ? `USER#${event.userId}`
    : `SYSTEM#${now.toISOString().split('T')[0]}`;

  // Create sort key with timestamp and event ID
  const sk = `AUDIT#${now.toISOString()}#${eventId}`;

  // Calculate TTL (7 years)
  const expiresAt = Math.floor(
    (now.getTime() + OPERATIONAL_LIMITS.AUDIT_LOG_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000) / 1000
  );

  const auditLog: AuditLog = {
    pk,
    sk,
    eventId,
    eventType: event.eventType,
    eventCategory: event.eventCategory || EVENT_CATEGORY_MAP[event.eventType],
    timestamp: now.toISOString(),
    timestampEpoch: Math.floor(now.getTime() / 1000),
    actorType: event.actorType || 'SYSTEM',
    actorId: event.actorId,
    sessionId: event.sessionId,
    action: event.action || EVENT_ACTION_MAP[event.eventType],
    details: event.details || {},
    requestId: event.requestId || context.awsRequestId,
    sourceService: event.sourceService || context.functionName,
    dataAccessed: event.dataAccessed,
    dataModified: event.dataModified,
    resultStatus: event.resultStatus || 'SUCCESS',
    errorCode: event.errorCode,
    errorMessage: event.errorMessage,
    expiresAt,
  };

  // Write to DynamoDB
  await docClient.send(
    new PutCommand({
      TableName: AUDIT_LOGS_TABLE,
      Item: auditLog,
    })
  );

  console.log('Audit log created:', { pk, sk, eventType: event.eventType });

  return {
    success: true,
    eventId,
    timestamp: now.toISOString(),
  };
}
