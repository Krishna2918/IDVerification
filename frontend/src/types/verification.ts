export type VerificationStatus =
  | 'created'
  | 'consent_given'
  | 'document_uploaded'
  | 'liveness_started'
  | 'liveness_completed'
  | 'liveness_failed'
  | 'processing'
  | 'pending_review'
  | 'completed';

export type VerificationDecision = 'PASS' | 'FAIL' | 'REVIEW';

export interface VerificationSession {
  sessionId: string;
  status: VerificationStatus;
  decision?: VerificationDecision;
  decisionReason?: string;
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  status: VerificationStatus;
  expiresAt: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  uploadId: string;
  fileKey: string;
  expiresIn: number;
}

export interface LivenessSessionResponse {
  livenessSessionId: string;
  region: string;
}

export interface LivenessResultResponse {
  status: 'PASSED' | 'FAILED';
  confidence: number;
  message: string;
}

export interface SubmitVerificationResponse {
  message: string;
  sessionId: string;
  attemptNumber: number;
  status: string;
}

export interface SessionStatusResponse {
  sessionId: string;
  status: VerificationStatus;
  decision?: VerificationDecision;
  reason?: string;
  canRetry: boolean;
  attemptsRemaining: number;
}
