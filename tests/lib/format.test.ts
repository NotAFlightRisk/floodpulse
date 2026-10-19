import { describe, expect, it } from 'vitest';
import { ago, date, signed, stale } from '../../src/lib/format.ts';

const now = Date.parse('2026-10-19T15:00:00Z');

describe('ago', () => {
  it('reads minutes, then hours, then days', () => {
    expect(ago('2026-10-19T14:59:30Z', now)).toBe('just now');
    expect(ago('2026-10-19T14:15:00Z', now)).toBe('45 min ago');
    expect(ago('2026-10-19T14:00:00Z', now)).toBe('1 hour ago');
    expect(ago('2026-10-16T15:00:00Z', now)).toBe('3 days ago');
  });

  it("treats the EA's zoneless record dates as UTC", () => {
    expect(ago('2026-10-19T14:00:00', now)).toBe('1 hour ago');
    expect(date('2026-10-18T23:30:00')).toBe('19 Oct 2026');
  });
});

describe('stale', () => {
  it('gives up on a gauge after two hours, or one with no reading at all', () => {
    expect(stale('2026-10-19T13:30:00Z', now)).toBe(false);
    expect(stale('2026-10-19T12:30:00Z', now)).toBe(true);
    expect(stale(undefined, now)).toBe(true);
  });
});

describe('signed', () => {
  it('always shows which way it went', () => {
    expect(signed(0.123)).toBe('+0.12 m');
    expect(signed(-0.04)).toBe('-0.04 m');
    expect(signed(0)).toBe('0.00 m');
  });
});
