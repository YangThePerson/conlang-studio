'use client';

import { useEffect } from 'react';
import { Button } from '@/app/components/ui/button';

/** Error boundary scoped to a single language's subroutes — the sidebar (from the layout above it) stays usable. */
export default function LanguageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md">
        This section ran into an unexpected error. Try again, or pick another
        section from the sidebar.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
