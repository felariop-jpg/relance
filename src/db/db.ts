import Dexie, { type EntityTable } from 'dexie';
import type { Contact, Draft, Settings, Template } from './schema';

export class RelanceDB extends Dexie {
  contacts!: EntityTable<Contact, 'id'>;
  drafts!: EntityTable<Draft, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

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
  }
}

export const db = new RelanceDB();
