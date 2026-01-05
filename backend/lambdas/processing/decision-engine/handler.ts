import { Context } from 'aws-lambda';
import {
  DECISION_THRESHOLDS,
  REQUIRED_DOCUMENT_FIELDS,
  ReviewTrigger,
} from '../../../shared/src/constants/thresholds';
import { ReviewReason, ReviewPriority } from '../../../shared/src/types/review';
import { DecisionOutcome } from '../../../shared/src/types/verification';

interface DocumentData {
  extractedFields: Record<string, string>;
  confidence: number;
  isExpired: boolean;
  expiryDate?: string;
  facesDetected: number;
  imageQuality?: {
    brightness: number;
    sharpness: number;
    hasGlare: boolean;
    isPartiallyObscured: boolean;
  };
}

interface LivenessResult {
  isLive: boolean;
  confidence: number;
  referenceImageKey?: string;
}

interface FaceComparisonResult {
  similarity: number;
  boundingBoxes?: {
    source: { left: number; top: number; width: number; height: number };
    target: { left: number; top: number; width: number; height: number };
  };
}

interface DecisionInput {
  sessionId: string;
  documentData: DocumentData;
  livenessResult: LivenessResult;
  faceComparison: FaceComparisonResult;
}

interface DecisionOutput {
  sessionId: string;
  decision: DecisionOutcome;
  reason: string;
  reviewReasons?: ReviewReason[];
  metadata: Record<string, unknown>;
  priority?: ReviewPriority;
  slaDeadline?: string;
}

