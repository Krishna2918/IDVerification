import React from 'react';
import { VerificationFlow } from '../../components/verification/VerificationFlow';

const VerificationPage: React.FC = () => {
  const handleComplete = (result: { outcome: string; sessionId: string }) => {
    console.log('Verification complete:', result);
    // Navigate to status page or callback
  };

  const handleCancel = () => {
    console.log('Verification cancelled');
    // Handle cancellation
  };

  return (
    <div className="min-h-screen bg-navy-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Identity Verification</h1>
          <p className="text-gray-600 mt-2">
            Complete the verification process to confirm your identity
          </p>
        </div>

        {/* Verification Flow */}
        <VerificationFlow
          onComplete={handleComplete}
          onCancel={handleCancel}
        />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Your data is encrypted and securely processed.</p>
          <p className="mt-1">Need help? Contact support.</p>
        </div>
      </div>
    </div>
  );
};

export default VerificationPage;
