import React, { useState, useCallback } from 'react';
import { ConsentStep } from '../ConsentStep';
import { DocumentCapture } from '../DocumentCapture';
import { LivenessCheck } from '../LivenessCheck';
import { ProcessingStatus } from '../ProcessingStatus';
import { VerificationResult } from '../VerificationResult';
import { verificationApi } from '../../../services/api';

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
  const [isLoading, setIsLoading] = useState(false);

  const maxAttempts = 3;

  const handleConsentGiven = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await verificationApi.createSession();
      setSessionId(response.sessionId);
      await verificationApi.recordConsent(response.sessionId);
      setCurrentStep('document-front');
    } catch (err: any) {
      setError(err.message || 'Failed to create verification session. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDocumentCaptured = useCallback(async (imageBlob: Blob, side: 'front' | 'back') => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);
    try {
      // Get presigned URL
      const { uploadUrl, uploadId } = await verificationApi.getUploadUrl(
        sessionId,
        side,
        imageBlob.type || 'image/jpeg'
      );

      // Upload to S3
      await verificationApi.uploadDocument(uploadUrl, imageBlob);

      // Confirm upload
      await verificationApi.confirmUpload(sessionId, uploadId);

      if (side === 'front') {
        setCurrentStep('liveness');
      } else {
        setCurrentStep('liveness');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const handleLivenessComplete = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);
    try {
      setCurrentStep('processing');

      // Submit for verification
      await verificationApi.submitVerification(sessionId);

      // Poll for result
      const status = await verificationApi.pollForResult(sessionId);

      setResult({
        outcome: status.decision || 'PENDING',
        reason: status.reason || '',
      });
      setCurrentStep('result');
    } catch (err: any) {
      setError(err.message || 'Verification processing failed. Please try again.');
      setCurrentStep('liveness');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

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
            onCapture={(blob) => handleDocumentCaptured(blob, 'front')}
            onError={(err) => setError(err)}
          />
        );

      case 'document-back':
        return (
          <DocumentCapture
            side="back"
            onCapture={(blob) => handleDocumentCaptured(blob, 'back')}
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
