import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { AutoTextarea } from '../../components/AutoTextarea';
import { Button } from '../../components/Button';
import { inputClass } from '../../components/Field';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_MAX_CHARS } from '../../db/schema';
import { Section } from './Section';
import { useSettingDraft } from './useSettingDraft';

export function VoiceSection() {
  const { t } = useTranslation();
  const id = useId();
  const [samples, setSamples, flush] = useSettingDraft('voiceSamples');

  const update = (index: number, text: string) =>
    setSamples(samples.map((s, i) => (i === index ? text.slice(0, VOICE_SAMPLE_MAX_CHARS) : s)));

  return (
    <Section id="voice" title={t('settings.voice.title')} description={<p>{t('settings.voice.body')}</p>}>
      <div className="space-y-4">
        {samples.length === 0 && <p className="text-sm text-stone-500">{t('settings.voice.empty')}</p>}
        {samples.map((sample, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor={`${id}-${i}`} className="text-sm font-medium">
                {t('settings.voice.sample', { n: i + 1 })}
              </label>
              <button
                type="button"
                onClick={() => setSamples(samples.filter((_, j) => j !== i))}
                aria-label={t('settings.voice.remove', { n: i + 1 })}
                className="rounded p-1.5 text-stone-500 hover:bg-stone-100 hover:text-red-700"
              >
                <TrashIcon />
              </button>
            </div>
            <AutoTextarea
              id={`${id}-${i}`}
              rows={5}
              maxLength={VOICE_SAMPLE_MAX_CHARS}
              className={`${inputClass} resize-none`}
              value={sample}
              onChange={(e) => update(i, e.target.value)}
              onBlur={flush}
              aria-describedby={`${id}-${i}-count`}
            />
            <p
              id={`${id}-${i}-count`}
              className={`mt-1 text-right text-xs ${sample.length >= VOICE_SAMPLE_MAX_CHARS ? 'font-medium text-amber-800' : 'text-stone-500'}`}
            >
              {t('settings.voice.count', { count: sample.length, max: VOICE_SAMPLE_MAX_CHARS })}
            </p>
          </div>
        ))}
        {samples.length < VOICE_SAMPLE_LIMIT && (
          <Button onClick={() => setSamples([...samples, ''])}>
            <PlusIcon />
            {t('settings.voice.add')}
          </Button>
        )}
      </div>
    </Section>
  );
}
