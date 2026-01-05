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
  'MULTIPLE_FACES_DETECTED',
  'DOCUMENT_DAMAGE_DETECTED',
  'GLARE_DETECTED',
] as const;

export type HardFailCondition = typeof HARD_FAIL_CONDITIONS[number];
export type ReviewTrigger = typeof REVIEW_TRIGGERS[number];
