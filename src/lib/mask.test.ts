import { describe, expect, it } from 'vitest';
import { maskApiKey } from './mask';

describe('maskApiKey', () => {
  it('shows only the last four characters', () => {
    const masked = maskApiKey('sk-ant-api03-SECRETSECRET-3f9a');
    expect(masked).toBe('••••••••3f9a');
    expect(masked).not.toContain('SECRET');
  });

  it('shows nothing of a short key, and nothing for no key', () => {
    expect(maskApiKey('abcd1234')).toBe('••••••••');
    expect(maskApiKey('  ')).toBe('');
  });
});
