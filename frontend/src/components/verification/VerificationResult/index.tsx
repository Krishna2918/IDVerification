import React from 'react';

interface VerificationResultProps {
  outcome: string;
  reason: string;
  canRetry?: boolean;
  onRetry?: () => void;
  onComplete?: () => void;
}

export const VerificationResult: React.FC<VerificationResultProps> = ({
  outcome,
  reason,
  canRetry,
  onRetry,
  onComplete,
}) => {
  const getOutcomeDisplay = () => {
    switch (outcome) {
      case 'PASS':
        return {
          icon: '✓',
          title: 'Verification Successful',
          description: 'Your identity has been verified.',
          bgColor: 'bg-green-100',
          textColor: 'text-green-700',
          iconBg: 'bg-green-500',
        };
      case 'FAIL':
        return {
          icon: '✗',
          title: 'Verification Failed',
          description: 'We were unable to verify your identity.',
          bgColor: 'bg-red-100',
          textColor: 'text-red-700',
          iconBg: 'bg-red-500',
        };
      case 'REVIEW':
        return {
          icon: '⏳',
          title: 'Under Review',
          description: 'Your verification requires manual review. This typically takes less than 24 hours.',
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-700',
          iconBg: 'bg-yellow-500',
        };
      default:
        return {
          icon: '•',
          title: 'Processing',
          description: 'Your verification is being processed.',
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-700',
          iconBg: 'bg-blue-500',
        };
    }
  };

  const display = getOutcomeDisplay();

  return (
    <div className="text-center">
      {/* Result Icon */}
      <div
        className={`w-20 h-20 rounded-full ${display.bgColor} flex items-center justify-center mx-auto mb-6`}
      >
        <span className={`text-4xl ${display.textColor}`}>{display.icon}</span>
      </div>

      {/* Title */}
      <h2 className={`text-2xl font-bold ${display.textColor} mb-2`}>
        {display.title}
      </h2>

      {/* Description */}
      <p className="text-gray-600 mb-6">{display.description}</p>

      {/* Reason */}
      {reason && outcome !== 'PASS' && (
        <div className="bg-navy-50 rounded-2xl p-4 mb-6 text-left">
          <p className="text-sm text-gray-500 mb-1">Reason</p>
          <p className="text-gray-700">{formatReason(reason)}</p>
        </div>
      )}

      {/* What's Next */}
      <div className="bg-navy-50 rounded-2xl p-4 mb-6 text-left">
        <p className="text-sm text-gray-500 mb-1">What's Next</p>
        <p className="text-gray-700">
          {outcome === 'PASS'
            ? 'You can now continue with your application.'
            : outcome === 'REVIEW'
            ? "We'll notify you once the review is complete. You can check your status at any time."
            : canRetry
            ? 'You can try again with a clearer photo of your ID.'
            : 'Please contact support for assistance.'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {outcome === 'PASS' && onComplete && (
          <button className="btn-primary w-full" onClick={onComplete}>
            Continue
          </button>
        )}

        {outcome === 'FAIL' && canRetry && onRetry && (
          <button className="btn-primary w-full" onClick={onRetry}>
            Try Again
          </button>
        )}

        {outcome === 'REVIEW' && (
          <button className="btn-secondary w-full" onClick={() => window.location.reload()}>
            Check Status
          </button>
        )}
      </div>
    </div>
  );
};

function formatReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    ALL_CHECKS_PASSED: 'All verification checks passed successfully.',
    LIVENESS_FAILED: 'The liveness check did not pass. Please ensure you are in good lighting and follow the on-screen instructions.',
    DOCUMENT_EXPIRED: 'Your ID document has expired. Please use a valid, non-expired document.',
    SIMILARITY_BELOW_MINIMUM: 'The face on your ID does not match your selfie closely enough.',
    MANUAL_REVIEW_REQUIRED: 'Additional verification is required. A human reviewer will examine your submission.',
    OCR_CONFIDENCE_TOO_LOW: 'We could not clearly read your ID document. Please upload a clearer image.',
  };

  return reasonMap[reason] || reason.replace(/_/g, ' ').toLowerCase();
}

export default VerificationResult;
