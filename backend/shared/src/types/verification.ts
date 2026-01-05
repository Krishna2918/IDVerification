/**
 * Verification Session Types
 */

export type VerificationStatus =
  | 'INITIATED'
  | 'DOCUMENT_UPLOADED'
  | 'LIVENESS_STARTED'
  | 'LIVENESS_COMPLETED'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'PASSED'
  | 'FAILED';

export type DecisionOutcome = 'PASS' | 'FAIL' | 'REVIEW';

export type ActorType = 'SYSTEM' | 'END_USER' | 'REVIEWER' | 'ADMIN';

export interface AttemptRecord {
  attemptNumber: number;
  startedAt: string;
  completedAt?: string;
  result?: DecisionOutcome;
  failureReason?: string;
}

export interface AuditEntry {
  timestamp: string;
  action: string;
  actor: ActorType;
  actorId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export interface DocumentInfo {
  s3Key: string;
  uploadedAt: string;
  documentType?: string;
  issuingCountry?: string;
}

export interface LivenessInfo {
  rekognitionSessionId: string;
  startedAt: string;
  completedAt?: string;
  selfieS3Key?: string;
}

export interface ExtractedData {
  encryptedPayload: string;
  dataKeyId: string;
  extractedAt: string;
}

export interface ProcessingResults {
  textractJobId?: string;
  ocrConfidence?: number;
  livenessConfidence?: number;
  faceSimilarity?: number;
  documentValid?: boolean;
  isExpired?: boolean;
  expiryDate?: string;
  allFieldsPresent?: boolean;
  missingFields?: string[];
}

export interface Decision {
  outcome: DecisionOutcome;
  reason: string;
  decidedAt: string;
  decidedBy: 'AUTOMATED' | 'MANUAL';
  reviewerId?: string;
}

export interface VerificationSession {
  // Primary Key
  sessionId: string;

  // Session Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt: number; // TTL epoch seconds
  status: VerificationStatus;

  // External Reference
  externalReferenceId?: string;
  callbackUrl?: string;

  // Consent
  consentGiven: boolean;
  consentTimestamp: string;
  consentIpAddress: string;
  userAgent: string;

  // Attempt Tracking
  attemptCount: number;
  attemptHistory: AttemptRecord[];

  // Document Information
  document?: DocumentInfo;

  // Liveness Information
  liveness?: LivenessInfo;

  // Extracted PII (Encrypted)
  extractedData?: ExtractedData;

  // Processing Results
  processingResults?: ProcessingResults;

  // Decision
  decision?: Decision;

  // Audit Trail
  auditTrail: AuditEntry[];
}

export interface CreateSessionRequest {
  consentGiven: boolean;
  consentTimestamp: string;
  externalReferenceId?: string;
  callbackUrl?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: VerificationStatus;
  expiresAt: string;
}

export interface SessionStatusResponse {
  sessionId: string;
  status: VerificationStatus;
  attemptCount: number;
  maxAttempts: number;
  decision?: {
    outcome: DecisionOutcome;
    reason: string;
    decidedAt: string;
  };
  createdAt: string;
  expiresAt: string;
}

export interface UploadDocumentRequest {
  contentType: 'image/jpeg' | 'image/png' | 'application/pdf';
  documentSide: 'front' | 'back';
  filename?: string;
}

export interface UploadDocumentResponse {
  uploadUrl: string;
  uploadFields: Record<string, string>;
  s3Key: string;
  expiresAt: string;
}

export interface LivenessSessionResponse {
  livenessSessionId: string;
  livenessToken?: string;
}

export interface LivenessResultResponse {
  isLive: boolean;
  confidence: number;
  referenceImageAvailable: boolean;
}

export interface SubmitVerificationResponse {
  executionArn: string;
  status: 'PROCESSING';
}
