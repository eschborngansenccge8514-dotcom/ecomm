'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center p-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
        <AlertCircle className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">Something went wrong!</h2>
      <p className="text-muted-foreground max-w-[500px] mb-8">
        An unexpected error occurred while loading this section of the dashboard. 
        Please try again or contact support if the problem persists.
      </p>
      <div className="flex items-center gap-4">
        <Button
          variant="default"
          size="lg"
          onClick={() => reset()}
          className="gap-2"
        >
          <RefreshCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => window.location.reload()}
        >
          Full Reload
        </Button>
      </div>
      {error.digest && (
        <p className="mt-8 text-xs text-muted-foreground/50 font-mono">
          Error ID: {error.digest}
        </p>
      )}
    </div>
  );
}
