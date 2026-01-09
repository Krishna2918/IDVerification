import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  signInUser,
  signOutUser,
  getAuthenticatedUser,
  confirmMFA,
  refreshAuthToken,
  SignInResult,
} from '../services/auth';

interface User {
  username: string;
  userId: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingChallenge: string | null;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  confirmMFACode: (code: string) => Promise<SignInResult>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticatedUser = await getAuthenticatedUser();
        if (authenticatedUser) {
          setUser({
            username: authenticatedUser.username,
            userId: authenticatedUser.userId,
          });
        }
      } catch (err) {
        console.error('Auth check error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Refresh token periodically
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      await refreshAuthToken();
    }, 45 * 60 * 1000); // Refresh every 45 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    setIsLoading(true);
    setError(null);
    setPendingChallenge(null);

    try {
      const result = await signInUser(email, password);

      if (result.success) {
        const authenticatedUser = await getAuthenticatedUser();
        if (authenticatedUser) {
          setUser({
            username: authenticatedUser.username,
            userId: authenticatedUser.userId,
          });
        }
        return result;
      }

      if (result.challengeName) {
        setPendingChallenge(result.challengeName);
        return result;
      }

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign in failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const confirmMFACode = useCallback(async (code: string): Promise<SignInResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await confirmMFA(code);

      if (result.success) {
        setPendingChallenge(null);
        const authenticatedUser = await getAuthenticatedUser();
        if (authenticatedUser) {
          setUser({
            username: authenticatedUser.username,
            userId: authenticatedUser.userId,
          });
        }
        return result;
      }

      if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MFA verification failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await signOutUser();
      setUser(null);
      setPendingChallenge(null);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    pendingChallenge,
    signIn,
    signOut,
    confirmMFACode,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({ children, redirectTo = '/admin/login' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-navy-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-navy-200 border-t-navy-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login
    window.location.href = redirectTo;
    return null;
  }

  return <>{children}</>;
}
