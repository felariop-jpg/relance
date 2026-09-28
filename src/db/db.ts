import Dexie, { type EntityTable } from 'dexie';
import type { Contact, Draft, Settings, Template, TrashEntry } from './schema';
import { BUILT_IN_PURPOSES } from './seed';

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
            if (typeof t.requiresWhereMet !== 'boolean') t.requiresWhereMet = t.isBuiltIn && t.family === 'post-event';
          });
      });
  }
}

export const db = new RelanceDB();
