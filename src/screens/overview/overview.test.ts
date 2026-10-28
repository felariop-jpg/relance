import { describe, expect, it } from 'vitest';
import { emptyContact } from '../../db/contacts';
import { newDraft } from '../../db/drafts';
import { BUILT_IN_TEMPLATES } from '../../db/seed';
import { defaultSettings } from '../../db/settings-defaults';
import type { Contact } from '../../db/schema';
import { overviewData } from './overview';

const nov = new Date(2026, 10, 5); // the holiday greeting goes to everyone in November
const contact = (id: string, patch: Partial<Contact> = {}): Contact => ({
  ...emptyContact(),
  id,
  firstName: id,
  createdAt: '',
  updatedAt: '',
  ...patch,
});

describe('overviewData', () => {
  const contacts = [
    contact('a', { contactType: 'client', notes: 'Likes walks.' }),
    contact('b', { contactType: 'client' }),
    contact('c', { contactType: 'prospect', notes: '  ' }),
    contact('d', { contactType: 'lead', notes: 'Met at a fair.' }),
  ];

  it('counts contacts by type and those without notes', () => {
    const data = overviewData(contacts, [], BUILT_IN_TEMPLATES, defaultSettings('en'), nov);
    expect(data.counts).toEqual({ total: 4, client: 2, prospect: 1, lead: 1, noNotes: 2 });
  });

  it('tracks the setup checklist and hides it once complete', () => {
    const fresh = overviewData([], [], BUILT_IN_TEMPLATES, defaultSettings('en'), nov);
    expect(fresh.setup).toEqual({ apiKey: false, senderName: false, contacts: false, backup: false });
    expect(fresh.setupDone).toBe(false);
    const settings = { ...defaultSettings('en'), apiKey: 'sk-x', senderName: 'Sam', lastBackupAt: '2026-11-01T09:00:00Z' };
    expect(overviewData(contacts, [], BUILT_IN_TEMPLATES, settings, nov).setupDone).toBe(true);
    expect(overviewData(contacts, [], BUILT_IN_TEMPLATES, { ...settings, senderName: ' ' }, nov).setup.senderName).toBe(false);
  });

  it('counts people due and not drafted yet, like Due now', () => {
    const data = overviewData(contacts, [], BUILT_IN_TEMPLATES, defaultSettings('en'), nov);
    expect(data.due.people).toBe(4);
    expect(data.due.groups).toEqual([{ family: 'holiday', name: expect.any(String), count: 4 }]);
    const drafted = [newDraft({ contactId: 'a', templateId: 'builtin-holiday-en', language: 'en', status: 'generated' })];
    expect(overviewData(contacts, drafted, BUILT_IN_TEMPLATES, defaultSettings('en'), nov).due.people).toBe(3);
  });

  it('names the next batch', () => {
    const data = overviewData(contacts, [], BUILT_IN_TEMPLATES, defaultSettings('en'), nov);
    expect(data.next?.family.family).toBeDefined();
    expect(data.next?.month).not.toBe(11);
  });

  it('counts drafts to review and approved drafts not yet exported', () => {
    const drafts = [
      newDraft({ contactId: 'a', templateId: 't', language: 'en', status: 'generated' }),
      newDraft({ contactId: 'b', templateId: 't', language: 'en', status: 'failed' }),
      newDraft({ contactId: 'c', templateId: 't', language: 'en', status: 'approved' }),
      { ...newDraft({ contactId: 'd', templateId: 't', language: 'en', status: 'approved' }), exportedAt: '2026-11-02T10:00:00Z' },
      newDraft({ contactId: 'd', templateId: 't', language: 'en', status: 'skipped' }),
    ];
    expect(overviewData(contacts, drafts, BUILT_IN_TEMPLATES, defaultSettings('en'), nov).drafts).toEqual({
      toReview: 2,
      approvedNotExported: 1,
    });
  });
});
