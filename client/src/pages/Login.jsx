import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  GraduationCap,
  Users,
  Shield,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  UserPlus,
  Mail,
  RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/account';
import { toast } from '@/components/app/kit';
import { cn } from '@/lib/utils';

const EMPTY_ROLE_CREDS = {
  student: { email: '', password: '' },
  verifier: { email: '', password: '' },
  admin: { email: '', password: '' }
};

export default function Login({ mode = 'login' }) {
  const [params] = useSearchParams();
  const isRegister = mode === 'register';
  const initialRole = params.get('as') === 'admin'
    ? 'admin'
    : (params.get('as') === 'faculty' ? 'verifier' : 'student');

  const [role, setRole] = useState(isRegister ? 'student' : initialRole);
  const [credsByRole, setCredsByRole] = useState(EMPTY_ROLE_CREDS);

  // Step 1 = Email + Password, Step 2 = 6-digit Email OTP
  const [step, setStep] = useState(1);
  const [otpEmail, setOtpEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Student-only registration state (isolated from login)
  const [regName, setRegName] = useState('');
  const [regRoll, setRegRoll] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lockedAccount, setLockedAccount] = useState(false);

  const { refresh } = useAuth();
  const navigate = useNavigate();

  const currentCreds = credsByRole[role] || { email: '', password: '' };
  const setRoleField = (field, value) => {
    setCredsByRole((prev) => ({
      ...prev,
      [role]: { ...(prev[role] || { email: '', password: '' }), [field]: value }
    }));
  };

  useEffect(() => {
    setError('');
    setShowPassword(false);
    setStep(1);
    setOtp('');
    setLockedAccount(false);
    if (isRegister) {
      setRole('student');
    } else {
      setRole(initialRole);
    }
  }, [isRegister, initialRole]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setError('');
    setShowPassword(false);
    setStep(1);
    setOtp('');
    setLockedAccount(false);
  };

  // Step 1: Email + Password -> Server sends OTP to registered email
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLockedAccount(false);

    const cleanEmail = currentCreds.email.trim();
    const pwd = currentCreds.password;

    if (!cleanEmail) {
      setError('Please enter your Email Address.');
      return;
    }
    if (!pwd) {
      setError('Please enter your Password.');
      return;
    }

    setBusy(true);
    try {
      const res = await api('/auth/login', {
        method: 'POST',
        body: {
          email: cleanEmail,
          password: pwd,
          as: role
        }
      });

      if (res?.ok && res?.next === 'otp') {
        setOtpEmail(res.email || cleanEmail);
        setOtp('');
        setResendCooldown(45);
        setStep(2);
        if (res.sent === false) {
          setError(res.mailError || res.message || 'Email delivery failed. Check server SMTP configuration.');
        } else {
          toast(`6-digit verification code sent to ${res.email || cleanEmail}.`);
        }
      } else if (res?.ok && res?.user) {
        toast(`Welcome back, ${res.user.name}!`);
        await refresh();
        navigate('/', { replace: true });
      } else {
        setError('Invalid email or password.');
      }
    } catch (err) {
      if (err?.status === 403 && String(err?.message || '').toLowerCase().includes('locked')) {
        setLockedAccount(true);
      }
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setBusy(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !otpEmail) return;
    setError('');
    setBusy(true);
    try {
      await api('/auth/otp/send', {
        method: 'POST',
        body: { email: otpEmail, role }
      });
      setResendCooldown(45);
      toast(`New verification code sent to ${otpEmail}.`);
    } catch (err) {
      setError(err?.message || 'Could not resend verification code.');
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Verify 6-digit OTP (5-attempt lockout enforced on server)
  const handleOtpVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setBusy(true);
    try {
      const res = await api('/auth/otp/verify', {
        method: 'POST',
        body: {
          email: otpEmail,
          code: cleanOtp,
          role
        }
      });

      if (res?.ok && res?.user) {
        toast(`Verified! Welcome, ${res.user.name}.`);
        await refresh();
        navigate('/', { replace: true });
      } else {
        setError('Invalid verification code.');
      }
    } catch (err) {
      if (err?.status === 403 && String(err?.message || '').toLowerCase().includes('locked')) {
        setLockedAccount(true);
      }
      setError(err?.message || 'Invalid or expired verification code.');
    } finally {
      setBusy(false);
    }
  };

  // Student-only registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = regName.trim();
    const cleanRoll = regRoll.trim().toUpperCase();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!cleanName) {
      setError('Please enter your Full Name.');
      return;
    }
    if (!cleanRoll) {
      setError('Please enter your Student Roll / Register Number.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid Email Address.');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = await api('/auth/register', {
        method: 'POST',
        body: {
          name: cleanName,
          roll: cleanRoll,
          email: cleanEmail,
          password: regPassword
        }
      });

      if (res?.ok && res?.user) {
        toast(`Student account created! Please sign in to verify your email OTP.`);
        navigate('/login?as=student', { replace: true });
      } else {
        setError('Could not complete student registration.');
      }
    } catch (err) {
      setError(err?.message || 'Could not complete student registration.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-gradient-to-br from-background via-card/50 to-background text-foreground relative selection:bg-primary/20">
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-md px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Brand to="/welcome" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="my-auto mx-auto w-full max-w-md px-4 py-8">
        <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-black/10 ring-1 ring-border/40">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-3">
              {isRegister ? <UserPlus className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
              {isRegister ? 'Student Registration Only' : 'Official Verification Portal'}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isRegister ? 'Create Student Account' : 'TrustVault Sign In'}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {isRegister
                ? 'Sign up as a student to manage and verify your credentials'
                : step === 1
                  ? 'Step 1: Sign in with your email and password'
                  : 'Step 2: Enter the 6-digit OTP sent to your email'}
            </p>
          </div>

          {!isRegister && (
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-border bg-muted/50 p-1 text-xs mb-5">
              <button
                type="button"
                onClick={() => handleRoleChange('student')}
                className={cn(
                  'rounded-xl py-2 font-medium transition-all flex items-center justify-center gap-1.5',
                  role === 'student' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <GraduationCap className="size-3.5" /> Student
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('verifier')}
                className={cn(
                  'rounded-xl py-2 font-medium transition-all flex items-center justify-center gap-1.5',
                  role === 'verifier' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Users className="size-3.5" /> Faculty
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={cn(
                  'rounded-xl py-2 font-medium transition-all flex items-center justify-center gap-1.5',
                  role === 'admin' ? 'bg-background text-foreground shadow-sm font-semibold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Shield className="size-3.5" /> Admin
              </button>
            </div>
          )}

          {isRegister ? (
            <form key="register-form" onSubmit={handleRegisterSubmit} className="grid gap-4" autoComplete="off">
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter your full name"
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">Student Roll / Register Number</label>
                <Input
                  type="text"
                  required
                  value={regRoll}
                  onChange={(e) => setRegRoll(e.target.value.toUpperCase())}
                  placeholder="e.g. 26MX337"
                  className="h-10 text-sm font-mono uppercase"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">Email Address</label>
                <Input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="student@college.edu"
                  className="h-10 text-sm font-mono"
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">Password (min 8 characters)</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Create a strong password"
                    className="h-10 text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="h-10 text-sm font-mono"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" size="lg" disabled={busy} className="w-full font-semibold h-10 mt-1 shadow-sm">
                {busy ? 'Creating Account…' : (<>Create Student Account <ArrowRight className="ml-1.5 size-4" /></>)}
              </Button>

              <p className="text-center text-xs text-muted-foreground pt-1">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </p>
              <p className="text-center text-[11px] text-muted-foreground/80">
                Faculty & Admin accounts are assigned by the Administrator.
              </p>
            </form>
          ) : step === 1 ? (
            <form key={`login-form-${role}`} onSubmit={handleLoginSubmit} className="grid gap-4" autoComplete="off">
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  {role === 'verifier' ? 'Faculty Email' : role === 'admin' ? 'Administrator Email' : 'Student Email'}
                </label>
                <Input
                  name={`email-${role}`}
                  type="email"
                  required
                  autoComplete="off"
                  value={currentCreds.email}
                  onChange={(e) => setRoleField('email', e.target.value)}
                  placeholder={role === 'verifier' ? 'faculty@college.edu' : role === 'admin' ? 'poojamatheshwaran6363@gmail.com' : 'student@college.edu'}
                  className="h-10 text-sm font-mono"
                  autoFocus
                />
              </div>

              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground">Password</label>
                <div className="relative">
                  <Input
                    name={`password-${role}`}
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={currentCreds.password}
                    onChange={(e) => setRoleField('password', e.target.value)}
                    placeholder="Enter your password"
                    className="h-10 text-sm font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={busy || !currentCreds.email || !currentCreds.password}
                className="w-full font-semibold h-10 mt-1 shadow-sm"
              >
                {busy ? 'Sending OTP to Email…' : (<>Continue to Email OTP <ArrowRight className="ml-1.5 size-4" /></>)}
              </Button>

              {role === 'student' ? (
                <p className="text-center text-xs text-muted-foreground pt-1">
                  New student?{' '}
                  <Link to="/register" className="text-primary font-medium hover:underline">
                    Create a student account
                  </Link>
                </p>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground pt-1">
                  {role === 'verifier'
                    ? 'Faculty login email & password are assigned by the Administrator.'
                    : 'Administrator access is restricted to authorized accounts.'}
                </p>
              )}
            </form>
          ) : (
            <form key={`otp-form-${role}`} onSubmit={handleOtpVerifySubmit} className="grid gap-4" autoComplete="off">
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-primary flex items-center gap-1.5 text-sm">
                    <Mail className="size-4" /> Email Verification
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError('');
                      setOtp('');
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Change Account
                  </button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Enter the 6-digit verification code sent to:
                  <br />
                  <b className="text-foreground font-mono text-sm tracking-wide">{otpEmail}</b>
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  5 wrong attempts will lock your account until unlocked by the Administrator.
                </p>
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-foreground text-center">
                  6-Digit Verification Code
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  required
                  disabled={lockedAccount}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="h-14 text-center font-mono text-2xl tracking-[0.5em] font-bold rounded-xl border-2 border-primary/40 focus:border-primary bg-background shadow-inner"
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setStep(1); setError(''); setOtp(''); }}
                  className="h-10 text-xs px-3"
                >
                  <ArrowLeft className="size-3.5 mr-1" /> Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={busy || lockedAccount || otp.length < 6}
                  className="flex-1 font-semibold h-10"
                >
                  {busy ? 'Verifying…' : 'Verify OTP & Sign In →'}
                </Button>
              </div>

              {!lockedAccount && (
                <div className="text-center mt-1">
                  <button
                    type="button"
                    disabled={busy || resendCooldown > 0}
                    onClick={handleResendOtp}
                    className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className={cn('size-3', busy && 'animate-spin')} />
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                  </button>
                </div>
              )}
            </form>
          )}

          <div className="mt-6 pt-3.5 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success shrink-0" /> Email OTP 2FA (5-Try Lock)
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success shrink-0" /> Zero-Knowledge Audit Trail
            </span>
          </div>
        </div>
      </main>

      <footer className="border-t border-border/60 bg-card/40 backdrop-blur-md px-4 py-3 text-center text-xs text-muted-foreground">
        <p>TrustVault Academic Verification · SHA-256 Tamper-Evident Ledger</p>
      </footer>
    </div>
  );
}
