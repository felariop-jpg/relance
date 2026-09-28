// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { db } from '../../db/db';
import { defaultSettings } from '../../db/settings';
import { ContactForm } from './ContactForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
};

function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const firstName = () => document.querySelector('dialog input[id$="-firstName"]') as HTMLInputElement;
const button = (label: string) => [...document.querySelectorAll('dialog button')].find((b) => b.textContent === label) as HTMLButtonElement;
const settle = () => act(async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 5)); });

beforeEach(async () => {
  await db.contacts.clear();
});

describe('ContactForm, adding several contacts in a row', () => {
  it('"Save and add another" saves, clears the form and keeps it open; Save closes it', async () => {
    let closed = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        createElement(ContactForm, {
          contact: null,
          settings: defaultSettings('en'),
          onClose: () => closed++,
          onDiscard: () => closed++,
          onDeleteRequest: () => {},
        }),
      ),
    );

    // The dialog starts in First name, so typing straight away works.
    expect(document.activeElement).toBe(firstName());
    act(() => type(firstName(), 'Ann'));
    act(() => button('Save and add another').click());
    await settle();
    expect(await db.contacts.count()).toBe(1);
    expect(closed).toBe(0);
    expect(firstName().value).toBe('');
    expect(document.activeElement).toBe(firstName());
    expect(document.querySelector('dialog [role=status]')?.textContent).toContain('Ann is saved');

    act(() => type(firstName(), 'Ben'));
    act(() => button('Save').click());
    await settle();
    expect((await db.contacts.toArray()).map((c) => c.firstName).sort()).toEqual(['Ann', 'Ben']);
    expect(closed).toBe(1);

    act(() => root.unmount());
    host.remove();
  });

  it('still requires a first name before saving and adding another', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        createElement(ContactForm, {
          contact: null,
          settings: defaultSettings('en'),
          onClose: () => {},
          onDiscard: () => {},
          onDeleteRequest: () => {},
        }),
      ),
    );
    act(() => button('Save and add another').click());
    await settle();
    expect(await db.contacts.count()).toBe(0);
    expect(document.body.textContent).toContain('Enter a first name.');
    act(() => root.unmount());
    host.remove();
  });
});
