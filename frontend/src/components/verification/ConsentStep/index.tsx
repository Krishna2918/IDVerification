import React, { useState } from 'react';

interface ConsentStepProps {
  onAccept: () => void;
  onDecline?: () => void;
}

export const ConsentStep: React.FC<ConsentStepProps> = ({ onAccept, onDecline }) => {
  const [agreed, setAgreed] = useState(false);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Consent Required</h2>

      <p className="text-gray-600 mb-4">
        To verify your identity, we need to collect and process the following information:
      </p>

      <ul className="list-disc list-inside text-gray-600 mb-6 space-y-2">
        <li>A photo of your government-issued ID document</li>
        <li>A live selfie video for face matching</li>
        <li>Personal information extracted from your ID</li>
      </ul>

      <div className="bg-navy-50 rounded-2xl p-4 mb-6">
        <h3 className="font-medium text-gray-800 mb-2">How we use your data:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Your data is encrypted and securely transmitted</li>
          <li>• Images are processed using AI for verification</li>
          <li>• Data is retained for 30 days then deleted</li>
          <li>• We do not share your data with third parties</li>
        </ul>
      </div>

      <div className="flex items-start mb-6">
        <input
          type="checkbox"
          id="consent"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 text-navy-600 border-navy-300 rounded focus:ring-navy-500"
        />
        <label htmlFor="consent" className="ml-3 text-sm text-gray-700">
          I understand and consent to the collection and processing of my personal data
          for identity verification purposes. I have read and agree to the{' '}
          <a href="#" className="text-navy-600 underline">Privacy Policy</a>.
        </label>
      </div>

      <div className="flex gap-3">
        {onDecline && (
          <button className="btn-cancel flex-1" onClick={onDecline}>
            Cancel
          </button>
        )}
        <button
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={onAccept}
          disabled={!agreed}
        >
          I Agree & Continue
        </button>
      </div>
    </div>
  );
};

export default ConsentStep;
