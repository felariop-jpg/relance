// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Menu } from './Menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Menu', () => {
  it('opens on click, closes on Escape and gives focus back to its button', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        createElement(Menu, {
          button: '?',
          buttonLabel: 'Help',
          children: () => createElement('a', { href: '#x' }, 'Guide'),
        }),
      ),
    );
    const button = host.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Help');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    act(() => button.click());
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const link = host.querySelector('a')!;
    link.focus();
    act(() => void link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('a')).toBeNull();
    expect(document.activeElement).toBe(button);
    act(() => root.unmount());
    host.remove();
  });
});
