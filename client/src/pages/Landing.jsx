import { Link } from 'react-router-dom';
import {
  ShieldCheck, Lock, CheckCircle2, ArrowRight,
  GraduationCap, Users, Building2, FileCheck, History
} from 'lucide-react';
import { Brand } from '@/components/app/brand';
import { ThemeToggle } from '@/components/app/account';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Brand to="/welcome" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to="/login">
                Sign In <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 sm:py-28 px-4 sm:px-6 text-center">
        <div className="container mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-medium text-primary mb-6">
            <ShieldCheck className="size-3.5" />
            Secure Document Verification
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-foreground leading-tight mb-6">
            Digital Identity & <br />
            <span className="text-primary">Document Verification</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
            Upload, verify, and share identity and academic records safely with end-to-end AES-256 encryption, rule-based validation, and tamper-evident audit trails.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-11 px-6 font-semibold">
              <Link to="/login">
                Get Started <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 font-semibold">
              <Link to="/login">
                ⚡ 1-Click Demo Logins
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 3 Core Highlights */}
      <section className="py-12 border-t border-border bg-muted/20 px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl grid md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Lock className="size-4.5" />
            </div>
            <h3 className="font-semibold text-base mb-1">AES-256 Encryption</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every document is encrypted before saving. Personal details like Aadhaar numbers are automatically masked.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <FileCheck className="size-4.5" />
            </div>
            <h3 className="font-semibold text-base mb-1">Automated Validation</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Verhoeff checksums for Aadhaar, regex formatting for PAN, and OCR checks verify credentials automatically.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <History className="size-4.5" />
            </div>
            <h3 className="font-semibold text-base mb-1">Audit Ledger</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every upload, verification, and access event is recorded in a tamper-evident SHA-256 cryptographic chain.
            </p>
          </div>
        </div>
      </section>

      {/* Role Overview */}
      <section className="py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">User Portals</h2>
            <p className="text-sm text-muted-foreground">Select your role to access features tailored to your workflow.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
              <div>
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <GraduationCap className="size-4.5" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Student</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Manage personal credentials and share with faculty securely.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Upload PAN, Aadhaar & marksheets</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Automated verification score</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Time-limited consent sharing</li>
                </ul>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/login?as=student">Student Sign In</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-primary/40 bg-primary/5 p-6 flex flex-col justify-between">
              <div>
                <div className="size-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-3">
                  <Users className="size-4.5" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Faculty</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Request and review verified student documents.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Batch student record lookup</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Request required certificates</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Approve / reject verification</li>
                </ul>
              </div>
              <Button asChild size="sm" className="w-full">
                <Link to="/login?as=faculty">Faculty Sign In</Link>
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between">
              <div>
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Building2 className="size-4.5" />
                </div>
                <h3 className="font-semibold text-lg mb-1">Administrator</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  System-wide oversight, security logs, and user management.
                </p>
                <ul className="space-y-2 text-xs text-muted-foreground mb-6">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> Real-time activity log</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> SHA-256 ledger integrity check</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-primary shrink-0" /> User access & account management</li>
                </ul>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/login?as=admin">Admin Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Simple CTA */}
      <section className="py-12 px-4 sm:px-6 border-t border-border bg-muted/20 text-center">
        <div className="container mx-auto max-w-xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Ready to explore?</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mb-6">
            Use 1-Click Demo Login to switch between Student, Faculty, and Admin views instantly.
          </p>
          <Button asChild className="h-10 px-6 font-medium">
            <Link to="/login">
              Open Portal <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-6 px-4 sm:px-6 text-center text-xs text-muted-foreground">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl">
          <p>TrustVault · Smart Digital Identity & Document Verification Portal</p>
          <p>Secure · Encrypted · Tamper-Evident</p>
        </div>
      </footer>
    </div>
  );
}
