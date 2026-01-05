/**
 * Error codes for the ID verification system
 */
export const ERROR_CODES = {
  // Session Errors (1xxx)
  SESSION_NOT_FOUND: 'E1001',
  SESSION_EXPIRED: 'E1002',
  SESSION_INVALID_STATUS: 'E1003',
  MAX_ATTEMPTS_EXCEEDED: 'E1004',
  CONSENT_NOT_GIVEN: 'E1005',

  // Document Errors (2xxx)
  DOCUMENT_NOT_UPLOADED: 'E2001',
  DOCUMENT_INVALID_FORMAT: 'E2002',
  DOCUMENT_TOO_LARGE: 'E2003',
  DOCUMENT_UNREADABLE: 'E2004',
  DOCUMENT_EXPIRED: 'E2005',
  DOCUMENT_MISSING_FIELDS: 'E2006',

  // Liveness Errors (3xxx)
  LIVENESS_NOT_STARTED: 'E3001',
  LIVENESS_FAILED: 'E3002',
  LIVENESS_SESSION_EXPIRED: 'E3003',
  LIVENESS_ALREADY_COMPLETED: 'E3004',

  // Face Comparison Errors (4xxx)
  FACE_NOT_DETECTED_IN_DOCUMENT: 'E4001',
  FACE_NOT_DETECTED_IN_SELFIE: 'E4002',
  FACE_COMPARISON_FAILED: 'E4003',
  SIMILARITY_TOO_LOW: 'E4004',

  // Processing Errors (5xxx)
  PROCESSING_FAILED: 'E5001',
  TEXTRACT_ERROR: 'E5002',
  REKOGNITION_ERROR: 'E5003',
  STEP_FUNCTIONS_ERROR: 'E5004',

  // Review Errors (6xxx)
  REVIEW_NOT_FOUND: 'E6001',
  REVIEW_ALREADY_ASSIGNED: 'E6002',
  REVIEW_ALREADY_COMPLETED: 'E6003',
  REVIEW_NOT_ASSIGNED: 'E6004',

  // Auth Errors (7xxx)
  UNAUTHORIZED: 'E7001',
  FORBIDDEN: 'E7002',
  INVALID_TOKEN: 'E7003',

  // Validation Errors (8xxx)
  VALIDATION_ERROR: 'E8001',
  INVALID_REQUEST: 'E8002',
  MISSING_REQUIRED_FIELD: 'E8003',

  // System Errors (9xxx)
  INTERNAL_ERROR: 'E9001',
  SERVICE_UNAVAILABLE: 'E9002',
  RATE_LIMIT_EXCEEDED: 'E9003',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.SESSION_NOT_FOUND]: 'Verification session not found',
  [ERROR_CODES.SESSION_EXPIRED]: 'Verification session has expired',
  [ERROR_CODES.SESSION_INVALID_STATUS]: 'Session is in an invalid status for this operation',
  [ERROR_CODES.MAX_ATTEMPTS_EXCEEDED]: 'Maximum verification attempts exceeded',
  [ERROR_CODES.CONSENT_NOT_GIVEN]: 'User consent is required to proceed',

  [ERROR_CODES.DOCUMENT_NOT_UPLOADED]: 'ID document has not been uploaded',
  [ERROR_CODES.DOCUMENT_INVALID_FORMAT]: 'Invalid document format. Accepted: JPEG, PNG, PDF',
  [ERROR_CODES.DOCUMENT_TOO_LARGE]: 'Document file size exceeds the maximum limit',
  [ERROR_CODES.DOCUMENT_UNREADABLE]: 'Document could not be read or is too blurry',
  [ERROR_CODES.DOCUMENT_EXPIRED]: 'The ID document has expired',
  [ERROR_CODES.DOCUMENT_MISSING_FIELDS]: 'Required fields could not be extracted from document',

  [ERROR_CODES.LIVENESS_NOT_STARTED]: 'Liveness check has not been started',
  [ERROR_CODES.LIVENESS_FAILED]: 'Liveness check failed',
  [ERROR_CODES.LIVENESS_SESSION_EXPIRED]: 'Liveness session has expired',
  [ERROR_CODES.LIVENESS_ALREADY_COMPLETED]: 'Liveness check has already been completed',

  [ERROR_CODES.FACE_NOT_DETECTED_IN_DOCUMENT]: 'No face detected in the ID document',
  [ERROR_CODES.FACE_NOT_DETECTED_IN_SELFIE]: 'No face detected in the selfie',
  [ERROR_CODES.FACE_COMPARISON_FAILED]: 'Face comparison could not be completed',
  [ERROR_CODES.SIMILARITY_TOO_LOW]: 'Face similarity score is too low',

  [ERROR_CODES.PROCESSING_FAILED]: 'Verification processing failed',
  [ERROR_CODES.TEXTRACT_ERROR]: 'Document text extraction failed',
  [ERROR_CODES.REKOGNITION_ERROR]: 'Face recognition service error',
  [ERROR_CODES.STEP_FUNCTIONS_ERROR]: 'Workflow execution error',

  [ERROR_CODES.REVIEW_NOT_FOUND]: 'Review item not found',
  [ERROR_CODES.REVIEW_ALREADY_ASSIGNED]: 'Review is already assigned to another reviewer',
  [ERROR_CODES.REVIEW_ALREADY_COMPLETED]: 'Review has already been completed',
  [ERROR_CODES.REVIEW_NOT_ASSIGNED]: 'Review must be assigned before making a decision',

  [ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to perform this action',
  [ERROR_CODES.INVALID_TOKEN]: 'Invalid or expired authentication token',

  [ERROR_CODES.VALIDATION_ERROR]: 'Request validation failed',
  [ERROR_CODES.INVALID_REQUEST]: 'Invalid request format',
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: 'Required field is missing',

  [ERROR_CODES.INTERNAL_ERROR]: 'An internal error occurred',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please try again later',
};
