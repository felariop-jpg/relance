# Relance — project rules

Open-source follow-up drafting tool. Static site; drafts personalized follow-up
emails with Claude; the user sends them themselves. The primary users are non-technical
and work in French and English. Anything that would intimidate a non-technical
person is a bug. Nothing in code, UI, defaults or sample data may be specific to
any one company, industry or country. Contact types stay generic: client,
prospect, lead.

## Hard constraints (never violate)

1. **No backend.** Static site only. No server, database, accounts or hosting
   costs. Deployable to GitHub Pages as a plain build artifact.
2. **Never send email.** No send capability, SMTP, or mail API, not behind a
   flag, not in dev. The app produces drafts; the user sends them. The README
   states this as a design decision.
3. **Contact data stays local.** All data lives in the browser's IndexedDB (Dexie).
   The only outbound network call in the whole app is to the Anthropic API, and
   it carries only the redacted subset below. The production build ships a
   Content-Security-Policy whose `connect-src` is `'self' https://api.anthropic.com`,
   so the browser itself enforces this.
4. **No build step for the user.** They visit a URL. Their only setup is pasting
   an API key once.
5. **Every user-facing string is translatable.** EN and FR from day one via
   react-i18next. No hardcoded strings in components. `src/i18n/i18n.test.ts`
   checks key parity and scans components for literal JSX text.

## Privacy model

- Contacts may concern people in sensitive situations. Treat all contact data as
  sensitive.
- `redactForApi(contact, settings)` in `src/ai/redact.ts` is the **only** path from
  contact data to the API payload.
- **Allowlist, not blocklist.** `API_FIELDS` in `src/db/schema.ts` lists the only
  fields that may be sent:
  `firstName, company, country, language, contactType, serviceHistory, notes`.
- These never leave the browser: `lastName, email, phone`, any field in
  `settings.withheldFields`, and any field added to the schema in future unless
  it is explicitly added to `API_FIELDS`. New fields default to withheld.
- `settings.withheldFields` is **global** (a checkbox per API field in Settings).
  No per-contact field marking.
- The `notes` checkbox carries a visible warning: withholding notes means drafts
  cannot reference anything specific about the contact.
- When notes are unavailable (withheld **or** empty), the model must set
  `personalizationUsed` to a plain statement of that fact, and the Review card
  shows it as a **warning badge**, not normal text.
- The model writes placeholders (`{{lastName}}`, `{{email}}`, `{{signature}}`,
  `{{calendlyLink}}`, ...). Real values are substituted locally after the
  response arrives.
- Unit tests must prove excluded fields cannot appear in the payload.
- PRIVACY.md explains this in plain language; Settings shows a two-sentence version.

## Language resolution

Per contact, first match wins (`resolveLanguage` in `src/lib/language.ts`):

1. `contact.language` if set explicitly (`null` means "automatic").
2. `settings.countryLanguageOverrides[contact.country]` — user-editable map,
   empty by default, edited in Settings.