export async function handler(event: DecisionInput, context: Context): Promise<DecisionOutput> {
  console.log('Decision engine input:', JSON.stringify(event, null, 2));

  const { sessionId, documentData, livenessResult, faceComparison } = event;
  const reviewReasons: ReviewReason[] = [];

  // ============================================
  // HARD FAIL CHECKS (Immediate rejection)
  // ============================================

  // 1. Liveness Check (HARD FAIL)
  if (!livenessResult.isLive) {
    return createFailResult(sessionId, 'LIVENESS_FAILED', {
      livenessConfidence: livenessResult.confidence,
      failedAt: 'LIVENESS_CHECK',
    });
  }

  // 2. Document Expiry (HARD FAIL)
  if (documentData.isExpired) {
    return createFailResult(sessionId, 'DOCUMENT_EXPIRED', {
      expiryDate: documentData.expiryDate,
      failedAt: 'DOCUMENT_EXPIRY_CHECK',
    });
  }

  // 3. Face Similarity Below Minimum (HARD FAIL)
  if (faceComparison.similarity < DECISION_THRESHOLDS.SIMILARITY.FAIL) {
    return createFailResult(sessionId, 'SIMILARITY_BELOW_MINIMUM', {
      similarity: faceComparison.similarity,
      threshold: DECISION_THRESHOLDS.SIMILARITY.FAIL,
      failedAt: 'FACE_SIMILARITY_CHECK',
    });
  }

  // 4. OCR Confidence Below Minimum (HARD FAIL)
  if (documentData.confidence < DECISION_THRESHOLDS.OCR_CONFIDENCE.FAIL) {
    return createFailResult(sessionId, 'OCR_CONFIDENCE_TOO_LOW', {
      ocrConfidence: documentData.confidence,
      threshold: DECISION_THRESHOLDS.OCR_CONFIDENCE.FAIL,
      failedAt: 'OCR_CONFIDENCE_CHECK',
    });
  }

  // ============================================
  // REVIEW CHECKS (Borderline cases)
  // ============================================

  // 5. Face Similarity Borderline (70-90%)
  if (
    faceComparison.similarity >= DECISION_THRESHOLDS.SIMILARITY.REVIEW_MIN &&
    faceComparison.similarity < DECISION_THRESHOLDS.SIMILARITY.PASS
  ) {
    reviewReasons.push({
      code: 'SIMILARITY_BORDERLINE',
      description: `Face similarity ${faceComparison.similarity.toFixed(1)}% is between ${DECISION_THRESHOLDS.SIMILARITY.REVIEW_MIN}% and ${DECISION_THRESHOLDS.SIMILARITY.PASS}%`,
      severity: faceComparison.similarity < 80 ? 'HIGH' : 'MEDIUM',
      relatedScore: faceComparison.similarity,
    });
  }

  // 6. OCR Confidence Borderline (70-85%)
  if (
    documentData.confidence >= DECISION_THRESHOLDS.OCR_CONFIDENCE.REVIEW_MIN &&
    documentData.confidence < DECISION_THRESHOLDS.OCR_CONFIDENCE.PASS
  ) {
    reviewReasons.push({
      code: 'OCR_CONFIDENCE_BORDERLINE',
      description: `Document OCR confidence ${documentData.confidence.toFixed(1)}% is between ${DECISION_THRESHOLDS.OCR_CONFIDENCE.REVIEW_MIN}% and ${DECISION_THRESHOLDS.OCR_CONFIDENCE.PASS}%`,
      severity: documentData.confidence < 75 ? 'HIGH' : 'MEDIUM',
      relatedScore: documentData.confidence,
    });
  }

  // 7. Image Quality Issues
  if (documentData.imageQuality) {
    const qualityIssues = checkImageQuality(documentData.imageQuality);
    if (qualityIssues.length > 0) {
      reviewReasons.push({
        code: 'IMAGE_QUALITY_ISSUES',
        description: `Image quality issues detected: ${qualityIssues.join(', ')}`,
        severity: qualityIssues.length > 2 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  // 8. Missing Required Fields
  const missingRequired = REQUIRED_DOCUMENT_FIELDS.filter(
    (f) => !documentData.extractedFields[f]
  );

  if (missingRequired.length > 0) {
    reviewReasons.push({
      code: 'MISSING_REQUIRED_FIELDS',
      description: `Missing required fields: ${missingRequired.join(', ')}`,
      severity: 'HIGH',
    });
  }

  // 9. Field Validation Issues
  const fieldValidationIssues = validateExtractedFields(documentData.extractedFields);
  if (fieldValidationIssues.length > 0) {
    reviewReasons.push({
      code: 'FIELD_VALIDATION_ISSUES',
      description: `Field validation issues: ${fieldValidationIssues.join(', ')}`,
      severity: 'MEDIUM',
    });
  }

  // 10. Multiple Faces in Document
  if (documentData.facesDetected > 1) {
    reviewReasons.push({
      code: 'MULTIPLE_FACES_DETECTED',
      description: `Multiple faces (${documentData.facesDetected}) detected in document`,
      severity: 'MEDIUM',
    });
  }

  // ============================================
  // FINAL DECISION
  // ============================================

  // If any review reasons exist, queue for manual review
  if (reviewReasons.length > 0) {
    const priority = calculatePriority(reviewReasons);
    const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return {
      sessionId,
      decision: 'REVIEW',
      reason: 'MANUAL_REVIEW_REQUIRED',
      reviewReasons,
      metadata: {
        similarity: faceComparison.similarity,
        ocrConfidence: documentData.confidence,
        livenessConfidence: livenessResult.confidence,
        reviewTriggers: reviewReasons.map((r) => r.code),
      },
      priority,
      slaDeadline,
    };
  }

  // All checks passed - AUTO APPROVE
  return {
    sessionId,
    decision: 'PASS',
    reason: 'ALL_CHECKS_PASSED',
    metadata: {
      similarity: faceComparison.similarity,
      ocrConfidence: documentData.confidence,
      livenessConfidence: livenessResult.confidence,
      allRequiredFieldsPresent: true,
      decisionType: 'AUTOMATED',
    },
  };
}

function createFailResult(
  sessionId: string,
  reason: string,
  metadata: Record<string, unknown>
): DecisionOutput {
  return {
    sessionId,
    decision: 'FAIL',
    reason,
    metadata,
  };
}

function checkImageQuality(quality: DocumentData['imageQuality']): string[] {
  const issues: string[] = [];
  if (!quality) return issues;

  const { MIN_BRIGHTNESS, MAX_BRIGHTNESS, MIN_SHARPNESS } = DECISION_THRESHOLDS.IMAGE_QUALITY;

  if (quality.brightness < MIN_BRIGHTNESS) issues.push('too_dark');
  if (quality.brightness > MAX_BRIGHTNESS) issues.push('too_bright');
  if (quality.sharpness < MIN_SHARPNESS) issues.push('blurry');
  if (quality.hasGlare) issues.push('glare_detected');
  if (quality.isPartiallyObscured) issues.push('partially_obscured');

  return issues;
}

function validateExtractedFields(fields: Record<string, string>): string[] {
  const issues: string[] = [];

  // DOB format validation
  if (fields.dateOfBirth) {
    const dob = new Date(fields.dateOfBirth);
    if (isNaN(dob.getTime())) {
      issues.push('invalid_dob_format');
    } else {
      // Check if over 18
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18) {
        issues.push('under_18');
      }
    }
  }

  // Document number format (basic alphanumeric check)
  if (fields.documentNumber && !/^[A-Z0-9]{5,20}$/i.test(fields.documentNumber)) {
    issues.push('suspicious_document_number');
  }

  return issues;
}

function calculatePriority(reasons: ReviewReason[]): ReviewPriority {
  if (reasons.some((r) => r.severity === 'HIGH')) return 'HIGH';
  if (reasons.filter((r) => r.severity === 'MEDIUM').length >= 2) return 'HIGH';
  if (reasons.some((r) => r.severity === 'MEDIUM')) return 'NORMAL';
  return 'LOW';
}
