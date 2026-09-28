# Progress

## Phase 1 — scaffold and contacts (c438c15)
Contacts table, CSV import with column mapper, sample data, EN/FR wiring.

## Phase 2 — templates, export, backup, undo
**Built**
- Five built-in template families in English and French, seeded on first run
  (`src/db/seed.ts`), each with subject, body, model instructions, schedule
  rule and intended contact types.
- Placeholder engine (`src/lib/placeholders.ts`): `{{firstName}}`, `{{lastName}}`,
  `{{company}}`, `{{email}}`, `{{senderName}}`, `{{signature}}`, `{{calendlyLink}}`.
  Lines whose placeholders are all empty are dropped; unknown placeholders stay
  visible and the card warns about them.
- "Write emails…" from a contact selection → template-text drafts (no AI).
- A first Review screen: editable cards with autosave, approve / skip / remove.
- Export: `.eml` files in a zip (unsent drafts for Outlook, `X-Unsent: 1`,
  RFC 2047 headers, header-injection safe) or a Brevo CSV. Choice at export
  time, `.eml` by default. Optional "mark as contacted today".
- Backup and restore (addition G): full JSON minus the API key, zod-validated
  restore with merge or replace, reminder above 50 contacts / 30 days.
- Undo instead of confirmations (addition E): contact delete (single and bulk),
  unsaved-form discard, draft removal, and restore itself.
- Fixed: the import summary counted unreadable countries/dates on rows later
  skipped as duplicates.

**Decided** — see CLAUDE.md decisions log (Phase 2 entries).

**Deferred**
- Settings beyond backup (Phase 6). The Review screen gets regeneration,
  keyboard shortcuts and mobile polish in Phase 4.
- Bundle-size warning from Vite (>500 kB); revisit in Phase 7.
