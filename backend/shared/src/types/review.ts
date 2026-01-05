/**
 * Review Queue Types
 */

export type ReviewStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ESCALATED';
export type ReviewPriority = 'HIGH' | 'NORMAL' | 'LOW';
export type ReviewDecisionOutcome = 'APPROVE' | 'REJECT';
export type ReviewReasonSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ReviewReason {
  code: string;
  description: string;
  severity: ReviewReasonSeverity;
  relatedScore?: number;
}

export interface ReviewScores {
  ocrConfidence: number;
  livenessConfidence: number;
  faceSimilarity: number;
}

export interface DocumentSnapshot {
  documentType: string;
  issuingCountry: string;
  expiryStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';
}

export interface ImageReferences {
  documentImageKey: string;
  selfieImageKey: string;
  documentFaceKey?: string;
}

export interface ReviewDecision {
  outcome: ReviewDecisionOutcome;
  reason: string;
  notes?: string;
  decidedAt: string;
  decidedBy: string;
}

export interface ReviewQueueItem {
  // Primary Key
  reviewId: string;

  // Reference
  sessionId: string;

  // Queue Metadata
  queuedAt: string;
  slaDeadline: string;
  slaDeadlineDate: string; // For GSI partition key
  priority: ReviewPriority;
  status: ReviewStatus;

  // Assignment
  assignedTo?: string;
  assignedAt?: string;

  // Review Reasons
  reviewReasons: ReviewReason[];

  // Scores
  scores: ReviewScores;

  // Document Reference
  documentSnapshot: DocumentSnapshot;

  // S3 Keys
  imageReferences: ImageReferences;

  // Review Decision
  reviewDecision?: ReviewDecision;

  // SLA Tracking
  slaBreached: boolean;

  // TTL
  expiresAt: number;
}

export interface GetReviewQueueRequest {
  status?: ReviewStatus;
  priority?: ReviewPriority;
  assignedTo?: string;
  limit?: number;
  nextToken?: string;
}

export interface GetReviewQueueResponse {
  items: ReviewQueueItem[];
  nextToken?: string;
  totalCount: number;
}

export interface ReviewItemDetail extends ReviewQueueItem {
  documentImageUrl: string;
  selfieImageUrl: string;
  documentFaceUrl?: string;
  extractedData: Record<string, string>;
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string;
    details?: string;
  }>;
}

export interface SubmitReviewDecisionRequest {
  decision: ReviewDecisionOutcome;
  reason: string;
  notes?: string;
}

export interface AssignReviewRequest {
  reviewerId: string;
}

export interface DashboardStats {
  pendingReviews: number;
  assignedToMe: number;
  completedToday: number;
  passRate: number;
  averageReviewTime: number;
  slaBreachCount: number;
}
