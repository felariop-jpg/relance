import { describe, expect, it } from 'vitest';
import { inputPlaceholders, needsInput } from './needsInput';

describe('placeholders needing input', () => {
  it('finds bracketed placeholders in either language', () => {
    expect(inputPlaceholders('Le livre, [TITRE DU LIVRE], est court. [TITRE DU LIVRE]')).toEqual(['[TITRE DU LIVRE]']);
    expect(inputPlaceholders('Yes: [YOUR ANSWER ABOUT REMOTE TEAMS].')).toEqual(['[YOUR ANSWER ABOUT REMOTE TEAMS]']);
  });
  it('ignores text without brackets, {{tokens}} and bracketed numbers', () => {
    expect(needsInput({ subject: 'Hello', body: 'Hi {{firstName}},\n\nSee note [1].\n{{signature}}' })).toBe(false);
    expect(needsInput({ subject: '[NAME OF THE EVENT] follow-up', body: '' })).toBe(true);
  });
});
