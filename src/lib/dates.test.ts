import { describe, expect, it } from 'vitest';
import { detectDayFirst, isPlausibleDate, parseDate, todayIso } from './dates';

describe('parseDate', () => {
  it('reads ISO dates, with or without a time', () => {
    expect(parseDate('2025-03-07')).toBe('2025-03-07');
    expect(parseDate('2025-3-7')).toBe('2025-03-07');
    expect(parseDate('2025-03-07T10:00:00Z')).toBe('2025-03-07');
  });

  it('reads day-first dates by default', () => {
    expect(parseDate('07/03/2025')).toBe('2025-03-07');
    expect(parseDate('7.3.2025')).toBe('2025-03-07');
    expect(parseDate('07-03-25')).toBe('2025-03-07');
  });

  it('reads month-first dates when told to', () => {
    expect(parseDate('03/07/2025', false)).toBe('2025-03-07');
  });

  it('rejects impossible and unreadable dates', () => {
    expect(parseDate('31/02/2025')).toBeNull();
    expect(parseDate('2025-13-01')).toBeNull();
    expect(parseDate('last spring')).toBeNull();
    expect(parseDate('')).toBeNull();
  });
});

describe('detectDayFirst', () => {
  it('defaults to day-first when ambiguous', () => {
    expect(detectDayFirst(['01/02/2025', '03/04/2025'])).toBe(true);
  });
  it('detects day-first from a day above 12', () => {
    expect(detectDayFirst(['01/02/2025', '25/03/2025'])).toBe(true);
  });
  it('detects month-first from a second number above 12', () => {
    expect(detectDayFirst(['01/02/2025', '03/25/2025'])).toBe(false);
  });
});

describe('todayIso', () => {
  it('uses the local calendar date', () => {
    expect(todayIso(new Date(2025, 0, 5, 23, 30))).toBe('2025-01-05');
  });
});

describe('isPlausibleDate', () => {
  it('accepts empty and real dates from 1900', () => {
    expect(isPlausibleDate(null)).toBe(true);
    expect(isPlausibleDate('')).toBe(true);
    expect(isPlausibleDate('2025-09-15')).toBe(true);
  });
  it('rejects half-typed years and impossible dates', () => {
    expect(isPlausibleDate('0002-09-15')).toBe(false);
    expect(isPlausibleDate('2025-02-30')).toBe(false);
  });
});
