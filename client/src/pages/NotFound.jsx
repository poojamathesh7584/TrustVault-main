import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, FileQuestion } from 'lucide-react';
import { Brand } from '@/components/app/brand';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <Brand to="/welcome" />
        <Button asChild size="sm" variant="outline">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>
      <main className="flex flex-col items-center justify-center p-6 text-center">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground mb-4">
          <FileQuestion className="size-8" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Page not found (404)</h1>
        <p className="max-w-md text-sm text-muted-foreground mb-6">
          The requested path <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{pathname}</code> does not exist or has been moved.
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/">
              Go to Dashboard <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/welcome">Home</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
