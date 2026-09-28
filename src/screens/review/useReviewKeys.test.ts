// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useReviewKeys, type ReviewKeyActions } from './useReviewKeys';

function mount(actions: ReviewKeyActions) {
  function Probe() {
    useReviewKeys(actions);
    return createElement('div', null, createElement('textarea', { id: 'body' }), createElement('input', { id: 'subject' }));
  }
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(createElement(Probe)));
  return () => {
    act(() => root.unmount());
    host.remove();
  };
}

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

function spies(): ReviewKeyActions {
  return { move: vi.fn(), approve: vi.fn(), skip: vi.fn(), edit: vi.fn(), rewrite: vi.fn(), help: vi.fn(), leaveField: vi.fn() };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('review keyboard shortcuts', () => {
  it('maps j/k/a/s/e/r/?', () => {
    const a = spies();
    const unmount = mount(a);
    for (const key of ['j', 'k', 'a', 's', 'e', 'r', '?']) press(key);
    expect(a.move).toHaveBeenNthCalledWith(1, 1);
    expect(a.move).toHaveBeenNthCalledWith(2, -1);
    for (const fn of [a.approve, a.skip, a.edit, a.rewrite, a.help]) expect(fn).toHaveBeenCalledOnce();
    unmount();
  });

  it('is paused while typing in a field, and Esc leaves the field', () => {
    const a = spies();
    const unmount = mount(a);
    const body = document.getElementById('body') as HTMLTextAreaElement;
    body.focus();
    for (const key of ['j', 'a', 's', 'r']) press(key, body);
    expect(a.move).not.toHaveBeenCalled();
    expect(a.approve).not.toHaveBeenCalled();
    press('Escape', body);
    expect(a.leaveField).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(body);
    unmount();
  });

  it('ignores keys with modifiers and while a dialog is open', () => {
    const a = spies();
    const unmount = mount(a);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }));
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);
    press('a');
    expect(a.approve).not.toHaveBeenCalled();
    dialog.remove();
    unmount();
  });
});
