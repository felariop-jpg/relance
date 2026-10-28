// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it } from 'vitest';
import '../i18n';
import { db } from '../db/db';
import { addContact, emptyContact } from '../db/contacts';
import { ensureSettings, getSettings } from '../db/settings';
import { Tour } from './Tour';
import { goTo, startTour, tourSnapshot } from './tourState';
import { loadSampleContacts } from '../lib/sample';
import { ensureTemplatesSeeded } from '../db/templates';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const settle = () => act(async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 10)); });
const key = (k: string, target: EventTarget = document.activeElement ?? document.body) =>
  act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await ensureSettings();
  await addContact({ ...emptyContact(), firstName: 'Ann' });
});

async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => startTour());
  act(() => root.render(createElement(Tour)));
  await settle();
  return () => {
    act(() => root.unmount());
    host.remove();
  };
}

describe('Tour', () => {
  it('is a non-modal card, labelled, with Skip on every step but the last', async () => {
    const unmount = await mount();
    const card = document.querySelector('[role=dialog]')!;
    expect(card.getAttribute('aria-modal')).toBe('false');
    expect(document.getElementById(card.getAttribute('aria-labelledby')!)?.textContent).toBe('Your starting page');
    expect(card.textContent).toContain('Skip tour');
    expect(card.textContent).toContain('Step 1 of 6');
    unmount();
  });

  it('moves on with the arrow keys and Enter, and back with the left arrow', async () => {
    const unmount = await mount();
    await key('ArrowRight');
    await settle();
    expect(tourSnapshot().index).toBe(1);
    await key('ArrowLeft');
    await settle();
    expect(tourSnapshot().index).toBe(0);
    (document.getElementById('tour-title') as HTMLElement).focus();
    await key('Enter');
    await settle();
    expect(tourSnapshot().index).toBe(1);
    unmount();
  });

  it('ignores arrow keys while the user is typing elsewhere', async () => {
    const unmount = await mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    await key('ArrowRight', input);
    expect(tourSnapshot().index).toBe(0);
    input.remove();
    unmount();
  });

  it('skips on Escape, and remembers it', async () => {
    const unmount = await mount();
    await key('Escape');
    await settle();
    expect(tourSnapshot().active).toBe(false);
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect((await getSettings()).tourState).toBe('skipped');
    unmount();
  });

  it('ends by offering to clear the sample contacts, and does it on Enter', async () => {
    await ensureTemplatesSeeded();
    await loadSampleContacts(new Date(2026, 8, 28));
    const unmount = await mount();
    act(() => goTo(tourSnapshot().steps.length - 1));
    await settle();
    const finish = [...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent === 'Finish') as HTMLButtonElement;
    act(() => finish.click());
    await settle();
    expect(document.getElementById('tour-title')?.textContent).toBe('Start with your own contacts?');
    expect(tourSnapshot().active).toBe(true);
    (document.getElementById('tour-title') as HTMLElement).focus();
    await key('Enter');
    await settle();
    expect(tourSnapshot().active).toBe(false);
    expect((await db.contacts.toArray()).map((c) => c.firstName)).toEqual(['Ann']);
    expect(window.location.hash).toBe('#/contacts');
    expect((await getSettings()).tourState).toBe('finished');
    unmount();
  });

  it('keeps the samples when the user says so (Escape at the end)', async () => {
    await loadSampleContacts(new Date(2026, 8, 28));
    const unmount = await mount();
    await key('Escape');
    await settle();
    expect(document.getElementById('tour-title')?.textContent).toBe('Start with your own contacts?');
    await key('Escape');
    await settle();
    expect(tourSnapshot().active).toBe(false);
    expect(await db.contacts.count()).toBe(13);
    expect((await getSettings()).tourState).toBe('skipped');
    unmount();
  });
});
