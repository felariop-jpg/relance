import { describe, expect, it } from 'vitest';
import { rewriteLinks } from './docs-plugin';

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