3. Built-in country default: **only FR and MC → fr**. Every other country has no
   built-in default. Do not add more (CA, CH, BE, LU are multilingual; defaults
   there would encode one user's situation).
4. `settings.defaultLanguage` (default `'en'`).

`language` is a mappable column in the CSV import mapper.

## Stack

Vite + React 18 + TypeScript, Tailwind v4, Dexie (+ dexie-react-hooks), PapaParse,
@anthropic-ai/sdk (`dangerouslyAllowBrowser`), react-i18next, zod, Vitest,
fflate (zip). No state library, no component library, no router library.

Model: `claude-sonnet-5`, one exported constant (`MODEL` in `src/ai/model.ts`).
README notes that swapping models is a one-line change.

## Generation rules (shared prompt context)

- Write in the contact's language; never mix languages in one email.
- Under 150 words, short paragraphs.
- Open with something specific from the notes. If notes are empty or withheld,
  say so in `personalizationUsed` rather than inventing a detail.
- Never invent facts, shared history, statistics or names.
- No pressure, no artificial urgency, no "just following up" / "circling back" /
  "I wanted to reach out".
- End with a low-commitment invitation, not a meeting request.
- Strict JSON `{subject, body, language, personalizationUsed}`, zod-validated.

## Batch generation is per-card fault tolerant (build in Phase 3, not later)

- If draft 14 of 30 fails, the batch continues; that card shows an error state
  with the reason and a retry button; no other drafts are lost or rolled back.
- Each draft is written to Dexie independently as it completes.
- Handle at minimum: network failure, 401 bad key, 429 rate limit, malformed JSON
  after the one retry. 429 backs off and retries automatically before surfacing.
- A 401 should stop starting new requests (every one would fail) and point the
  user to the API key setting; already-finished drafts stay.

## Phases (stop after each for owner review)

1. Scaffold, Dexie schema, Contacts screen, CSV import with column mapper,
   sample data, i18n wiring. No AI, no export.
2. Templates with placeholder substitution; .eml export from a static template.
   Useful without an API key.
3. Generation layer: redactForApi + tests, Anthropic call, zod, shared prompt,
   per-card fault tolerance, one template end to end.
4. Review screen: inline editing, regeneration with instructions, batch ops.
5. Schedule rules and Due Now screen.
6. Settings (incl. withheldFields, defaultLanguage, country override editor),
   template editor, French UI, first-run flow, JSON backup/restore.
7. Docs, GitHub Pages workflow, polish of empty/loading/error states.

## Working rules

- Four screens only (Contacts, Due now, Review, Settings) plus first-run flow.
- Schedule rules are `{ month, minGapDays }`. No cron parser.
- User-facing docs: plain language, no jargon, no "simply", no assumed context.
- Run `npm test` and `npm run build` before calling a phase done.

## Decisions log (small calls made where the spec was silent)

- **Contact.language is nullable.** `null` = automatic, resolved at use time, so
  changing settings later re-routes every automatic contact. The table shows
  "Automatic (English)" so the effective language is always visible.
- **Hash navigation** (`#/contacts`) instead of paths, so GitHub Pages never
  404s on refresh. Vite `base: './'` so the build works under any sub-path.
- **CSV import**
  - Column names are never assumed. The mapper *suggests* a field from common EN/FR
    header names; the user confirms or changes every column before import.
  - "First row contains column names" is a checkbox, on by default.
  - Extra target "Full name (split into first and last)": splits at the first space.
  - Delimiter auto-detected (Excel in French locales exports `;`).
  - Encoding: UTF-8, falling back to Windows-1252, so accented names from older
    Excel exports are not garbled.
  - Rows without a first name are skipped and counted in the result.
  - Duplicates: a row whose email matches an existing contact (case-insensitive)
    is skipped and counted, never merged or overwritten. Rows without an email
    are always added.
  - Country accepts ISO-2 codes or English/French country names; unrecognised
    values are left blank and counted.
  - Dates: ISO or day/month/year. Month-first is used only when a value in
    the column proves it (second number > 12). Invalid dates → blank.
  - Contact type: recognised values mapped; anything else gets the "type for
    rows without one" choice on the mapping screen (default: client).
  - Choosing an .xlsx file shows a friendly "save as CSV first" message.
- **Sample data** is fictional: made-up people and companies, `example.com`/
  `example.org` addresses, no industry-specific content. "Load sample contacts"
  imports it directly (duplicate check makes it safe to click twice).
- **Deleting a contact also deletes its drafts**, and both go to "Recently deleted"
  (see Multi-tab rules).
- **Bulk actions act on the selected rows that are currently visible**; changing
  the search or filter narrows the selection.
- **Inline editing**: type, language and last-contacted are edited in the table;
  everything else in the contact form.
- **Unsaved form changes** ask "Discard changes?" before closing.
- **UI language** starts from the browser language (fr* → French, else English)
  and is stored in settings. A small EN/FR switch sits in the header.
- **Persistent storage** is requested once, after the first contacts are added
  (so the browser is less likely to clear them). Never before a user action.
- **Placeholder screens**: Due now, Review and Settings exist in the nav from
  Phase 1 with a translated "not built yet" note, so the layout doesn't shift later.
- **Country list** is the explicit ISO 3166-1 alpha-2 list (+ XK) in
  `src/lib/country.ts`, not derived from Intl (which also accepts legacy codes
  like FX and UK). Names come from Intl in the UI language.
- **Automatic language** shows as "French (auto)" in the table and
  "Automatic (currently French)" in the form.
- **Inline date edit** saves on Enter or blur only, never per keystroke (browsers
  fire change events with half-typed years like 0002). Dates before 1900 are
  rejected, inline and in the form.
- **Bulk actions sit in the search/filter row** so selecting a row never
  shifts the table.
- **Backdrop click, Escape and ✕ all close dialogs**; the contact form asks
  before discarding unsaved changes.
- **Layout width** is `max-w-screen-2xl` so the dense table fits on a laptop.
  Narrower screens scroll the table horizontally.

### Phase 2 decisions
- **Draft lifecycle** adds `pending` and `failed` to the four review statuses, so a
  card can exist while it is being written or after it failed. Drafts also carry
  `source` (ai / demo / template), `notesAvailable`, `payloadJson`, `usage`,
  `costEur`, `error`, `instruction`, `exportedAt`, `updatedAt`.
- **Templates** gain `appliesTo` (contact types; empty = everyone) so
  "Re-engagement" targets prospects, "Post-event" leads and prospects, etc.
- **Built-ins are seeded once** (`settings.templatesSeeded`), so a user who
  deletes one doesn't get it back on reload. Settings will offer "restore
  built-in templates".
- **French template wording is gender-neutral** for both sender and recipient
  ("je reprendrais volontiers" rather than "je serais heureux").
- **`{{signature}}` falls back to the sender name** when no signature is set.
- **A line whose placeholders are all empty is removed** (e.g. the booking-link
  line when there is no Calendly link). Unknown placeholders are left visible
  and flagged on the card.
- **Export can mark contacts as contacted today**, **unticked by default**
  (changed after deploy): a wrong date silently hides people from Due now, and
  drafts are often sent days after export. The help line says when to tick it. Exported drafts keep their status and show
  "Exported <date>".
- **.eml has no From or Date header** and sets `X-Unsent: 1`, so Outlook opens it
  as an editable new message from the user's own account.
- **Brevo CSV columns**: EMAIL, FIRSTNAME, LASTNAME, SUBJECT, BODY.
- **Backup** excludes the API key. Restore "merge" keeps current settings and adds
  missing records (newest `updatedAt` wins; same email under another id is
  skipped). "Replace" swaps everything but keeps the API key. Both are undoable.
- **Backup reminder** shows on Contacts above 50 contacts with no backup in 30
  days; "Remind me in a week" snoozes 7 days.
- **Undo window** is 10 s; deleted rows live only in the toast's closure.
  Toasts sit above the Review screen's bottom export bar.

### Phase 3 decisions
- **Structured output via a forced tool** (`save_draft`, `tool_choice`), then zod.
  A reply in the wrong language counts as malformed (retried once).
- **SDK retries off** (`maxRetries: 0`); the engine owns retries so they are
  tested. 429/529/5xx: up to 4 automatic retries, Retry-After honoured, else
  2 s → 4 s → 8 s → 16 s (+ jitter), capped at 30 s.
- **Concurrency 3.** A 401/403 stops further calls in the batch; remaining cards
  are marked "key not accepted" with Retry. A 400 about credit → "billing".
- **SDK is lazy-loaded** on first generation, so it never slows the first page.
- **The sender's own details are never sent**: signature, Calendly link and
  sender name are placeholders filled locally, like the recipient's surname.
- **`personalizationUsed` is written in the UI language** (`reportLanguage`),
  because it's for the user, not the recipient.
- **Payload panel** stores the exact request (`payloadJson`). The on-screen view
  expands the message's JSON text and puts the message first for readability;
  Copy gives the exact bytes sent. Failed calls that reached the API still show
  their payload (it was sent); cards stopped before any call show none.
- **Pricing** (corrected after deploy): published USD rates in
  `USD_PER_MILLION_INPUT_TOKENS` / `USD_PER_MILLION_OUTPUT_TOKENS` (Sonnet 5:
  $2 / $10), one separate `EUR_PER_USD` (0.86, set 2026-09-28) for display.
  `EST_TOKENS_PER_DRAFT` 2200 in / 300 out, from the first real drafts. Settings
  says costs are estimates converted at a fixed rate and links to Anthropic's
  pricing. Malformed replies' tokens count toward the real cost.
- **Demo mode** is simply "no API key". Demo drafts are marked `source: 'demo'`,
  labelled "Example" on the card, free, and use a 0.35–0.85 s delay. Sample
  contacts get note-based openings; anyone else gets a generic opening with a
  warning badge ("demo mode: notes not used").
- **API key check** uses the free models-list endpoint, never a generation.
- **Voice samples** go in the payload only when present; the Settings hint will
  ask users to remove names and private details before pasting.
- **Docs links** point to the GitHub repo (`REPO_URL` in `src/config.ts`).

### Phase 4 decisions
- **"Rewrite"**, not "Regenerate", in the UI (plainer). `r` rewrites at once
  with no instruction; the instruction box is one click away. Every rewrite is
  undoable from its toast (previous text and metadata kept in memory).
- **Bulk actions act on the drafts in the current filter** (no per-card
  checkboxes, which are fiddly on a phone): approve all, try failed again,
  remove all.
- **Approving from "To review" makes the next card active** (inbox style).
- **Undoing an approval returns the draft to "New"** (`generated`); the
  "Edited" marker isn't restored. Minor, and keeps the model simple.
- **Contacts on phones**: a stacked list below 768 px (tap to edit, checkbox to
  select). Inline table editing is desktop-only.

### Phase 5 decisions
- **Built-in schedules** (revised after deploy): Spring check-in April / 90 days /
  clients; Late-summer planning **August** / 60 days / clients + prospects; Holiday
  greeting **November** / 0 days / everyone; Re-engagement February / 180 days /
  prospects; Post-event: no schedule (manual only). They are a starting point,
  not advice: docs/templates.md tells users to set their own. The v2 schema
  upgrade moves unchanged built-ins from Sep/Dec to Aug/Nov; edited ones are kept.
- **Due only in the rule's month.** Nothing carries over from last month; the
  "Coming up" list shows what the next scheduled templates will catch.
- **Everyone due is pre-ticked**; untick to leave someone out.
- **An open draft blocks a second one** for the same contact and template family
  (open = not exported and not skipped). Exporting or skipping frees it.
- **Days are whole calendar days** in the user's time zone.
- **Manual mode** reuses the Write emails dialog (any template, any contacts).

### Phase 6 decisions
- **Settings is one long page with a jump list**, not tabs: easier to scan and
  to find with the browser's search.
- **Settings fields save themselves** ~0.4 s after typing stops (and on blur);
  there is no Save button to forget.
- **Privacy checkboxes are phrased as "sent"** (ticked = sent) so the default,
  all ticked, reads naturally. Unticking notes turns its warning bold.
- **Country overrides** are a small list with add/remove; FR and MC stay
  built-in (shown as a note), and an override can change them.
- **Voice samples** are capped by the textarea itself (maxLength 2000); the
  counter turns amber at the limit.
- **Templates**: either language version may be omitted; drafts for the missing
  language fall back to the other version (the write dialog says so). Custom
  families get `custom-<id>`. Built-ins stay `isBuiltIn` even when edited, so
  "restore" never duplicates them.
- **Delete everything** deletes the IndexedDB database outright (including the
  API key) and reloads. The confirmation word follows the interface language.
- **First run** stores the key typed there; "Skip the introduction" on every step.
- **Language names**: pickers use endonyms (English / Français, never
  translated); sentences use `languagesInline` ("anglais" in French text).
- **Testing** must use its own origin (e.g. `vite preview --port 4174`) when the
  owner may have the app open: same-origin tabs share one IndexedDB.

### Phase 7 decisions
- **Docs are bilingual**: every user-facing guide has an `.fr.md` twin; the
  developer sections stay English only.
- **Screenshots are real** (production build on an isolated port). Third-party
  screens (Outlook, Anthropic Console) are TODO placeholders for the owner.
- **.eml guidance is honest about clients**: classic Outlook for Windows opens
  it as a new message; Apple Mail needs "Send Again"; Thunderbird "Edit as New".
- **Licence holder** is "The Relance contributors" (MIT, 2026).
- **Deploy**: GitHub Pages via Actions from `main`; Node 22 in CI.
- **Contact data first** in the prompt JSON so the payload panel leads with it.
- **Tab counters**: Review = drafts not yet approved or skipped; Due now =
  people due and not already drafted.

### Multi-tab rules (after the Phase 6 data-loss investigation)
- **Never read a collection or record into memory, change it, and write it back
  whole.** Write only the fields that changed (`changedFields`, field-scoped
  `updateContact`), or change lists and maps inside a transaction on the latest row
  (`modifySettings`, Dexie `modify`).
- **Deletes are recoverable from any tab**: contacts and their drafts go to the
  `trash` table (schema v2) in the same transaction, kept 30 days (`purgeTrash` at
  start-up). Undo = restore from trash; restore only adds missing records.
- **Undo of a restore is a record-level inverse** (`undoRestore`): it never clears a
  table, so records another tab created meanwhile survive.
- **Live sync between tabs** is Dexie 4's built-in BroadcastChannel propagation.
  `OtherTabsNotice` tells the user when another tab is open.
- Any new write path needs a case in `src/db/multitab.test.ts`.

### Export decisions (after deploy)
- **Plain-text fallback export**: one `.txt` per approved draft in a zip, named
  after the contact, address and subject on top, UTF-8 with BOM and CRLF.
- **.eml is unverified in Outlook**; docs/eml-compatibility.md holds the manual
  checklist and what to change in `buildEml` for each failure. Users are told
  to "Extract All" on Windows before opening.
