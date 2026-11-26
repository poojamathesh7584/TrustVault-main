import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Lock,
  GraduationCap,
  Users,
  Shield,
  ArrowRight,
  CheckCircle2,
  Mail,
  KeyRound,
  ArrowLeft,
  Send,
  AlertCircle,
  Smartphone,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  Check
} from 'lucide-react';
import { api, findRegisteredUser } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/account';
import { toast } from '@/components/app/kit';
import { cn } from '@/lib/utils';

export default function Login() {
  const [params] = useSearchParams();
  const initialRole = params.get('as') === 'admin' ? 'admin' : (params.get('as') === 'faculty' ? 'verifier' : 'student');

  const [role, setRole] = useState(initialRole);
  const [credsByRole, setCredsByRole] = useState({
    student: { name: '', identifier: '', email: '', password: 'TrustVault@2026' },
    verifier: { name: '', identifier: '', email: '', password: 'TrustVault@2026' },
    admin: { name: '', identifier: '', email: '', password: 'TrustVault@2026' },
  });
  const currentCreds = credsByRole[role] || credsByRole.student;
  const { name, identifier, email, password } = currentCreds;
  const setField = (field, value) =>
    setCredsByRole((prev) => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
  const setName = (v) => setField('name', v);
  const setIdentifier = (v) => setField('identifier', v);
  const setEmail = (v) => setField('email', v);
  const setPassword = (v) => setField('password', v);
  const [showPassword, setShowPassword] = useState(false);

  // Multi-Factor Flow: 1. Password -> 2. Email Code -> 3. Hold to Enter Vault
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailNotice, setEmailNotice] = useState('');

  // Security lock after 5 tries
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedSeconds, setLockedSeconds] = useState(0);

  const { refresh } = useAuth();
  const navigate = useNavigate();

  // Timer countdown for lock
  useEffect(() => {
    if (lockedSeconds > 0) {
      const timer = setTimeout(() => setLockedSeconds((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockedSeconds]);

  // Timer countdown for OTP resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Reset errors and fields when role changes
  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setError('');
    setStep(1);
    setOtp('');
  };

  // Helper to record a failed attempt and lock after 5 tries
  const handleFailedAttempt = (errorMessage) => {
    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    if (nextAttempts >= 5) {
      setLockedSeconds(60);
      setError('Account temporarily locked due to 5 consecutive failed attempts. Please wait 60 seconds before retrying.');
    } else {
      setError(`${errorMessage} (Attempt ${nextAttempts} of 5)`);
    }
  };

  // -------------------------------------------------------------
  // STEP 1: Validate Password & Dispatch Real OTP to Email Inbox
  // -------------------------------------------------------------
  const handleStep1Submit = async (e) => {
    e?.preventDefault?.();
    if (lockedSeconds > 0) return;
    setError('');

    const inputEmail = email.trim();
    const inputName = name.trim();
    const inputRoll = identifier.trim();

    if (!inputName) {
      setError(role === 'verifier' ? 'Please enter your Faculty Full Name.' : role === 'admin' ? 'Please enter Administrator Name.' : 'Please enter your Full Name.');
      return;
    }

    if (role === 'student' && !inputRoll) {
      setError('Please enter your Student Roll / Register Number (e.g. 26MX337).');
      return;
    }

    if (role === 'verifier' && !inputRoll) {
      setError('Please enter your Staff / Faculty ID (e.g. FAC-4081).');
      return;
    }

    if (!inputEmail) {
      setError('Please enter your Email Address.');
      return;
    }

    const emailLower = inputEmail.toLowerCase();
    if (!emailLower.includes('@') || !emailLower.includes('.')) {
      setError('Please enter a valid email address with a domain (e.g. name@college.edu or name@gmail.com).');
      return;
    }

    const domain = emailLower.split('@')[1];
    const localPart = emailLower.split('@')[0];
    const blockedDomains = [
      'tempmail.com', 'throwawaymail.com', '10minutemail.com', 'mailinator.com',
      'guerrillamail.com', 'sharklasers.com', 'yopmail.com', 'fakemail.com',
      'fake.com', 'test.com', 'example.com', 'dummy.com', 'trashmail.com',
      'disposable.com', 'dispostable.com', 'mailcatch.com', 'inboxkitten.com'
    ];

    if (blockedDomains.includes(domain) || domain.includes('fake') || domain.includes('disposable') || domain.includes('tempmail')) {
      setError('Disposable or temporary email addresses are not permitted. Please enter your real email address.');
      return;
    }

    if (localPart === 'fake' || localPart === 'fakemail' || localPart === 'test' || localPart === 'dummy') {
      setError('Please enter your genuine personal or college email address.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Please enter your master password (minimum 6 characters).');
      return;
    }

    setBusy(true);
    try {
      const rollVal = inputRoll || (!inputEmail.includes('@') ? inputEmail.toUpperCase() : '26MX337');
      const studentName = inputName || `Student ${rollVal}`;

      const res = await api('/auth/otp/send', {
        method: 'POST',
        body: {
          email: inputEmail,
          password,
          role,
          name: studentName,
          roll: rollVal
        }
      });

      if (res?.sent === false) {
        setError(res.error || 'Could not send verification email. Please check SMTP configuration and try again.');
        setBusy(false);
        return;
      }

      setEmailNotice('');
      toast(`Verification code sent to ${inputEmail}! Please check your email inbox.`);

      setResendCooldown(45);
      setStep(2); // Advance to Email code verification
    } catch (err) {
      setError(err.message || 'Could not verify credentials. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 2: Verify OTP entered from Real Email Inbox
  // -------------------------------------------------------------
  const handleStep2VerifyOtp = async (e) => {
    e.preventDefault();
    if (lockedSeconds > 0) return;
    setError('');

    const inputOtp = otp.trim();
    if (!inputOtp || inputOtp.length < 6) {
      setError('Please enter the full 6-digit verification code sent to your email.');
      return;
    }

    const inputEmail = email.trim().toLowerCase();
    const inputRoll = identifier.trim().toUpperCase() || '26MX337';
    const studentName = name.trim() || `Student ${inputRoll}`;

    setBusy(true);
    let verified = false;
    let authenticatedUser = null;

    try {
      const res = await api('/auth/otp/verify', {
        method: 'POST',
        body: {
          email: inputEmail,
          code: inputOtp,
          role,
          name: studentName,
          roll: inputRoll
        }
      });
      if (res?.ok || res?.user) {
        verified = true;
        authenticatedUser = res.user || null;
      }
    } catch (err) {
      handleFailedAttempt(err?.message && err.message.includes('Access Denied')
        ? err.message
        : 'Invalid verification code. Please check your email inbox and try again.');
      setBusy(false);
      return;
    }

    if (!verified) {
      setBusy(false);
      handleFailedAttempt('Invalid verification code. Please check your email inbox and try again.');
      return;
    }

    if (!authenticatedUser) {
      authenticatedUser = {
        id: 'usr_' + Date.now(),
        _id: 'usr_' + Date.now(),
        name: studentName,
        email: inputEmail,
        role: role === 'verifier' ? 'verifier' : (role === 'admin' ? 'admin' : 'student'),
        roll: inputRoll,
        studentId: inputRoll,
        batch: inputRoll.slice(0, 4) || '26MX',
        dept: role === 'verifier' ? 'Department of Computer Applications' : 'Central Verification Cell',
        phone: '+91 98765 43210',
        hasVaultPin: true
      };
      try {
        localStorage.setItem('tv_mock_current_user', JSON.stringify(authenticatedUser));
      } catch {}
    }

    setFailedAttempts(0);
    toast('Email verification code confirmed! Signing in…');
    await refresh();
    window.location.assign('/');
  };

  return (
    <div className="min-h-dvh flex flex-col justify-between bg-gradient-to-br from-background via-card/50 to-background text-foreground relative selection:bg-primary/20">

      {/* Top Bar */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur-md px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Brand to="/welcome" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Single Clean Login Card */}
      <main className="my-auto mx-auto w-full max-w-md px-4 py-8">
        <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl p-6 sm:p-8 shadow-xl shadow-black/10 ring-1 ring-border/40">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-3">
              <ShieldCheck className="size-3.5" /> Official Verification Portal
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">TrustVault Sign In</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Two-Factor Authentication Flow (Password → Email Code)
            </p>
          </div>

          {/* Role Selector Tabs */}
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

          {/* Flowchart Step Progress Indicator */}
          <div className="flex items-center justify-center gap-4 mb-6 px-1 text-[11px] font-medium border-b border-border/60 pb-3.5">
            <div className={cn('flex items-center gap-1.5 transition-colors', step >= 1 ? 'text-primary font-semibold' : 'text-muted-foreground')}>
              <span className={cn('size-4 rounded-full flex items-center justify-center text-[10px]', step >= 1 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted')}>1</span>
              <span>Password</span>
            </div>
            <div className="text-muted-foreground/60">→</div>
            <div className={cn('flex items-center gap-1.5 transition-colors', step >= 2 ? 'text-primary font-semibold' : 'text-muted-foreground')}>
              <span className={cn('size-4 rounded-full flex items-center justify-center text-[10px]', step >= 2 ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted')}>2</span>
              <span>Email Code</span>
            </div>
          </div>

          {/* ================= STEP 1: CREDENTIALS & PASSWORD ================= */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit} className="grid gap-4">
              {/* Field 1: Full Name */}
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{role === 'verifier' ? 'Faculty Full Name' : role === 'admin' ? 'Administrator Name' : 'Full Name'}</span>
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Required *</span>
                </label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=""
                  className="h-10 text-sm"
                  autoFocus
                />
              </div>

              {/* Field 2: Roll Number / Staff ID */}
              {role !== 'admin' && (
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>{role === 'student' ? 'Student Roll / Register Number' : 'Staff / Faculty ID'}</span>
                    <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Required *</span>
                  </label>
                  <Input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value.toUpperCase())}
                    placeholder=""
                    className="h-10 text-sm font-mono uppercase"
                  />
                </div>
              )}

              {/* Field 3: Email Address */}
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>{role === 'verifier' ? 'Official Faculty Email' : role === 'admin' ? 'Administrator Email' : 'Email Address'}</span>
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Required *</span>
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                  className="h-10 text-sm font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  The secure 6-digit OTP will be dispatched to this email inbox.
                </span>
              </div>

              {/* Field 4: Password (Factor 1) */}
              <div className="grid gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Master Password (Factor 1)</span>
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Required *</span>
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                <span className="text-[11px] text-muted-foreground">
                  Default institutional password: <b className="font-mono text-foreground">TrustVault@2026</b>
                </span>
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
                disabled={busy || lockedSeconds > 0 || !email || !name || (role !== 'admin' && !identifier)}
                className="w-full font-semibold h-10 mt-1 shadow-sm"
              >
                {lockedSeconds > 0 ? (
                  `Locked (${lockedSeconds}s remaining)`
                ) : busy ? (
                  'Sending Verification Code…'
                ) : (
                  <>
                    Continue to Email Code (Factor 2) <ArrowRight className="ml-1.5 size-4" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ================= STEP 2: EMAIL VERIFICATION CODE (NO SPOILERS) ================= */}
          {step === 2 && (
            <form onSubmit={handleStep2VerifyOtp} className="grid gap-4">
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-primary flex items-center gap-1.5 text-sm">
                    <Mail className="size-4" /> Factor 2: Email Verification
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setError('');
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    Change Email
                  </button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  A secure 6-digit verification code has been dispatched to:
                  <br />
                  <b className="text-foreground font-mono text-sm tracking-wide">{email}</b>
                </p>
                <p className="text-[11px] text-muted-foreground/80 mt-2">
                  ⏱️ Please check your <b>inbox</b> and <b>spam folder</b>.
                </p>
              </div>

              {emailNotice && (
                <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-400 flex items-start gap-2.5">
                  <AlertCircle className="size-4 shrink-0 mt-0.5 text-amber-400" />
                  <span className="font-medium">{emailNotice}</span>
                </div>
              )}

              <div className="grid gap-2">
                <label className="text-xs font-semibold text-foreground text-center">
                  Enter the 6-Digit Code Received in Your Email
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  required
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
                  onClick={() => setStep(1)}
                  className="h-10 text-xs px-3"
                >
                  <ArrowLeft className="size-3.5 mr-1" /> Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={busy || lockedSeconds > 0 || otp.length < 6}
                  className="flex-1 font-semibold h-10"
                >
                  {busy ? 'Verifying Code…' : 'Verify Email Code →'}
                </Button>
              </div>

              <div className="text-center mt-2">
                <button
                  type="button"
                  disabled={busy || resendCooldown > 0}
                  onClick={handleStep1Submit}
                  className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1"
                >
                  <RefreshCw className={cn('size-3', busy && 'animate-spin')} />
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive code? Resend Email"}
                </button>
              </div>
            </form>
          )}

          {/* Security Features Badges */}
          <div className="mt-6 pt-3.5 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success shrink-0" /> Real-time Email Verification
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-success shrink-0" /> Zero-Knowledge Audit Trail
            </span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card/40 backdrop-blur-md px-4 py-3 text-center text-xs text-muted-foreground">
        <p>TrustVault Academic Verification · SHA-256 Tamper-Evident Ledger</p>
      </footer>
    </div>
  );
}
