import type {
  CreateSessionResponse,
  UploadUrlResponse,
  LivenessSessionResponse,
  LivenessResultResponse,
  SubmitVerificationResponse,
  SessionStatusResponse,
} from '../types/verification';

import type {
  ReviewQueueResponse,
  ReviewDetails,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
} from '../types/review';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add auth token if available
  const authToken = localStorage.getItem('authToken');
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      errorData.error || `Request failed with status ${response.status}`
    );
  }

  return response.json();
}

// ============ Verification API ============

export const verificationApi = {
  /**
   * Create a new verification session
   */
  createSession: async (): Promise<CreateSessionResponse> => {
    return fetchApi<CreateSessionResponse>('/sessions', {
      method: 'POST',
    });
  },

  /**
   * Get session status
   */
  getSessionStatus: async (sessionId: string): Promise<SessionStatusResponse> => {
    return fetchApi<SessionStatusResponse>(`/sessions/${sessionId}`);
  },

  /**
   * Record consent given
   */
  recordConsent: async (sessionId: string): Promise<void> => {
    await fetchApi(`/sessions/${sessionId}/consent`, {
      method: 'POST',
    });
  },

  /**
   * Get presigned URL for document upload
   */
  getUploadUrl: async (
    sessionId: string,
    documentSide: 'front' | 'back',
    contentType: string
  ): Promise<UploadUrlResponse> => {
    return fetchApi<UploadUrlResponse>(`/sessions/${sessionId}/document`, {
      method: 'POST',
      body: JSON.stringify({ documentSide, contentType }),
    });
  },

  /**
   * Upload document to S3 using presigned URL
   */
  uploadDocument: async (uploadUrl: string, file: Blob): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, 'Failed to upload document');
    }
  },

  /**
   * Confirm document upload complete
   */
  confirmUpload: async (sessionId: string, uploadId: string): Promise<void> => {
    await fetchApi(`/sessions/${sessionId}/document/confirm`, {
      method: 'POST',
      body: JSON.stringify({ uploadId }),
    });
  },

  /**
   * Create liveness session
   */
  createLivenessSession: async (sessionId: string): Promise<LivenessSessionResponse> => {
    return fetchApi<LivenessSessionResponse>(`/sessions/${sessionId}/liveness`, {
      method: 'POST',
    });
  },

  /**
   * Get liveness result
   */
  getLivenessResult: async (sessionId: string): Promise<LivenessResultResponse> => {
    return fetchApi<LivenessResultResponse>(`/sessions/${sessionId}/liveness/result`);
  },

  /**
   * Submit verification for processing
   */
  submitVerification: async (sessionId: string): Promise<SubmitVerificationResponse> => {
    return fetchApi<SubmitVerificationResponse>(`/sessions/${sessionId}/verify`, {
      method: 'POST',
    });
  },

  /**
   * Poll for verification result
   */
  pollForResult: async (
    sessionId: string,
    maxAttempts = 30,
    intervalMs = 2000
  ): Promise<SessionStatusResponse> => {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await verificationApi.getSessionStatus(sessionId);

      if (status.status === 'completed' || status.status === 'pending_review') {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Verification timed out');
  },
};

// ============ Admin/Review API ============

export const adminApi = {
  /**
   * Get review queue
   */
  getReviewQueue: async (
    status: 'pending' | 'in_progress' | 'all' = 'pending',
    limit = 50,
    lastKey?: string
  ): Promise<{ items: ReviewQueueResponse['reviews']; nextKey?: string }> => {
    const params = new URLSearchParams({ status, limit: limit.toString() });
    if (lastKey) {
      params.append('lastKey', lastKey);
    }
    const response = await fetchApi<ReviewQueueResponse>(`/admin/reviews?${params}`);
    return { items: response.reviews, nextKey: response.nextKey };
  },

  /**
   * Get review details
   */
  getReviewDetails: async (reviewId: string): Promise<ReviewDetails> => {
    return fetchApi<ReviewDetails>(`/admin/reviews/${reviewId}`);
  },

  /**
   * Submit review decision
   */
  submitDecision: async (
    reviewId: string,
    request: ReviewDecisionRequest
  ): Promise<ReviewDecisionResponse> => {
    return fetchApi<ReviewDecisionResponse>(`/admin/reviews/${reviewId}/decision`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Get dashboard statistics
   */
  getStats: async (): Promise<{
    pendingReviews: number;
    completedToday: number;
    averageTime: string;
    approvalRate: number;
  }> => {
    return fetchApi('/admin/stats');
  },
};

export { ApiError };
