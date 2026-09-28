import Dexie, { type EntityTable } from 'dexie';
import type { Contact, Draft, Settings, Template, TrashEntry } from './schema';

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
    this.version(2)
      .stores({ trash: 'id, deletedAt' })
      .upgrade((tx) =>
        // New default months (Sep → Aug, Dec → Nov) for built-ins nobody has changed.
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
  }
}

export const db = new RelanceDB();
