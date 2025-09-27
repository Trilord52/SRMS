import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, setSessionExpiredHandler, tokenStore } from '@/lib/api';
import { loginResponseSchema, meResponseSchema, type Role, type User } from '@/lib/schemas';

interface AuthState {
  user: User | null;
  /** True until the stored token has been checked against the API. */
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  // The api client calls this when the API reports the token is unusable, so an
  // expired session drops the user to the sign-in screen instead of leaving the
  // interface in place with every request failing.
  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
  }, []);

  /**
   * A stored token is verified against the API before the interface is shown.
   * Trusting it without checking would render a dashboard that then fails every
   * request, which is what the legacy client did.
   */
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!tokenStore.get()) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/v1/auth/me');
        const { user: current } = meResponseSchema.parse(response);
        if (!cancelled) setUser(current);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post('/api/v1/auth/login', { email, password });
    const { token, user: signedIn } = loginResponseSchema.parse(response);
    tokenStore.set(token);
    setUser(signedIn);
    return signedIn;
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    [user]
  );

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, logout, hasRole }),
    [user, loading, login, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}

/** Where each role lands after signing in. */
export function homePathFor(role: Role): string {
  return `/${role}`;
}

/** Turns an API failure into a message suitable for a sign-in form. */
export function describeLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Could not reach the server. Check your connection and try again.';
  }

  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 'That email and password do not match an account.';
    case 'ACCOUNT_PENDING':
      return 'Your account is waiting for manager approval.';
    case 'ACCOUNT_REJECTED': {
      const reason = error.meta.rejectionReason;
      return typeof reason === 'string' && reason.length > 0
        ? `Your registration was not approved: ${reason}`
        : 'Your registration was not approved. Contact a manager.';
    }
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a few minutes before trying again.';
    case 'VALIDATION_FAILED':
      return error.details[0]?.message ?? 'Check the details you entered.';
    default:
      return error.message;
  }
}
