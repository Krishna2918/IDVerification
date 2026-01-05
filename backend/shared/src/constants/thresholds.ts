/**
 * Decision engine thresholds for ID verification
 * These values determine PASS, REVIEW, and FAIL outcomes
 */
export const DECISION_THRESHOLDS = {
  // Face Similarity Thresholds (percentage)
  SIMILARITY: {
    PASS: 90,           // >= 90% = auto PASS
    REVIEW_MIN: 70,     // 70-89% = REVIEW
    FAIL: 70,           // < 70% = auto FAIL
  },

  // OCR Confidence Thresholds (percentage)
  OCR_CONFIDENCE: {
    PASS: 85,           // >= 85% = auto PASS
    REVIEW_MIN: 70,     // 70-84% = REVIEW
    FAIL: 70,           // < 70% = auto FAIL
  },

  // Liveness Confidence (percentage)
  LIVENESS: {
    MIN_CONFIDENCE: 90, // Must be >= 90% to pass
  },

  // Image Quality Requirements
  IMAGE_QUALITY: {
    MIN_BRIGHTNESS: 20,
    MAX_BRIGHTNESS: 240,
    MIN_SHARPNESS: 30,
    MIN_FACE_SIZE_PIXELS: 100,
  },
} as const;

/**
 * Operational limits
 */
export const OPERATIONAL_LIMITS = {
  // Session limits
  MAX_VERIFICATION_ATTEMPTS: 3,
  SESSION_EXPIRY_HOURS: 24,

  // Storage retention
  IMAGE_RETENTION_DAYS: 30,
  AUDIT_LOG_RETENTION_YEARS: 7,

  // Review SLA
  REVIEW_SLA_HOURS: 24,

  // Rate limiting
  RATE_LIMITS: {
    CREATE_SESSION_PER_MINUTE: 100,
    UPLOAD_DOCUMENT_PER_MINUTE: 50,
    SUBMIT_VERIFICATION_PER_MINUTE: 30,
  },

  // Presigned URL expiry
  PRESIGNED_URL_EXPIRY_SECONDS: 300, // 5 minutes
} as const;

/**
 * Hard fail conditions that result in immediate rejection
 */
export const HARD_FAIL_CONDITIONS = [
  'LIVENESS_FAILED',
  'DOCUMENT_EXPIRED',
  'SIMILARITY_BELOW_MINIMUM',
  'MAX_ATTEMPTS_EXCEEDED',
  'ABUSE_DETECTED',
  'INVALID_DOCUMENT_TYPE',
  'OCR_CONFIDENCE_TOO_LOW',
] as const;

/**
 * Conditions that trigger manual review
 */
export const REVIEW_TRIGGERS = [
  'SIMILARITY_BORDERLINE',
  'OCR_CONFIDENCE_BORDERLINE',
  'IMAGE_QUALITY_ISSUES',
  'FIELD_MISMATCH',
  'MISSING_OPTIONAL_FIELDS',
  'MISSING_REQUIRED_FIELDS',
  'MULTIPLE_FACES_DETECTED',
  'DOCUMENT_DAMAGE_DETECTED',
  'GLARE_DETECTED',
  'FIELD_VALIDATION_ISSUES',
] as const;

/**
 * Required fields for ID documents
 */
export const REQUIRED_DOCUMENT_FIELDS = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'documentNumber',
  'expiryDate',
] as const;

/**
 * Optional fields that may trigger review if missing
 */
export const OPTIONAL_DOCUMENT_FIELDS = [
  'middleName',
  'address',
  'issuingState',
  'issuingCountry',
  'documentClass',
  'sex',
] as const;

export type HardFailCondition = typeof HARD_FAIL_CONDITIONS[number];
export type ReviewTrigger = typeof REVIEW_TRIGGERS[number];
export type RequiredDocumentField = typeof REQUIRED_DOCUMENT_FIELDS[number];
export type OptionalDocumentField = typeof OPTIONAL_DOCUMENT_FIELDS[number];
