// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { emptyContact } from '../../db/contacts';
import { newDraft } from '../../db/drafts';
import { ExportDialog } from './ExportDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no <dialog> methods.
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open');
};

describe('ExportDialog', () => {
  it('does not mark contacts as contacted unless the user ticks the box', () => {
    const contact = { ...emptyContact(), id: 'c', firstName: 'Ann', createdAt: '', updatedAt: '' };
    const draft = newDraft({ contactId: 'c', templateId: 't', language: 'en' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(createElement(ExportDialog, { items: [{ draft, contact }], onClose: () => {} })));
    const box = document.querySelector<HTMLInputElement>('dialog input[type=checkbox]');
    expect(box?.checked).toBe(false);
    act(() => root.unmount());
    host.remove();
  });
});
