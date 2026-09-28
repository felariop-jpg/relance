import { useTranslation } from 'react-i18next';
import { estimateCostEur } from '../../ai/model';
import { formatEur } from '../../lib/money';

export type Method = 'ai' | 'template';

/** "With AI" (or demo when there is no key) vs "template text as it is", with the cost line. */
export function MethodPicker({
  method,
  onChange,
  demo,
  count,
}: {
  method: Method;
  onChange: (m: Method) => void;
  demo: boolean;
  count: number;
}) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">{t('create.method')}</legend>
        {(['ai', 'template'] as const).map((value) => (
          <label
            key={value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-300 p-3 has-[:checked]:border-accent-600 has-[:checked]:bg-accent-50"
          >
            <input
              type="radio"
              name="method"
              className="mt-1 accent-accent-700"
              checked={method === value}
              onChange={() => onChange(value)}
            />
            <span>
              <span className="block font-medium">
                {value === 'template' ? t('create.methodTemplate') : demo ? t('create.methodDemo') : t('create.methodAi')}
              </span>
              <span className="block text-sm text-stone-600">
                {value === 'template'
                  ? t('create.methodTemplateHint')
                  : demo
                    ? t('create.methodDemoHint')
                    : t('create.methodAiHint')}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700" aria-live="polite">
        {method === 'ai' && !demo
          ? t('create.estimate', { count, cost: formatEur(estimateCostEur(count), i18n.language, t) })
          : t('create.free')}
      </p>
    </>
  );
}
