import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../relative-time';

const NOW = new Date('2026-07-18T12:00:00Z');

/** Shifts NOW backwards by the given number of seconds. */
function ago(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

describe('formatRelativeTime', () => {
  it('collapses sub-minute differences to "just now"', () => {
    expect(formatRelativeTime(NOW, NOW)).toBe('just now');
    expect(formatRelativeTime(ago(59), NOW)).toBe('just now');
    // Small future skew (DB clock ahead of app server) must not read "in X seconds".
    expect(formatRelativeTime(ago(-30), NOW)).toBe('just now');
  });

  it('formats minutes and hours', () => {
    expect(formatRelativeTime(ago(60), NOW)).toBe('1 minute ago');
    expect(formatRelativeTime(ago(45 * 60), NOW)).toBe('45 minutes ago');
    expect(formatRelativeTime(ago(3 * 3600), NOW)).toBe('3 hours ago');
  });

  it('uses natural day words where Intl provides them', () => {
    expect(formatRelativeTime(ago(24 * 3600), NOW)).toBe('yesterday');
    expect(formatRelativeTime(ago(2 * 24 * 3600), NOW)).toBe('2 days ago');
  });

  it('rolls over to weeks, months, and years', () => {
    expect(formatRelativeTime(ago(10 * 24 * 3600), NOW)).toBe('last week');
    expect(formatRelativeTime(ago(40 * 24 * 3600), NOW)).toBe('last month');
    expect(formatRelativeTime(ago(2 * 365 * 24 * 3600), NOW)).toBe('2 years ago');
  });
});
