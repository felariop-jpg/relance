// Dev helper: deep-merges a JSON patch {en:{...}, fr:{...}} into the locale files.
// A value of null deletes the key. Usage: node scripts/i18n-merge.mjs patch.json
import { readFileSync, writeFileSync } from 'node:fs';

const patch = JSON.parse(readFileSync(process.argv[2], 'utf8'));
function merge(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (v === null) delete target[k];
    else if (typeof v === 'object' && !Array.isArray(v)) merge((target[k] ??= {}), v);
    else target[k] = v;
  }
}
for (const lang of Object.keys(patch)) {
  const path = `src/i18n/locales/${lang}.json`;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  merge(data, patch[lang]);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}
