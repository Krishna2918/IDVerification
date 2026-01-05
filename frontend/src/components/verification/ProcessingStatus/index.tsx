import React from 'react';

export const ProcessingStatus: React.FC = () => {
  const steps = [
    { id: 'document', label: 'Analyzing document', status: 'complete' },
    { id: 'liveness', label: 'Verifying liveness', status: 'complete' },
    { id: 'matching', label: 'Matching faces', status: 'in-progress' },
    { id: 'decision', label: 'Making decision', status: 'pending' },
  ];

  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-gray-800 mb-2">Processing Verification</h2>
      <p className="text-gray-600 mb-6">Please wait while we verify your identity...</p>

      {/* Spinner */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-navy-200 border-t-navy-600" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 text-left max-w-xs mx-auto">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                step.status === 'complete'
                  ? 'bg-green-100 text-green-600'
                  : step.status === 'in-progress'
                  ? 'bg-navy-100 text-navy-600 animate-pulse'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {step.status === 'complete' ? '✓' : step.status === 'in-progress' ? '•' : index + 1}
            </div>
            <span
              className={`${
                step.status === 'complete'
                  ? 'text-gray-800'
                  : step.status === 'in-progress'
                  ? 'text-navy-700 font-medium'
                  : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Note */}
      <p className="mt-8 text-sm text-gray-500">
        This usually takes less than 30 seconds.
      </p>
    </div>
  );
};

export default ProcessingStatus;
