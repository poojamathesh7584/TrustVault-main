import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { BootLoader, Brand } from '@/components/app/brand';
import { ErrorText, OtpInput } from '@/components/app/kit';
import { ThemeToggle } from '@/components/app/account';

// Shown when the 60-minute session ends: only the verification code is needed to continue.
export default function Reauth() {
  const { user, refresh, logout } = useAuth();
  const [who, setWho] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    api('/auth/reauth').then(setWho).catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  if (user) return <Navigate to="/" replace />;
  if (!who) return <BootLoader text="Checking your secure session…" />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/auth/reauth', { method: 'POST', body: { code: new FormData(e.currentTarget).get('code') } });
      await refresh();
      navigate('/');
    } catch (err) {
      setError(err.message);
      setAttempt((a) => a + 1);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-background text-foreground">
      <header className="border-b border-border/70 bg-card/60 px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Brand to="/login" />
          <ThemeToggle />
        </div>
      </header>
      <main className="my-auto mx-auto w-full max-w-md px-4 py-8">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
          <form className="grid gap-4" onSubmit={submit}>
            <h2 className="text-2xl font-bold leading-none">Session ended</h2>
            <p className="text-xs text-muted-foreground">
              Hi {who.name} ({who.email}), your 60-minute secure session has ended. Enter your verification code to continue.
            </p>
            <OtpInput key={attempt} invalid={Boolean(error)} />
            <ErrorText>{error}</ErrorText>
            <Button size="lg" className="w-full">Continue</Button>
            <Button type="button" variant="link" className="justify-self-center text-xs" onClick={async () => { await logout(); navigate('/login'); }}>
              Sign in as someone else
            </Button>
          </form>
        </div>
      </main>
      <footer className="border-t border-border/70 py-4 text-center text-xs text-muted-foreground">
        TrustVault · Smart Digital Identity & Document Verification
      </footer>
    </div>
  );
}
