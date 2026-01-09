import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { ReviewQueueItem } from '../../types/review';

interface Stats {
  pendingReviews: number;
  completedToday: number;
  averageTime: string;
  approvalRate: number;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [reviews, setReviews] = useState<ReviewQueueItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress'>('pending');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch stats and reviews in parallel
      const [statsData, reviewsData] = await Promise.all([
        adminApi.getStats(),
        adminApi.getReviewQueue(filter === 'all' ? 'pending' : filter),
      ]);

      setStats(statsData);
      setReviews(reviewsData.items);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    await signOut();
    navigate('/admin/login');
  };

  const handleReview = (reviewId: string) => {
    navigate(`/admin/review/${reviewId}`);
  };

  const handleRefresh = () => {
    loadData();
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-100 text-blue-700';
      case 'in_progress':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-green-100 text-green-700';
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-navy-700 to-navy-500 rounded-3xl shadow-lg p-6 text-white mx-4 mt-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <span className="text-2xl">🔍</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Review Dashboard</h1>
              <p className="text-navy-100 text-sm">ID Verification Review Queue</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm font-medium hover:bg-white/30 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 mb-6">
          <div className="bg-white rounded-3xl p-4 border border-navy-100 shadow-md">
            <p className="text-sm text-gray-500">Pending Reviews</p>
            <p className="text-3xl font-bold text-navy-700">{stats.pendingReviews}</p>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-navy-100 shadow-md">
            <p className="text-sm text-gray-500">Completed Today</p>
            <p className="text-3xl font-bold text-green-600">{stats.completedToday}</p>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-navy-100 shadow-md">
            <p className="text-sm text-gray-500">Avg. Review Time</p>
            <p className="text-3xl font-bold text-navy-700">{stats.averageTime}</p>
          </div>
          <div className="bg-white rounded-3xl p-4 border border-navy-100 shadow-md">
            <p className="text-sm text-gray-500">Approval Rate</p>
            <p className="text-3xl font-bold text-navy-700">{stats.approvalRate}%</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="px-4 mb-4">
        <div className="flex gap-2">
          {(['pending', 'in_progress', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-5 py-2 font-medium transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-navy-700 to-navy-500 text-white shadow-md'
                  : 'bg-navy-50 border border-navy-200 text-gray-700 hover:bg-navy-100'
              }`}
            >
              {f === 'pending' ? 'Pending' : f === 'in_progress' ? 'In Progress' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Review Queue */}
      <div className="px-4">
        <div className="bg-white rounded-3xl shadow-md border border-navy-100 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-navy-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading reviews...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-gray-600 font-medium">No reviews in queue</p>
              <p className="text-gray-500 text-sm">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-navy-100">
              {/* Table Header */}
              <div className="bg-gradient-to-r from-navy-50 to-slate-50 px-6 py-3 grid grid-cols-12 gap-4 text-sm font-medium text-gray-600">
                <div className="col-span-2">Review ID</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-2">Priority</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Scores</div>
                <div className="col-span-2">Action</div>
              </div>

              {/* Table Rows */}
              {filteredReviews.map((review) => (
                <div
                  key={review.reviewId}
                  className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-navy-50/50 transition-colors"
                >
                  <div className="col-span-2">
                    <p className="font-medium text-gray-800">{review.reviewId.substring(0, 8)}...</p>
                    <p className="text-xs text-gray-500">{review.sessionId.substring(0, 8)}...</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-700">{formatTime(review.createdAt)}</p>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(
                        review.priority
                      )}`}
                    >
                      {review.priority.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        review.status
                      )}`}
                    >
                      {review.status === 'in_progress' ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs">
                      <p className="text-gray-600">
                        Similarity: <span className="font-medium">{review.scores.similarity}%</span>
                      </p>
                      <p className="text-gray-600">
                        OCR: <span className="font-medium">{review.scores.ocrConfidence}%</span>
                      </p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <button
                      onClick={() => handleReview(review.reviewId)}
                      className="bg-gradient-to-r from-navy-700 to-navy-500 text-white rounded-full px-4 py-2 text-sm font-medium shadow-md hover:shadow-lg transition-shadow"
                    >
                      {review.status === 'in_progress' ? 'Continue' : 'Review'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 mb-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-red-700">{error}</p>
              <button
                onClick={handleRefresh}
                className="text-red-600 hover:text-red-800 font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-6 pb-8">
        <div className="bg-white rounded-3xl shadow-md border border-navy-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="bg-gradient-to-r from-navy-700 to-navy-500 text-white rounded-full px-5 py-2 font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50"
            >
              {isLoading ? 'Refreshing...' : 'Refresh Queue'}
            </button>
            <button className="bg-navy-50 border border-navy-200 text-gray-700 rounded-full px-5 py-2 font-medium hover:bg-navy-100 transition-colors">
              Export Reports
            </button>
            <button className="bg-navy-50 border border-navy-200 text-gray-700 rounded-full px-5 py-2 font-medium hover:bg-navy-100 transition-colors">
              View Audit Logs
            </button>
            <button className="bg-navy-50 border border-navy-200 text-gray-700 rounded-full px-5 py-2 font-medium hover:bg-navy-100 transition-colors">
              SLA Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
