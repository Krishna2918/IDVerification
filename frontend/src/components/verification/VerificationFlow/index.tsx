import React, { useState, useCallback } from 'react';
import { ConsentStep } from '../ConsentStep';
import { DocumentCapture } from '../DocumentCapture';
import { LivenessCheck } from '../LivenessCheck';
import { ProcessingStatus } from '../ProcessingStatus';
import { VerificationResult } from '../VerificationResult';

type VerificationStep =
  | 'consent'
  | 'document-front'
  | 'document-back'
  | 'liveness'
  | 'processing'
  | 'result';

interface VerificationFlowProps {
  externalReferenceId?: string;
  onComplete?: (result: { outcome: string; sessionId: string }) => void;
  onCancel?: () => void;
}

export const VerificationFlow: React.FC<VerificationFlowProps> = ({
  externalReferenceId,
  onComplete,
  onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState<VerificationStep>('consent');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ outcome: string; reason: string } | null>(null);

  const maxAttempts = 3;

  const handleConsentGiven = useCallback(async () => {
    try {
      // TODO: Call API to create session
      // const response = await api.createSession({ consentGiven: true, externalReferenceId });
      // setSessionId(response.sessionId);

      // Mock for now
      setSessionId(`session-${Date.now()}`);
      setCurrentStep('document-front');
    } catch (err) {
      setError('Failed to create verification session. Please try again.');
    }
  }, [externalReferenceId]);

  const handleDocumentCaptured = useCallback(async (side: 'front' | 'back') => {
    try {
      // TODO: Upload document to S3
      if (side === 'front') {
        // For simplicity, skip back side for now
        setCurrentStep('liveness');
      } else {
        setCurrentStep('liveness');
      }
    } catch (err) {
      setError('Failed to upload document. Please try again.');
    }
  }, []);

  const handleLivenessComplete = useCallback(async () => {
    try {
      setCurrentStep('processing');
      // TODO: Submit verification
      // Simulate processing
      setTimeout(() => {
        // Mock result
        setResult({ outcome: 'PASS', reason: 'ALL_CHECKS_PASSED' });
        setCurrentStep('result');
      }, 3000);
    } catch (err) {
      setError('Verification processing failed. Please try again.');
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (attemptCount < maxAttempts - 1) {
      setAttemptCount(prev => prev + 1);
      setError(null);
      setResult(null);
      setCurrentStep('document-front');
    }
  }, [attemptCount]);

  const renderStep = () => {
    switch (currentStep) {
      case 'consent':
        return (
          <ConsentStep
            onAccept={handleConsentGiven}
            onDecline={onCancel}
          />
        );

      case 'document-front':
        return (
          <DocumentCapture
            side="front"
            onCapture={() => handleDocumentCaptured('front')}
            onError={(err) => setError(err)}
          />
        );

      case 'document-back':
        return (
          <DocumentCapture
            side="back"
            onCapture={() => handleDocumentCaptured('back')}
            onError={(err) => setError(err)}
          />
        );

      case 'liveness':
        return (
          <LivenessCheck
            sessionId={sessionId || ''}
            onComplete={handleLivenessComplete}
            onError={(err) => setError(err)}
          />
        );

      case 'processing':
        return <ProcessingStatus />;

      case 'result':
        return (
          <VerificationResult
            outcome={result?.outcome || 'PENDING'}
            reason={result?.reason || ''}
            canRetry={attemptCount < maxAttempts - 1}
            onRetry={handleRetry}
            onComplete={() => onComplete?.({ outcome: result?.outcome || '', sessionId: sessionId || '' })}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="card">
      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">
            Step {getStepNumber(currentStep)} of 5
          </span>
          <span className="text-sm text-gray-500">
            Attempt {attemptCount + 1} of {maxAttempts}
          </span>
        </div>
        <div className="w-full bg-navy-100 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-navy-700 to-navy-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(getStepNumber(currentStep) / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            className="text-red-700 text-sm underline mt-1"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Step Content */}
      {renderStep()}
    </div>
  );
};

function getStepNumber(step: VerificationStep): number {
  const steps: Record<VerificationStep, number> = {
    consent: 1,
    'document-front': 2,
    'document-back': 2,
    liveness: 3,
    processing: 4,
    result: 5,
  };
  return steps[step];
}

export default VerificationFlow;
