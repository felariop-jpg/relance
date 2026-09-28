/**
 * Fixture dates are written relative to the snapshot date, so the fixtures never
 * go stale and a rerun with the pinned date gives the model exactly the same data.
 *
 *   {year}      the snapshot date's year        {year-2}   two years before it
 *   {date-30}   30 days before, as YYYY-MM-DD   {date-17:fr}  the same, written out in French
 */
const TOKEN = /\{(year|date)(?:-(\d+))?(?::(en|fr))?\}/g;

function shift(snapshotDate: string, days: number): Date {
  const [y, m, d] = snapshotDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - days));
}

function resolveString(text: string, snapshotDate: string): string {
  return text.replace(TOKEN, (_, kind: string, n: string | undefined, lang: string | undefined) => {
    const offset = Number(n ?? 0);
    if (kind === 'year') return String(Number(snapshotDate.slice(0, 4)) - offset);
    const date = shift(snapshotDate, offset);
    if (lang) {
      return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
    }
    return date.toISOString().slice(0, 10);
  });
}

export function resolveFixtureDates<T>(value: T, snapshotDate: string): T {
  if (typeof value === 'string') return resolveString(value, snapshotDate) as T;
  if (Array.isArray(value)) return value.map((v) => resolveFixtureDates(v, snapshotDate)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, resolveFixtureDates(v, snapshotDate)]),
    ) as T;
  }
  return value;
}
