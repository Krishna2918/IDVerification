import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, confirmMFACode, isAuthenticated, isLoading: authLoading, error: authError, pendingChallenge, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Sync auth errors
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearError();
    setIsSubmitting(true);

    try {
      const result = await signIn(email, password);

      if (result.success) {
        navigate('/admin/dashboard');
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    clearError();
    setIsSubmitting(true);

    try {
      const result = await confirmMFACode(mfaCode);

      if (result.success) {
        navigate('/admin/dashboard');
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('Invalid MFA code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = isSubmitting || authLoading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-700 to-navy-500 px-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Admin Portal</h1>
          <p className="text-navy-100 mt-2">ID Verification Review System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {pendingChallenge ? (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                Enter MFA Code
              </h2>

              <form onSubmit={handleMFASubmit} className="space-y-5">
                <p className="text-sm text-gray-600 text-center mb-4">
                  Please enter the verification code from your authenticator app.
                </p>

                {/* MFA Code Input */}
                <div>
                  <label htmlFor="mfaCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    id="mfaCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className="w-full border border-navy-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none text-center text-2xl tracking-widest"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || mfaCode.length !== 6}
                  className="w-full bg-gradient-to-r from-navy-700 to-navy-500 text-white rounded-full py-3 font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Verifying...' : 'Verify'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
                Sign in to your account
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full border border-navy-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none"
                    placeholder="you@company.com"
                  />
                </div>

                {/* Password Input */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full border border-navy-200 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-navy-400 focus:border-navy-400 outline-none"
                    placeholder="••••••••"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-navy-700 to-navy-500 text-white rounded-full py-3 font-medium shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Footer Links */}
              <div className="mt-6 text-center">
                <a href="#" className="text-sm text-navy-600 hover:underline">
                  Forgot your password?
                </a>
              </div>
            </>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center">
          <p className="text-navy-100 text-sm">
            This is a secure portal. All activities are logged and monitored.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
