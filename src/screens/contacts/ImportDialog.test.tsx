// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { db } from '../../db/db';
import { ensureSettings } from '../../db/settings';
import { ImportDialog } from './ImportDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no <dialog> methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
};

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
  await i18n.changeLanguage('en');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(createElement(ImportDialog, { onClose: () => {} })));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const t = i18n.t.bind(i18n);
const text = () => document.querySelector('dialog')?.textContent ?? '';

async function until(check: () => boolean) {
  for (let i = 0; i < 50 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 10)));
  expect(check()).toBe(true);
}

async function chooseFile(content: string) {
  const input = document.querySelector<HTMLInputElement>('dialog input[type=file]')!;
  const file = new File([content], 'contacts.csv', { type: 'text/csv' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('dialog button')].find((b) => b.textContent === label);

describe('ImportDialog', () => {
  it('skips the column screen for a recognised file, and still waits for Import', async () => {
    await chooseFile('First name,Email,Company\nAnn,ann@example.com,Example Co\nBo,bo@example.com,\n');
    await until(() => text().includes(t('import.recognised')));
    expect(text()).toContain(t('import.ready', { count: 2 }));
    expect(document.querySelector('dialog select')).toBeNull();
    expect(button(t('import.importButton', { count: 2 }))).toBeDefined();
    expect(await db.contacts.count()).toBe(0);

    await act(async () => button(t('import.adjustColumns'))!.click());
    expect(document.querySelectorAll('dialog table select')).toHaveLength(3);
    expect(text()).not.toContain(t('import.ai.offer'));
  });

  it('offers AI matching for an unrecognised file, sending nothing without a key', async () => {
    await chooseFile('Qui,Courrier perso\nAnn Tester,ann@example.com\n');
    await until(() => text().includes(t('import.ai.offer')));
    expect(document.querySelectorAll('dialog table select')).toHaveLength(2);
    expect(button(t('import.ai.match'))?.disabled).toBe(true);
    expect(text()).toContain(t('import.ai.needsKey'));

    // The preview of what would be sent has headings and shapes only.
    const preview = document.querySelector('dialog pre')?.textContent ?? '';
    expect(preview).toContain('Courrier perso');
    expect(preview).toContain('email-like');
    expect(preview).not.toMatch(/Tester|ann@example\.com/);

    await act(async () => button(t('import.ai.decline'))!.click());
    expect(text()).not.toContain(t('import.ai.offer'));
    expect(await db.contacts.count()).toBe(0);
  });
});
