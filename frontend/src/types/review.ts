export type ReviewStatus = 'pending' | 'in_progress' | 'completed';
export type ReviewPriority = 'high' | 'medium' | 'low';
export type ReviewDecision = 'approve' | 'reject';

export interface ReviewQueueItem {
  reviewId: string;
  sessionId: string;
  status: ReviewStatus;
  priority: ReviewPriority;
  reasons: string[];
  scores: {
    similarity: number;
    ocrConfidence: number;
  };
  createdAt: string;
  assignedTo?: string;
}

export interface ReviewQueueResponse {
  reviews: ReviewQueueItem[];
  nextKey?: string;
  stats: {
    pending: number;
    inProgress: number;
    completedToday: number;
  };
}

export interface ReviewDetails {
  reviewId: string;
  sessionId: string;
  status: ReviewStatus;
  priority: ReviewPriority;
  reasons: string[];
  scores: {
    similarity: number;
    ocrConfidence: number;
    livenessConfidence: number;
  };
  extractedData: {
    documentType?: string;
    documentNumber?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    expiryDate?: string;
    issuingCountry?: string;
  };
  images: {
    documentFront?: string;
    documentBack?: string;
    selfie?: string;
  };
  createdAt: string;
  assignedTo?: string;
  assignedAt?: string;
}

export interface ReviewDecisionRequest {
  decision: ReviewDecision;
  reason?: string;
  notes?: string;
}

export interface ReviewDecisionResponse {
  message: string;
  reviewId: string;
  sessionId: string;
  decision: string;
  decidedAt: string;
}
