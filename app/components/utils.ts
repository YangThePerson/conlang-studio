import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges class values with Tailwind-aware conflict resolution — later classes
 * win over earlier ones of the same utility group (e.g. a caller's `w-20`
 * beats a component's default `w-full`). Lives in `app/components/`, not
 * `app/lib/`, because `app/lib/` is the server-only service layer and this
 * must be importable from Client Components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
