import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/AuthContext';
import { fullName } from '@/lib/schemas';
import { cn } from '@/lib/cn';

const THEME_KEY = 'srms.theme';

/**
 * Theme is a class on the root element driven by tokens, replacing the legacy
 * approach of a localStorage flag plus a parallel set of hand-written dark
 * stylesheets that only three components actually had.
 */
function useTheme() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark((current) => !current) };
}

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AppShell({ nav, title }: { nav: NavItem[]; title: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  function handleSignOut() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Lets a keyboard user reach the content without walking the whole nav. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-8 w-auto" aria-hidden="true" />
            <span className="font-semibold">{title}</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {fullName(user)} · {user.role}
              </span>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>

            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row">
        <nav aria-label="Sections" className="md:w-56 md:shrink-0">
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            {nav.map(({ to, label, icon: Icon }) => (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground hover:bg-card'
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
