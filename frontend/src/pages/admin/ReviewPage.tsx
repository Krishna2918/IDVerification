import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface ReviewDetails {
  id: string;
  sessionId: string;
  createdAt: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  reasons: string[];
  scores: {
    similarity: number;
    ocrConfidence: number;
    livenessConfidence: number;
  };
  extractedData: {
    documentType: string;
    documentNumber: string;
    fullName: string;
    dateOfBirth: string;
    expiryDate: string;
    issuingCountry: string;
  };
  images: {
    documentFront: string;
    documentBack?: string;
    selfie: string;
    faceCrop: string;
  };
  qualityIssues: string[];
}

const ReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { reviewId } = useParams<{ reviewId: string }>();
  const [review, setReview] = useState<ReviewDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('adminSession');
    if (!session) {
      navigate('/admin/login');
      return;
    }

    loadReview();
  }, [navigate, reviewId]);

  const loadReview = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data
      setReview({
        id: reviewId || 'REV-001',
        sessionId: 'SES-abc123',
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        status: 'in_progress',
        priority: 'high',
        reasons: ['SIMILARITY_BELOW_MINIMUM'],
        scores: {
          similarity: 75,
          ocrConfidence: 92,
          livenessConfidence: 98,
        },
        extractedData: {
          documentType: 'DRIVERS_LICENSE',
          documentNumber: 'DL-123456789',
          fullName: 'JOHN MICHAEL SMITH',
          dateOfBirth: '1985-03-15',
          expiryDate: '2027-03-15',
          issuingCountry: 'Canada',
        },
        images: {
          documentFront: '/placeholder-id-front.jpg',
          documentBack: '/placeholder-id-back.jpg',
          selfie: '/placeholder-selfie.jpg',
          faceCrop: '/placeholder-face-crop.jpg',
        },
        qualityIssues: ['Minor glare detected on document'],
      });
    } catch (err) {
      console.error('Failed to load review:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitDecision = async () => {
    if (!decision) return;
    if (decision === 'reject' && !rejectReason) {
      alert('Please select a rejection reason');
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: API call to submit decision
      await new Promise((resolve) => setTimeout(resolve, 1000));

      navigate('/admin/dashboard');
    } catch (err) {
      console.error('Failed to submit decision:', err);
      alert('Failed to submit decision. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatReason = (reason: string): string => {
    const reasonMap: Record<string, string> = {
      SIMILARITY_BELOW_MINIMUM: 'Face similarity below threshold (70-90%)',
      OCR_CONFIDENCE_TOO_LOW: 'Document OCR confidence low (70-85%)',
      IMAGE_QUALITY_ISSUE: 'Image quality issues detected',
      FIELD_VALIDATION_ISSUE: 'Document field validation issues',
      MISSING_OPTIONAL_FIELDS: 'Optional fields could not be extracted',
    };
    return reasonMap[reason] || reason.replace(/_/g, ' ');
  };

  const getScoreColor = (score: number, thresholds: { pass: number; warning: number }) => {
    if (score >= thresholds.pass) return 'text-green-600';
    if (score >= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBarColor = (score: number, thresholds: { pass: number; warning: number }) => {
    if (score >= thresholds.pass) return 'bg-green-500';
    if (score >= thresholds.warning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-navy-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading review...</p>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Review not found</p>
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="mt-4 text-navy-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-500 rounded-3xl shadow-lg p-6 text-white mx-4 mt-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="bg-white/20 backdrop-blur-sm rounded-full p-3 hover:bg-white/30 transition-colors"
            >
              <span className="text-xl">←</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold">Review: {review.id}</h1>
              <p className="text-navy-100 text-sm">Session: {review.sessionId}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-medium">
              {review.priority.toUpperCase()} PRIORITY
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Images */}
        <div className="lg:col-span-2 space-y-6">
          {/* Review Reasons */}
          <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Review Triggers</h3>
            <div className="space-y-2">
              {review.reasons.map((reason, idx) => (
                <div key={idx} className="flex items-center gap-2 text-yellow-700 bg-yellow-50 p-3 rounded-xl">
                  <span>⚠️</span>
                  <span>{formatReason(reason)}</span>
                </div>
              ))}
              {review.qualityIssues.map((issue, idx) => (
                <div key={idx} className="flex items-center gap-2 text-blue-700 bg-blue-50 p-3 rounded-xl">
                  <span>ℹ️</span>
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Face Comparison */}
          <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Face Comparison</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">ID Photo</p>
                <div
                  className="aspect-square bg-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-navy-500 transition-all"
                  onClick={() => setZoomedImage(review.images.faceCrop)}
                >
                  <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-navy-100 to-slate-100">
                    👤
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Selfie</p>
                <div
                  className="aspect-square bg-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-navy-500 transition-all"
                  onClick={() => setZoomedImage(review.images.selfie)}
                >
                  <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-navy-100 to-slate-100">
                    🤳
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <span className={`text-2xl font-bold ${getScoreColor(review.scores.similarity, { pass: 90, warning: 70 })}`}>
                {review.scores.similarity}% Match
              </span>
            </div>
          </div>

          {/* Document Images */}
          <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">ID Document</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-2">Front</p>
                <div
                  className="aspect-[3/2] bg-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-navy-500 transition-all"
                  onClick={() => setZoomedImage(review.images.documentFront)}
                >
                  <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-navy-100 to-slate-100">
                    📄
                  </div>
                </div>
              </div>
              {review.images.documentBack && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Back</p>
                  <div
                    className="aspect-[3/2] bg-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-navy-500 transition-all"
                    onClick={() => setZoomedImage(review.images.documentBack!)}
                  >
                    <div className="w-full h-full flex items-center justify-center text-5xl bg-gradient-to-br from-navy-100 to-slate-100">
                      📄
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Data & Decision */}
        <div className="space-y-6">
          {/* Confidence Scores */}
          <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Confidence Scores</h3>
            <div className="space-y-4">
              {/* Similarity */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Face Similarity</span>
                  <span className={`font-medium ${getScoreColor(review.scores.similarity, { pass: 90, warning: 70 })}`}>
                    {review.scores.similarity}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getScoreBarColor(review.scores.similarity, { pass: 90, warning: 70 })}`}
                    style={{ width: `${review.scores.similarity}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Threshold: 90% (auto-pass) / 70% (auto-fail)</p>
              </div>

              {/* OCR Confidence */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">OCR Confidence</span>
                  <span className={`font-medium ${getScoreColor(review.scores.ocrConfidence, { pass: 85, warning: 70 })}`}>
                    {review.scores.ocrConfidence}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${getScoreBarColor(review.scores.ocrConfidence, { pass: 85, warning: 70 })}`}
                    style={{ width: `${review.scores.ocrConfidence}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Threshold: 85% (auto-pass) / 70% (auto-fail)</p>
              </div>

              {/* Liveness */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Liveness Check</span>
                  <span className="font-medium text-green-600">{review.scores.livenessConfidence}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-green-500" style={{ width: `${review.scores.livenessConfidence}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Extracted Data */}
          <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Extracted Information</h3>
            <div className="space-y-3">
              {Object.entries(review.extractedData).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-sm text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="text-sm font-medium text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Panel */}
          <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Your Decision</h3>

            {/* Decision Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => setDecision('approve')}
                className={`py-3 rounded-2xl font-medium transition-all ${
                  decision === 'approve'
                    ? 'bg-green-500 text-white ring-2 ring-green-300 shadow-lg'
                    : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                }`}
              >
                ✓ Approve
              </button>
              <button
                onClick={() => setDecision('reject')}
                className={`py-3 rounded-2xl font-medium transition-all ${
                  decision === 'reject'
                    ? 'bg-red-500 text-white ring-2 ring-red-300 shadow-lg'
                    : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                }`}
              >
                ✗ Reject
              </button>
            </div>

            {/* Rejection Reason */}
            {decision === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border border-navy-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none"
                >
                  <option value="">Select a reason...</option>
                  <option value="faces_dont_match">Faces do not match</option>
                  <option value="document_fraudulent">Document appears fraudulent</option>
                  <option value="document_unreadable">Document is unreadable</option>
                  <option value="photo_quality">Photo quality too poor</option>
                  <option value="data_mismatch">Data mismatch detected</option>
                  <option value="other">Other (specify in notes)</option>
                </select>
              </div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes {decision === 'reject' && '(required for rejection)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this review..."
                rows={3}
                className="w-full border border-navy-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none resize-none"
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmitDecision}
              disabled={!decision || isSubmitting || (decision === 'reject' && !rejectReason)}
              className="w-full bg-gradient-to-r from-navy-700 to-navy-500 text-white rounded-full py-3 font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Decision'}
            </button>
          </div>
        </div>
      </div>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="max-w-4xl max-h-full">
            <div className="bg-gray-300 rounded-2xl p-8 flex items-center justify-center min-h-[400px]">
              <span className="text-8xl">📷</span>
            </div>
            <p className="text-white text-center mt-4">Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewPage;
