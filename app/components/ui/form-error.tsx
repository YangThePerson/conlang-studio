import { cn } from '@/app/components/utils';

/**
 * Renders nothing when `message` is falsy, so call sites can pass the result
 * of `failureMessage`/`fieldError` (from `app/components/action-state`)
 * straight through without an `&&` guard.
 */
function FormError({
  message,
  className,
}: {
  message: string | null | undefined;
  className?: string;
}) {
  if (!message) return null;

  return (
    <p data-slot="form-error" className={cn('text-red-400 text-sm', className)}>
      {message}
    </p>
  );
}

export { FormError };
