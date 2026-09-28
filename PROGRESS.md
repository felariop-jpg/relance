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

## Phase 3 — the generation layer
**Built**
- `redactForApi` (allowlist, `src/ai/redact.ts`) with tests proving surname,
  email, phone, ids, dates, withheld fields and any future field never reach
  the payload, including the full request with sender details.
- Shared prompt (`src/ai/prompt.ts`) with the tone rules, placeholder rules,
  voice-sample rules (addition B, prompt side) and an `extraInstruction` slot
  for regeneration. Output forced through a `save_draft` tool, validated with zod.
- Engine (`src/ai/engine.ts`): one retry on malformed or wrong-language replies;
  automatic back-off on 429/529 honouring Retry-After (up to 4 retries); errors
  classified as network / auth / rate_limit / overloaded / malformed / billing /
  interrupted / unknown.
- Per-card fault tolerance (`src/ai/batch.ts`): 3 at a time, every draft saved
  independently; a 401 stops new calls and marks the rest, finished drafts stay.
  Reloading mid-batch turns pending cards into retryable "interrupted" errors.
- Payload transparency (addition A): the exact request is stored on the draft;
  a collapsed "What was sent to the AI" panel shows it with Copy.
- Cost (addition F): estimate before, actual after (from returned usage), running
  total in Settings with reset (undoable). Pricing in one constant.
- Demo mode plumbing and content (addition C): no key → canned drafts from
  `src/ai/demo-drafts.json`, EN + FR, personal openings for the sample contacts.
  Persistent demo banner. Payload panel still shows what *would* be sent.
- Minimal Settings: API key (show/hide, "check the key" via the free models
  endpoint) and the cost total.
- Prompt regression harness (addition I): `fixtures/contacts.json` (10 cases),
  `npm run drafts:snapshot`, rule documented in CONTRIBUTING.md.

**Verified in the browser**: demo batch of 12; payload panel contents (only the
7 allowed fields); a real call to api.anthropic.com with an invalid key through
the production CSP → per-card "key not accepted", batch stopped, earlier drafts
intact.

**Deferred**
- The baseline `fixtures/drafts-snapshot.md` is a placeholder: no API key is
  available in this environment. The owner runs `npm run drafts:snapshot` once.
- A real successful generation against `claude-sonnet-5` is untested for the
  same reason (engine and parsing are unit-tested with fakes; the SDK path was
  verified up to the 401).
- Voice-sample editing UI is Phase 6.

