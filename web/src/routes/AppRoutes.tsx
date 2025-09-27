import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  BarChart3,
  Database,
  FileText,
  LayoutDashboard,
  Users,
  ClipboardCheck,
  FileStack,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/components/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RedirectIfSignedIn, RequireAuth } from '@/features/auth/RequireAuth';
import { homePathFor, useAuth } from '@/features/auth/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { MyReportsPage } from '@/features/reports/MyReportsPage';
import { SubmitReportPage } from '@/features/reports/SubmitReportPage';
import { ReviewQueuePage } from '@/features/reports/ReviewQueuePage';
import { AllReportsPage } from '@/features/reports/AllReportsPage';
import { TemplatesPage } from '@/features/templates/TemplatesPage';
import { DatabasesPage } from '@/features/databases/DatabasesPage';
import { ApprovalsPage } from '@/features/auth/ApprovalsPage';
import { UsersPage } from '@/features/auth/UsersPage';

/**
 * Analytics is loaded on demand: the charting library is the largest dependency
 * in the app, and only two of the three roles ever open this page.
 */
const AnalyticsPage = lazy(() =>
  import('@/features/analytics/AnalyticsPage').then((module) => ({
    default: module.AnalyticsPage,
  }))
);

function LazyAnalytics() {
  return (
    <Suspense fallback={<Spinner label="Loading analytics" className="p-6" />}>
      <AnalyticsPage />
    </Suspense>
  );
}

const staffNav: NavItem[] = [
  { to: '/staff', label: 'My reports', icon: FileText },
  { to: '/staff/submit', label: 'Submit report', icon: LayoutDashboard },
];

const supervisorNav: NavItem[] = [
  { to: '/supervisor', label: 'Review queue', icon: ClipboardCheck },
  { to: '/supervisor/reports', label: 'All reports', icon: FileStack },
  { to: '/supervisor/submit', label: 'Submit report', icon: FileText },
  { to: '/supervisor/analytics', label: 'Analytics', icon: BarChart3 },
];

const managerNav: NavItem[] = [
  { to: '/manager', label: 'Overview', icon: BarChart3 },
  { to: '/manager/reports', label: 'All reports', icon: FileStack },
  { to: '/manager/review', label: 'Review queue', icon: ClipboardCheck },
  { to: '/manager/templates', label: 'Templates', icon: LayoutDashboard },
  { to: '/manager/databases', label: 'Databases', icon: Database },
  { to: '/manager/approvals', label: 'Approvals', icon: Users },
  { to: '/manager/users', label: 'Users', icon: Users },
];

/** Sends the signed-in user to their own area, or to sign-in if there is none. */
function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading" />
      </div>
    );
  }

  return <Navigate to={user ? homePathFor(user.role) : '/login'} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfSignedIn>
            <LoginPage />
          </RedirectIfSignedIn>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfSignedIn>
            <RegisterPage />
          </RedirectIfSignedIn>
        }
      />

      <Route
        path="/staff"
        element={
          <RequireAuth roles={['staff']}>
            <AppShell nav={staffNav} title="Staff Reports" />
          </RequireAuth>
        }
      >
        <Route index element={<MyReportsPage />} />
        <Route path="submit" element={<SubmitReportPage />} />
      </Route>

      <Route
        path="/supervisor"
        element={
          <RequireAuth roles={['supervisor']}>
            <AppShell nav={supervisorNav} title="Supervisor" />
          </RequireAuth>
        }
      >
        <Route index element={<ReviewQueuePage />} />
        <Route path="reports" element={<AllReportsPage />} />
        <Route path="submit" element={<SubmitReportPage />} />
        <Route path="analytics" element={<LazyAnalytics />} />
      </Route>

      <Route
        path="/manager"
        element={
          <RequireAuth roles={['manager']}>
            <AppShell nav={managerNav} title="Manager" />
          </RequireAuth>
        }
      >
        <Route index element={<LazyAnalytics />} />
        <Route path="reports" element={<AllReportsPage />} />
        <Route path="review" element={<ReviewQueuePage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="databases" element={<DatabasesPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="users" element={<UsersPage />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
