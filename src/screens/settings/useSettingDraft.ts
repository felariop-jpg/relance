import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../../db/schema';
import { updateSettings, useSettings } from '../../db/settings';

const SAVE_DELAY_MS = 400;

/**
 * Local state for a settings field that saves itself shortly after typing
 * stops (and on flush), without the cursor jumping when the stored value echoes back.
 */
export function useSettingDraft<K extends Exclude<keyof Settings, 'id'>>(
  key: K,
): [Settings[K], (value: Settings[K]) => void, () => void] {
  const settings = useSettings();
  const stored = settings[key];
  const [value, setValue] = useState<Settings[K]>(stored);
  const latest = useRef(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirty.current) {
      latest.current = stored;
      setValue(stored);
    }
  }, [stored]);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!dirty.current) return;
    void updateSettings({ [key]: latest.current } as Partial<Settings>).then(() => {
      dirty.current = false;
    });
  };

  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (next: Settings[K]) => {
    dirty.current = true;
    latest.current = next;
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  return [value, set, flush];
}
