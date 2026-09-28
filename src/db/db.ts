import Dexie, { type EntityTable } from 'dexie';
import type { Contact, Draft, Settings, Template, TrashEntry } from './schema';
import { BUILT_IN_PURPOSES, BUILT_IN_TEMPLATES } from './seed';
import { PREVIOUS_BUILT_IN_INSTRUCTIONS, V5_BUILT_IN_INSTRUCTIONS, V5_BUILT_IN_PURPOSES } from './migrations/previous-briefs';

export class RelanceDB extends Dexie {
  contacts!: EntityTable<Contact, 'id'>;
  drafts!: EntityTable<Draft, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  trash!: EntityTable<TrashEntry, 'id'>;

  constructor(name = 'relance') {
    super(name);
    // Only fields that are searched, sorted or filtered are indexed.
    this.version(1).stores({
      contacts:
        'id, firstName, lastName, email, company, country, language, contactType, lastContacted, updatedAt',
      drafts: 'id, contactId, templateId, status, createdAt',
      templates: 'id, family, language, isBuiltIn',
      settings: 'id',
    });
    // v2: deleted contacts are kept 30 days in a table every tab can see.
    this.version(2).stores({ trash: 'id, deletedAt' });
    // v3: new default months (Sep → Aug, Dec → Nov) for built-ins nobody has
    // changed. Its own version so it also runs for browsers already on v2.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('templates')
          .toCollection()
          .modify((t) => {
            const r = t.scheduleRule;
            if (!t.isBuiltIn || !r) return;
            if (t.family === 'planning' && r.month === 9 && r.minGapDays === 60) t.scheduleRule = { month: 8, minGapDays: 60 };
            if (t.family === 'holiday' && r.month === 12 && r.minGapDays === 0) t.scheduleRule = { month: 11, minGapDays: 0 };
          }),
      );
    // v4: "where you met" on contacts; template purpose and post-event requirement.
    this.version(4)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('contacts')
          .toCollection()
          .modify((c) => {
            if (typeof c.whereMet !== 'string') c.whereMet = '';
          });
        await tx
          .table('templates')
          .toCollection()
          .modify((t) => {
            if (typeof t.purpose !== 'string') t.purpose = BUILT_IN_PURPOSES[t.id] ?? '';
            if (typeof t.requiresWhereMet !== 'boolean' && !Array.isArray(t.requiresAnyOf)) {
              t.requiresWhereMet = t.isBuiltIn && t.family === 'post-event';
            }
          });
      });
    // v5: built-in briefs rewritten (intent and content, no wording to copy).
    // Only replaces instructions the user never edited.
    this.version(5)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('templates')
          .toCollection()
          .modify((t) => {
            const fresh = BUILT_IN_TEMPLATES.find((b) => b.id === t.id);
            if (t.isBuiltIn && fresh && t.instructions === PREVIOUS_BUILT_IN_INSTRUCTIONS[t.id]) t.instructions = fresh.instructions;
          }),
      );
    // v6: gating generalised to "requires at least one of these fields"; contacts
    // gain "left open"; re-engagement now needs something to re-engage about;
    // refreshed briefs for re-engagement and the holiday greeting where unedited.
    this.version(6)
      .stores({})
      .upgrade(async (tx) => {
        await tx
          .table('contacts')
          .toCollection()
          .modify((c) => {
            if (typeof c.openThread !== 'string') c.openThread = '';
          });
        await tx
          .table('templates')
          .toCollection()
          .modify((t) => {
            if (!Array.isArray(t.requiresAnyOf)) {
              const fresh = BUILT_IN_TEMPLATES.find((b) => b.id === t.id);
              t.requiresAnyOf = t.isBuiltIn && fresh ? fresh.requiresAnyOf : t.requiresWhereMet ? ['whereMet'] : [];
            }
            delete t.requiresWhereMet;
            const fresh = BUILT_IN_TEMPLATES.find((b) => b.id === t.id);
            if (t.isBuiltIn && fresh && t.instructions === V5_BUILT_IN_INSTRUCTIONS[t.id]) t.instructions = fresh.instructions;
            if (t.isBuiltIn && fresh && t.purpose === V5_BUILT_IN_PURPOSES[t.id]) t.purpose = fresh.purpose;
          });
      });
  }
}

export const db = new RelanceDB();
