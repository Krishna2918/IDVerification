import React, { useState, useEffect } from 'react';
import { FaceLivenessDetector } from '@aws-amplify/ui-react-liveness';
import { Amplify } from 'aws-amplify';
import { verificationApi } from '../../../services/api';

// Configure Amplify (should be in a config file in production)
Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
    },
  },
});

interface AmplifyLivenessProps {
  sessionId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export const AmplifyLiveness: React.FC<AmplifyLivenessProps> = ({
  sessionId,
  onComplete,
  onError,
}) => {
  const [livenessSessionId, setLivenessSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    const createLivenessSession = async () => {
      try {
        const response = await verificationApi.createLivenessSession(sessionId);
        setLivenessSessionId(response.livenessSessionId);
        setIsCreating(false);
      } catch (err: any) {
        setCreateError(err.message || 'Failed to create liveness session');
        setIsCreating(false);
        onError('Failed to initialize face liveness check');
      }
    };

    createLivenessSession();
  }, [sessionId, onError]);

  const handleAnalysisComplete = async () => {
    try {
      // Get the liveness result from our API
      const result = await verificationApi.getLivenessResult(sessionId);

      if (result.status === 'PASSED') {
        onComplete();
      } else {
        onError(`Liveness check failed: ${result.message}`);
      }
    } catch (err: any) {
      onError(err.message || 'Failed to verify liveness result');
    }
  };

  const handleError = (error: any) => {
    console.error('Liveness error:', error);
    onError(error?.message || 'Face liveness check encountered an error');
  };

  if (isCreating) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-navy-600 mx-auto mb-4" />
        <p className="text-gray-600">Initializing face liveness check...</p>
      </div>
    );
  }

  if (createError) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">⚠️</div>
        <p className="text-red-600 font-medium">{createError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 text-navy-600 underline"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!livenessSessionId) {
    return null;
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Face Liveness Check</h2>
      <p className="text-gray-600 mb-4">
        Please follow the on-screen instructions to verify you are a real person.
      </p>

      <div className="rounded-2xl overflow-hidden border border-navy-200">
        <FaceLivenessDetector
          sessionId={livenessSessionId}
          region={import.meta.env.VITE_AWS_REGION || 'ca-central-1'}
          onAnalysisComplete={handleAnalysisComplete}
          onError={handleError}
          disableInstructionScreen={false}
          components={{
            PhotosensitiveWarning: () => (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This check uses a flashing light sequence. If you are
                  sensitive to flashing lights, please contact support for alternative verification.
                </p>
              </div>
            ),
          }}
        />
      </div>

      <div className="mt-4 p-3 bg-navy-50 rounded-xl">
        <p className="text-sm text-gray-600">
          <strong>Tips:</strong> Ensure good lighting, position your face within the oval, and
          follow the movement instructions carefully.
        </p>
      </div>
    </div>
  );
};

export default AmplifyLiveness;
