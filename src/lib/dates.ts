/** Today as YYYY-MM-DD in the user's own time zone. */
export function todayIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function build(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/;
const NUMERIC = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/;

/**
 * Day-first unless some value proves the column is month-first
 * (second number above 12, e.g. 03/25/2024).
 */
export function detectDayFirst(values: string[]): boolean {
  for (const raw of values) {
    const m = NUMERIC.exec(raw.trim());
    if (!m) continue;
    if (Number(m[1]) > 12) return true;
    if (Number(m[2]) > 12) return false;
  }
  return true;
}

export function parseDate(raw: string, dayFirst = true): string | null {
  const value = raw.trim();
  if (!value) return null;
  const iso = ISO.exec(value);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const num = NUMERIC.exec(value);
  if (num) {
    const a = Number(num[1]);
    const b = Number(num[2]);
    const year = Number(num[3]);
    return dayFirst ? build(year, b, a) : build(year, a, b);
  }
  return null;
}

/** Empty, or a real date from 1900 on (guards against half-typed years like 0002). */
export function isPlausibleDate(iso: string | null): boolean {
  if (!iso) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m !== null && Number(m[1]) >= 1900 && build(Number(m[1]), Number(m[2]), Number(m[3])) === iso;
}

export function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(y, m - 1, d));
}

/** "3 months ago", "il y a 2 semaines", "yesterday". */
export function formatSince(days: number, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (days < 14) return rtf.format(-days, 'day');
  if (days < 60) return rtf.format(-Math.round(days / 7), 'week');
  if (days < 730) return rtf.format(-Math.round(days / 30.4), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}

export function monthName(month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2000, month - 1, 1));
}

/** A month a little in the past, e.g. "March 2026", for examples that must never look stale. */
export function recentMonthYear(locale: string, today = new Date()): string {
  const date = new Date(today.getFullYear(), today.getMonth() - 2, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}