## Phase 4 — review screen
**Built**
- Rewrite per card, immediately or with an instruction ("shorter", "plus
  formel"); the previous version is restorable from the toast for 10 s. The last
  instruction is shown on the card and travels in the payload.
- Actions on all drafts in the current filter: approve all (undoable), try
  failed again, remove all (undoable).
- Keyboard-first review (addition D): j/k, a, s, e (caret at the end), r, Esc,
  and ? for a translated overlay, discoverable from a "Keyboard shortcuts ?"
  hint. Paused in text fields and while a dialog is open. Approving in the
  "To review" list moves you to the next card, like an inbox.
- Mobile (addition H): single column, full-width cards, 44 px tap targets,
  auto-growing email text, fixed export bar; no horizontal scroll at 390 px.
  Contacts show a stacked, tappable list below 768 px.

**Verified in the browser**: keyboard flow (navigate, approve → next card,
edit, Esc, skip), rewrite with "plus court" (instruction in payload, undo toast),
bulk bar, phone-width Review and Contacts.

**Deferred**: nothing from this phase.

## Phase 5 — scheduling and Due now
**Built**
- Declarative rules `{ month, minGapDays }` plus each template's `appliesTo`
  (`src/lib/schedule.ts`, tested): due when the month matches, the contact type
  fits, and the gap since last contact is at least `minGapDays` (never-contacted
  counts as due).
- Due now screen: one group per scheduled template with its rule in plain words,
  everyone due pre-ticked, per-group select-all, "Already has a draft in Review"
  rows disabled, no-notes badges, last contact as relative time, a "Coming up"
  list for the next scheduled templates, and a sticky bar with the running count
  and a cost estimate.
- Generate dialog: per-template summary, AI/demo or template text, estimate.
- "Choose contacts yourself": searchable picker + any template, whatever the
  schedule.
- The Phase 1 placeholder screen is gone.

**Verified in the browser**: 28 September → Late-summer planning due for 10 of
the 12 sample contacts (leads excluded); untick one, generate 9 in demo mode;
back on Due now those 9 show "Already has a draft"; French rule text; manual
picker opens the write dialog.

**Deferred**: nothing from this phase.

## Phase 6 — settings, template editor, French, first run
**Built**
- Settings, one page with a jump list: AI connection, Your details (name,
  signature, booking link, interface language), What the AI sees (two-sentence
  privacy summary, one checkbox per allowlisted field, a visible warning on
  notes that turns stronger when notes are unticked, the never-sent list),
  Email languages (default language, FR/MC note, per-country override editor),
  Your writing style (voice samples, addition B: up to 3, 2000 characters each,
  live counter), Templates, AI costs, Backup, Delete everything.
- Template editor: schedule (none, or month + minimum gap), intended contact
  types, EN/FR tabs with name, subject, email text, AI instructions; clickable
  placeholder chips that insert at the cursor; warnings for unknown
  placeholders; either language version can be left out. New, delete (undoable),
  "restore built-in templates". Closing with unsaved edits discards with Undo.
- "Delete everything" is the only confirmation left: the user types DELETE /
  SUPPRIMER (in the interface language, any case). It deletes the whole
  database, then the welcome screen returns.
- First run: three skippable steps (what it does and never does; optional API
  key with the guide link; import, samples or empty). Language switch on the
  welcome itself. Shown once (`firstRunDone`), never flashes for returning users.
- French: every screen translated; inline language names ("anglais") are proper
  forms rather than lower-cased labels.
- Fixed: auto-growing text boxes could collapse to a sliver inside dialogs and
  tabs; they now respect their row count and refit when shown.

**Verified in the browser** (on a separate port, see note): welcome in French →
samples; country override DE → Daniel becomes "French (auto)"; notes warning;
voice-sample counter and payload; template edit with placeholder chip, French-only
custom template scheduled in October for leads, delete/undo, restore built-ins,
discard/undo; Delete everything with the typed word.

**Note — shared test origin.** Midway through, drafts written with a real API
key and a real signature appeared on http://localhost:4173: someone was using
the app in another tab on the same origin, which shares the same IndexedDB.
That explains 12 contacts vanishing between two of my scripted steps (not
reproducible from the app's own code, checked step by step). Two of my scripted
clicks then produced real AI drafts with that key (about €0.02). I moved all
further testing to port 4174. The real drafts confirmed generation with
`claude-sonnet-5` works end to end (French, ~80 words, correct personalisation,
~€0.01 each).

**Deferred**: nothing from this phase.

## Phase 7 — docs, deploy, polish
**Built**
- Docs for non-technical readers, English and French: README (+ README.fr),
  getting started, getting an API key, editing templates, PRIVACY (+ .fr).
  Plus LICENSE (MIT) and a full CONTRIBUTING.md.
- 18 screenshots of the real app (production build, sample data, demo drafts)
  in `docs/screenshots/`, English and French, desktop and phone.
- GitHub Pages workflow: test → build → deploy on every push to `main`
  (pull requests are tested only).
- Polish: a friendly error screen that keeps the rest of the app usable;
  counters on the Due now and Review tabs; page titles per screen; an empty state
  for the template list; the contact data now comes first in the payload (and
  so in "What was sent to the AI"); the email column hides below 1536 px so
  notes stay visible on laptops; wider import-mapping choices.
- Guard tests for the hard constraints: no mail-sending code or packages, no
  server dependencies, CSP limited to the site and api.anthropic.com, and
  `fetch`/SDK use confined to the two expected files.

**Deferred**
- Screenshots of third-party screens (Outlook with an opened draft, the
  Anthropic Console billing and key pages) are marked TODO in the guides.
- `fixtures/drafts-snapshot.md` still needs its first real run (needs a key).

## Deployed
- Live: **https://felariop-jpg.github.io/relance/** (repo: https://github.com/felariop-jpg/relance).
- Verified on the live URL: production CSP present; welcome → sample contacts
  → Due now → 10 demo drafts → edit → approve → .eml zip export, with no
  account, key or card.
- CI: tests and build pass on GitHub's Linux runner; Pages deploys from `main`.

## Follow-up round (after deploy)

### 0. Security check
- History: no credentials. The only `sk-ant` strings are `sk-ant-...`
  placeholders and three made-up test strings. No `.env`/secret/token file ever
  committed; no other token formats.
- `.gitignore` now covers `.env`, `.env.*` (except `.env.example`), `*.local`
  and files exported from the app while testing.
- Fixtures moved to reserved example domains (example.com/.net/.org; `.fr`,
  `.ie`, `.be`, `.pt` are registrable). Import screenshot retaken.
- Removed two soft hints of the original use case (a "return-to-office"
  fixture detail; gendered references to "the user" in CLAUDE.md/code).
- No source maps, local paths, usernames or machine names in the build.
- Not fixable without rewriting history: commits carry the author's
  university email address. Flagged to the owner; history left untouched.

### 1. Multi-tab data loss
**What the evidence shows.** When the 12 contacts vanished, the database still held the 10
templates and every setting written seconds earlier. That rules out a
whole-database deletion (tested: "Delete everything" in one tab makes other tabs reopen
onto an empty database with default settings) and a replace-restore (rewrites settings
and templates). The only other path that removes contact records is `deleteContacts`,
the user's Delete action, and no script of mine ran one in that window. The loss was a delete made in the
other tab.

**The actual bug.** Deletes were immediate, and their Undo lived in memory, in that one
tab, for 10 seconds. Every other tab just saw rows disappear through live sync, with no
notice and no way back. Code review found more multi-tab hazards of the
"read, modify, write back wholesale" kind:
- the contact form saved the whole record as it was when opened, reverting other
  tabs' edits and the export's "last contacted" date;
- `updateContact` read and wrote outside a transaction and wrote every field;
- undoing a backup restore cleared whole tables, deleting contacts another tab had
  added meanwhile;
- country overrides and withheld fields were rewritten from a possibly stale copy;
- the template editor wrote whole rows.

**Fixes.**
- Deletions go to a shared "Recently deleted" table (Dexie schema v2) in the same
  transaction, kept 30 days and visible from any tab. Undo restores from it. Restore
  only adds missing records and is safe to run twice or from two tabs.
- Writes are record- and field-scoped: the contact form sends only changed fields;
  `updateContact` patches only the given fields inside a transaction and reports a
  contact deleted elsewhere; settings lists and maps change one entry at a time in a
  transaction (`modifySettings`); template saves patch changed fields; draft edits run
  in a transaction; undoing a restore is a record-by-record inverse.
- Cross-tab propagation: Dexie 4's built-in BroadcastChannel propagation already keeps
  every tab live (verified with two tabs). `dexie-observable` is a Dexie 2/3 add-on
  and not needed.
- A non-blocking notice appears when another tab of Relance is open (BroadcastChannel
  presence).
- Regression tests (`src/db/multitab.test.ts`) run two connections to the same
  database with interleaved adds, imports, same-record edits of different fields,
  deletes, concurrent restores and concurrent settings edits, and assert nothing is lost.
