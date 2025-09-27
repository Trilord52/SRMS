import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homePathFor } from './AuthContext';
import type { Role } from '@/lib/schemas';
import { Spinner } from '@/components/ui/Spinner';

/**
 * Route guard.
 *
 * The legacy client had six public routes and no guard of any kind: typing
 * /manager-dashboard rendered the manager interface for anyone, which then
 * failed every request. Access is still enforced by the API; this stops the
 * interface from lying about it.
 */
export function RequireAuth({
  roles,
  children,
}: {
  roles?: Role[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Waiting for the stored token to be verified. Redirecting here would bounce a
  // signed-in user to the login screen on every refresh.
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (!user) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    // Signed in but wrong role: send them to their own area rather than showing
    // an error for a page they were never meant to reach.
    return <Navigate to={homePathFor(user.role)} replace />;
  }

  return <>{children}</>;
}

/** Keeps a signed-in user away from the sign-in and registration screens. */
export function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (user) return <Navigate to={homePathFor(user.role)} replace />;

  return <>{children}</>;
}
