import { Amplify } from 'aws-amplify';
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchAuthSession,
  confirmSignIn,
  AuthUser,
} from 'aws-amplify/auth';

// Configure Amplify with Cognito settings
const configureAuth = () => {
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const region = import.meta.env.VITE_AWS_REGION || 'ca-central-1';

  if (!userPoolId || !userPoolClientId) {
    console.warn('Cognito configuration not found. Using mock authentication.');
    return false;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  });

  return true;
};

// Initialize auth configuration
const isCognitoConfigured = configureAuth();

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

export interface SignInResult {
  success: boolean;
  challengeName?: string;
  error?: string;
}

/**
 * Sign in with email and password
 */
export async function signInUser(email: string, password: string): Promise<SignInResult> {
  if (!isCognitoConfigured) {
    // Mock authentication for development
    localStorage.setItem('adminSession', JSON.stringify({ email, timestamp: Date.now() }));
    localStorage.setItem('authToken', 'mock-token');
    return { success: true };
  }

  try {
    const result = await signIn({ username: email, password });

    if (result.isSignedIn) {
      // Get the session tokens
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (idToken) {
        localStorage.setItem('authToken', idToken);
      }
      localStorage.setItem('adminSession', JSON.stringify({ email, timestamp: Date.now() }));
      return { success: true };
    }

    // Handle MFA or other challenges
    if (result.nextStep?.signInStep) {
      return {
        success: false,
        challengeName: result.nextStep.signInStep,
      };
    }

    return { success: false, error: 'Unknown authentication error' };
  } catch (error) {
    console.error('Sign in error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
    return { success: false, error: errorMessage };
  }
}

/**
 * Confirm MFA code
 */
export async function confirmMFA(code: string): Promise<SignInResult> {
  try {
    const result = await confirmSignIn({ challengeResponse: code });

    if (result.isSignedIn) {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (idToken) {
        localStorage.setItem('authToken', idToken);
      }
      return { success: true };
    }

    return { success: false, error: 'MFA verification failed' };
  } catch (error) {
    console.error('MFA confirmation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify MFA code';
    return { success: false, error: errorMessage };
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<void> {
  localStorage.removeItem('adminSession');
  localStorage.removeItem('authToken');

  if (isCognitoConfigured) {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}

/**
 * Get the current authenticated user
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  if (!isCognitoConfigured) {
    // Mock authentication check
    const session = localStorage.getItem('adminSession');
    if (session) {
      const parsed = JSON.parse(session);
      return { username: parsed.email, userId: 'mock-user' } as AuthUser;
    }
    return null;
  }

  try {
    const user = await getCurrentUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Get the current auth token for API calls
 */
export async function getAuthToken(): Promise<string | null> {
  if (!isCognitoConfigured) {
    return localStorage.getItem('authToken');
  }

  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      localStorage.setItem('authToken', idToken);
      return idToken;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Refresh the auth token if needed
 */
export async function refreshAuthToken(): Promise<boolean> {
  if (!isCognitoConfigured) {
    return !!localStorage.getItem('authToken');
  }

  try {
    const session = await fetchAuthSession({ forceRefresh: true });
    const idToken = session.tokens?.idToken?.toString();
    if (idToken) {
      localStorage.setItem('authToken', idToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getAuthenticatedUser();
  return user !== null;
}

export { isCognitoConfigured };
