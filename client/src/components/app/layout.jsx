// Signed-in shell: direct top navigation, quick role switching, and clean mobile dock.
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FolderLock, Link2, History, ShieldCheck, GraduationCap, Settings, LogOut, KeyRound, Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Brand, PageLoader } from './brand';
import { AccountMenu, NotificationCenter, ThemeToggle } from './account';
import { CommandButton, CommandPalette } from './command';
import '../../app.css';
import { Modal, OtpInput, ErrorText, toast } from './kit';

// Session timer
function SessionTimer() {
  const { expiresAt, refresh, logout } = useAuth();
  const [left, setLeft] = useState(() => Math.min(3600000, Math.max(0, new Date(expiresAt) - Date.now())));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    const tick = () => {
      const ms = Math.min(3600000, new Date(expiresAt) - Date.now());
      setLeft(ms);
      if (ms <= 0) window.dispatchEvent(new Event('session-expired'));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const clamped = Math.max(0, Math.min(3600000, left));
  const m = Math.floor(clamped / 60000);
  const s = String(Math.floor(clamped / 1000) % 60).padStart(2, '0');

  const extend = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/reauth', { method: 'POST', body: { code: new FormData(e.currentTarget).get('code') } });
      await refresh();
      setError('');
      toast('Session extended for another 60 minutes.');
    } catch (err) {
      setError(err.message);
      setAttempt((a) => a + 1);
    }
  };

  return (
    <>
      <Badge variant={left < 5 * 60e3 ? 'destructive' : 'outline'} className="h-8 px-2.5 text-xs tabular-nums" title="Sessions last 60 minutes">
        <Clock className="size-3.5 mr-1" /> <span className="sr-only">Session time left</span>{m}:{s}
      </Badge>
      {left > 0 && left < 2 * 60e3 && (
        <Modal title="Your secure session is ending" locked>
          <form className="grid gap-4" onSubmit={extend}>
            <p className="text-sm text-muted-foreground">
              For your security, sessions last 60 minutes. You will be signed out in <b className="font-mono text-foreground">{m}:{s}</b>.
            </p>
            <OtpInput key={attempt} invalid={Boolean(error)} />
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" onClick={async () => { await logout(); navigate('/welcome'); }}>Log out</Button>
              <Button>Stay signed in</Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

// Direct, role-tailored navigation items
const NAV_CONFIG = {
  student: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/documents', label: 'My Documents', icon: FolderLock },
    { to: '/access', label: 'Access Requests', icon: KeyRound, badge: true },
    { to: '/shares', label: 'Shared Links', icon: Link2 },
    { to: '/activity', label: 'Activity Log', icon: History },
    { to: '/security', label: 'Security', icon: ShieldCheck },
  ],
  verifier: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/records', label: 'Student Records', icon: GraduationCap },
    { to: '/documents', label: 'My Documents', icon: FolderLock },
    { to: '/shares', label: 'Shared Links', icon: Link2 },
    { to: '/activity', label: 'Activity Log', icon: History },
    { to: '/security', label: 'Security', icon: ShieldCheck },
  ],
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin', label: 'Admin Console', icon: Settings },
    { to: '/activity', label: 'Audit Log', icon: History },
    { to: '/security', label: 'Security', icon: ShieldCheck },
  ],
};

export function Layout() {
  const { user, refresh, pendingAccess } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const navItems = NAV_CONFIG[user?.role] || NAV_CONFIG.student;

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 gap-3">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <Brand to="/" />
            {/* Direct Desktop Navigation */}
            <nav aria-label="Main" className="hidden lg:flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon, badge }) => {
                const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/'}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{label}</span>
                    {badge && pendingAccess > 0 && (
                      <span className="grid min-w-5 place-items-center rounded-full bg-destructive px-1.5 py-0.5 font-mono text-[10px] text-white">
                        {pendingAccess}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Controls: Authenticated Role Indicator + Utilities + Account */}
          <div className="flex items-center gap-2">
            {/* Dedicated Role Badge - Only shows current user's role */}
            {user?.role === 'student' && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary shadow-xs">
                🎓 Student
              </div>
            )}
            {(user?.role === 'verifier' || user?.role === 'faculty') && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400 shadow-xs">
                👩‍🏫 Faculty
              </div>
            )}
            {user?.role === 'admin' && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-400 shadow-xs">
                🛡️ Admin
              </div>
            )}

            <CommandButton />
            <SessionTimer />
            <ThemeToggle />
            <NotificationCenter />
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main" className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 pb-24 lg:pb-12">
        <Suspense fallback={<PageLoader inline />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile Bottom Dock Navigation */}
      <nav aria-label="Mobile Navigation" className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-md lg:hidden">
        {navItems.map(({ to, label, icon: Icon, badge }) => {
          const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="size-5" />
              <span className="truncate max-w-[64px]">{label.split(' ')[0]}</span>
              {badge && pendingAccess > 0 && (
                <span className="absolute top-1 right-2 size-2 rounded-full bg-destructive" />
              )}
            </NavLink>
          );
        })}
      </nav>

      <CommandPalette />
    </div>
  );
}
