// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import '../i18n';
import { HelpTip } from './HelpTip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('HelpTip', () => {
  it('is a labelled button that shows and hides its explanation', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(HelpTip, { topic: 'Left open', children: 'What belongs here.' })));
    const button = host.querySelector('button')!;
    const panel = host.querySelector('[role=note]') as HTMLElement;
    expect(button.getAttribute('aria-label')).toBe('More about “Left open”');
    expect(button.getAttribute('aria-controls')).toBe(panel.id);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    // jsdom has no popover support, so this is the inline fallback.
    expect(panel.hidden).toBe(true);
    act(() => button.click());
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(panel.textContent).toBe('What belongs here.');
    act(() => root.unmount());
    host.remove();
  });
});
