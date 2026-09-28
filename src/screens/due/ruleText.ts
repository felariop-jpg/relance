import type { TFunction } from 'i18next';
import type { ScheduleRule, Template } from '../../db/schema';
import { monthName } from '../../lib/dates';

/** "Sent in September to clients or prospects not contacted for at least 60 days." */
export function ruleText(rule: ScheduleRule, appliesTo: Template['appliesTo'], locale: string, t: TFunction): string {
  const month = monthName(rule.month, locale);
  const days = rule.minGapDays;
  if (appliesTo.length === 0) {
    return days > 0 ? t('due.ruleAll', { month, days }) : t('due.ruleAllNoGap', { month });
  }
  const audience = appliesTo.map((type) => t(`contactTypesPlural.${type}`)).join(t('due.audienceJoin'));
  return days > 0 ? t('due.rule', { month, days, audience }) : t('due.ruleNoGap', { month, audience });
}
