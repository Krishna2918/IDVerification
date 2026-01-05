import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface VerificationStatus {
  sessionId: string;
  status: string;
  decision?: {
    outcome: string;
    reason: string;
    decidedAt: string;
  };
  createdAt: string;
}

const StatusPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // TODO: Replace with actual API call
        // const response = await api.getSessionStatus(sessionId);
        // setStatus(response);

        // Mock data for now
        setStatus({
          sessionId: sessionId || '',
          status: 'PENDING_REVIEW',
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        setError('Failed to fetch verification status');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchStatus();
    }
  }, [sessionId]);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'PASSED':
        return {
          label: 'Verified',
          color: 'bg-green-100 text-green-700',
          icon: '✓',
        };
      case 'FAILED':
        return {
          label: 'Not Verified',
          color: 'bg-red-100 text-red-700',
          icon: '✗',
        };
      case 'PENDING_REVIEW':
        return {
          label: 'Under Review',
          color: 'bg-yellow-100 text-yellow-700',
          icon: '⏳',
        };
      default:
        return {
          label: 'Processing',
          color: 'bg-blue-100 text-blue-700',
          icon: '⋯',
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="card max-w-md w-full mx-4 text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-800">Error</h2>
          <p className="text-gray-600 mt-2">{error || 'Session not found'}</p>
        </div>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay(status.status);

  return (
    <div className="min-h-screen bg-navy-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="card text-center">
          {/* Status Icon */}
          <div
            className={`w-20 h-20 rounded-full ${statusDisplay.color} flex items-center justify-center text-3xl mx-auto mb-6`}
          >
            {statusDisplay.icon}
          </div>

          {/* Status Label */}
          <h1 className="text-2xl font-bold text-gray-800">{statusDisplay.label}</h1>

          {/* Status Description */}
          <p className="text-gray-600 mt-2">
            {status.status === 'PENDING_REVIEW'
              ? 'Your verification is being reviewed. This typically takes less than 24 hours.'
              : status.status === 'PASSED'
              ? 'Your identity has been successfully verified.'
              : status.status === 'FAILED'
              ? 'We were unable to verify your identity. Please try again.'
              : 'Your verification is being processed.'}
          </p>

          {/* Session ID */}
          <div className="mt-6 p-4 bg-navy-50 rounded-2xl">
            <p className="text-sm text-gray-500">Session ID</p>
            <p className="font-mono text-sm text-gray-700 break-all">{status.sessionId}</p>
          </div>

          {/* Decision Details */}
          {status.decision && (
            <div className="mt-4 p-4 bg-navy-50 rounded-2xl">
              <p className="text-sm text-gray-500">Decision</p>
              <p className="font-medium text-gray-700">{status.decision.outcome}</p>
              <p className="text-sm text-gray-500 mt-1">{status.decision.reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-col gap-3">
            {status.status === 'FAILED' && (
              <button
                className="btn-primary w-full"
                onClick={() => window.location.href = '/verify'}
              >
                Try Again
              </button>
            )}
            <button
              className="btn-secondary w-full"
              onClick={() => window.location.reload()}
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
