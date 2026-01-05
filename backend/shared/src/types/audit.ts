/**
 * Audit Log Types
 */

export type AuditEventType =
  | 'SESSION_CREATED'
  | 'CONSENT_GIVEN'
  | 'DOCUMENT_UPLOADED'
  | 'LIVENESS_STARTED'
  | 'LIVENESS_COMPLETED'
  | 'PROCESSING_STARTED'
  | 'OCR_COMPLETED'
  | 'FACE_COMPARISON_COMPLETED'
  | 'DECISION_MADE'
  | 'QUEUED_FOR_REVIEW'
  | 'REVIEW_ASSIGNED'
  | 'REVIEW_STARTED'
  | 'REVIEW_COMPLETED'
  | 'PII_ACCESSED'
  | 'IMAGE_ACCESSED'
  | 'VERIFICATION_PASSED'
  | 'VERIFICATION_FAILED'
  | 'SESSION_EXPIRED'
  | 'MAX_ATTEMPTS_REACHED'
  | 'SUSPICIOUS_ACTIVITY'
  | 'DATA_EXPORTED'
  | 'DATA_DELETED';

export type AuditEventCategory =
  | 'VERIFICATION'
  | 'REVIEW'
  | 'ADMIN'
  | 'SECURITY'
  | 'SYSTEM';

export type AuditActorType = 'SYSTEM' | 'END_USER' | 'REVIEWER' | 'ADMIN';

export type AuditResultStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export interface AuditLog {
  // Primary Key
  pk: string; // SESSION#{sessionId} or USER#{userId}
  sk: string; // AUDIT#{ISO timestamp}#{eventId}

  // Event Identification
  eventId: string;
  eventType: AuditEventType;
  eventCategory: AuditEventCategory;

  // Timestamp
  timestamp: string;
  timestampEpoch: number;

  // Actor Information
  actorType: AuditActorType;
  actorId?: string;
  actorIpAddress?: string;
  actorUserAgent?: string;

  // Session Reference
  sessionId?: string;

  // Event Details
  action: string;
  details: Record<string, unknown>;

  // Request Context
  requestId?: string;
  sourceService?: string;

  // Compliance
  dataAccessed?: string[];
  dataModified?: string[];

  // Result
  resultStatus: AuditResultStatus;
  errorCode?: string;
  errorMessage?: string;

  // TTL (7 years)
  expiresAt: number;
}

export interface CreateAuditLogRequest {
  sessionId?: string;
  eventType: AuditEventType;
  eventCategory?: AuditEventCategory;
  actorType?: AuditActorType;
  actorId?: string;
  action: string;
  details?: Record<string, unknown>;
  resultStatus?: AuditResultStatus;
  errorCode?: string;
  errorMessage?: string;
  dataAccessed?: string[];
  dataModified?: string[];
}

export interface GetAuditLogsRequest {
  sessionId?: string;
  eventType?: AuditEventType;
  startDate?: string;
  endDate?: string;
  limit?: number;
  nextToken?: string;
}

export interface GetAuditLogsResponse {
  items: AuditLog[];
  nextToken?: string;
}
