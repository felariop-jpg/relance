import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import fr from './locales/fr.json';

const PLURAL = /_(zero|one|two|few|many|other)$/;

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const baseKeys = (obj: object) => [...new Set(keys(obj).map((k) => k.replace(PLURAL, '')))].sort();

describe('translations', () => {
  it('English and French define the same keys', () => {
    expect(baseKeys(fr)).toEqual(baseKeys(en));
  });

  it('French defines every plural form it needs', () => {
    const frKeys = new Set(keys(fr));
    for (const key of keys(fr).filter((k) => k.endsWith('_other'))) {
      const stem = key.replace(/_other$/, '');
      expect(frKeys.has(`${stem}_one`), `${stem}_one`).toBe(true);
      expect(frKeys.has(`${stem}_many`), `${stem}_many`).toBe(true);
    }
  });

  it('has no empty strings', () => {
    const empty = (obj: object) =>
      keys(obj).filter((k) => k.split('.').reduce<any>((o, p) => o[p], obj) === '');
    expect(empty(en)).toEqual([]);
    expect(empty(fr)).toEqual([]);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

describe('components', () => {
  // Guard for hard constraint 5: no user-facing text written directly in JSX.
  it('contain no hardcoded user-facing text', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      const source = readFileSync(file, 'utf8');
      source.split('\n').forEach((line, i) => {
        const jsxText = /^\s*[A-Za-zÀ-ÿ][^<>{}=;()]*$/.test(line) && /<\/?[A-Za-z]/.test(source);
        const inlineText = />\s*[A-Za-zÀ-ÿ][^<>{}]*</.test(line);
        const attrText = /\b(placeholder|aria-label|title|alt|label)="[^"]*[A-Za-z]/.test(line);
        if ((jsxText && isInsideJsx(source, i)) || inlineText || attrText) {
          offenders.push(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

/** Rough check: a bare-text line sits between a JSX tag line and a closing tag line. */
function isInsideJsx(source: string, lineIndex: number): boolean {
  const lines = source.split('\n');
  const prev = lines[lineIndex - 1]?.trim() ?? '';
  const next = lines[lineIndex + 1]?.trim() ?? '';
  return prev.endsWith('>') && next.startsWith('<');
}
