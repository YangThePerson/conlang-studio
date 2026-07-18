/**
 * Pure relative-time formatting for timestamps shown in the UI ("4 minutes
 * ago", "yesterday", "3 weeks ago"). No DB or framework imports — unit-tested
 * like the other pure domain modules.
 */

/**
 * Successive unit divisions for `Intl.RelativeTimeFormat`: a value is divided
 * by `amount` to move to the next unit once it no longer fits the current one.
 * Weeks/months use average lengths — fine at the granularity these strings
 * are read at.
 */
const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

const FORMATTER = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Formats `date` relative to `now` (injectable for tests; defaults to the
 * current time). Sub-minute differences — including small negative ones from
 * clock skew between the DB and the app server — collapse to "just now"
 * rather than surfacing "in 3 seconds".
 */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  let delta = (date.getTime() - now.getTime()) / 1000;
  if (delta > -60 && delta < 60) return 'just now';

  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(delta) < amount) {
      return FORMATTER.format(Math.round(delta), unit);
    }
    delta /= amount;
  }
  /* v8 ignore next 2 -- unreachable: the year division accepts any finite delta */
  throw new Error('unreachable');
}
