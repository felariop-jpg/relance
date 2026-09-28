import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, rewriteLinks } from './docs-plugin';

describe('guide links on the published site', () => {
  it('turn .md links into the .html pages', () => {
    expect(rewriteLinks('[a](api-key.md) [b](api-key.fr.md) [c](../PRIVACY.md) [d](docs/templates.md#placeholders) [e](../PRIVACY.fr.md)')).toBe(
      '[a](api-key.html) [b](api-key.fr.html) [c](privacy.html) [d](templates.html#placeholders) [e](privacy.fr.html)',
    );
  });
  it('leave other links alone', () => {
    expect(rewriteLinks('[x](https://example.com) ![s](screenshots/a.jpg)')).toBe('[x](https://example.com) ![s](screenshots/a.jpg)');
  });
});

describe('published guides', () => {
  it('all exist, including the handover and the index', () => {
    for (const [source] of PAGES) expect(existsSync(source), source).toBe(true);
    expect(PAGES.map(([, page]) => page)).toEqual(expect.arrayContaining(['index', 'handover', 'handover.fr']));
  });

  it('keep the handover short enough for one side of A4', () => {
    for (const file of ['docs/handover.md', 'docs/handover.fr.md']) {
      const words = readFileSync(file, 'utf8').split(/\s+/).filter(Boolean).length;
      expect(words, file).toBeLessThan(620);
    }
  });
});
