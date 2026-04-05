'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorViewProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  className?: string;
}

export function ErrorView({ 
  error, 
  reset, 
  title = "Something went wrong!",
  className
}: ErrorViewProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={cn("flex flex-col items-center justify-center p-4 text-center min-h-[400px]", className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h3 className="text-xl font-semibold tracking-tight mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-[400px] mb-6 text-sm">
        An unexpected error occurred while loading this section. 
        Please try again.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => reset()}
          className="gap-2"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
      {error.digest && (
        <p className="mt-6 text-[10px] text-muted-foreground/40 font-mono">
          ID: {error.digest}
        </p>
      )}
    </div>
  );
}
