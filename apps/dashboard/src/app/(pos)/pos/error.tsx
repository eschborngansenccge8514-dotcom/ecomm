'use client';

import { ErrorView } from "@/components/dashboard/ErrorView";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <ErrorView error={error} reset={reset} />
    </div>
  );
}
