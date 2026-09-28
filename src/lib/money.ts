import type { TFunction } from 'i18next';

export function formatEur(amount: number, locale: string, t: TFunction): string {
  const fmt = (n: number, digits: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  if (amount > 0 && amount < 0.01) return t('money.lessThanCent', { amount: fmt(0.01, 2) });
  return fmt(amount, 2);
}
