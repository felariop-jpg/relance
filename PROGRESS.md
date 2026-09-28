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

### 2. Pricing
- Rates are now the published USD figures in their own constants
  (`USD_PER_MILLION_INPUT_TOKENS` = 2, `USD_PER_MILLION_OUTPUT_TOKENS` = 10 for
  Sonnet 5) and one separate `EUR_PER_USD` (0.86, dated 2026-09-28).
- The per-draft token estimate now comes from the first real drafts (2,200 in /
  300 out): about €0.006 per email instead of the old ~€0.010.
- Settings, next to the running total: costs are estimates converted at a fixed
  rate, plus a link to Anthropic's pricing page.
- Docs, first-run text, snapshot script and CONTRIBUTING updated; new pricing tests.

### 3. Schedule defaults
- Built-ins now: April (clients), August (clients + prospects), November
  (everyone), February (prospects). Post-event stays manual.
- Existing browsers: a v3 schema upgrade moves built-in templates still on the old
  September/December defaults; templates the user edited are untouched. (First
  attached to v2, which missed browsers already upgraded to v2 while testing; moved
  to its own version, with a test for both starting points.)
- docs/templates.md (+ .fr): a table of the defaults, stated plainly as a
  starting point, with how to set your own months.

### 4. Export default
- "Mark these contacts as contacted today" now starts unticked, with a help line:
  tick it only if sending today, because Relance uses the date to decide who is
  due next. The getting-started guides explain setting the date later instead.

### 5. Outlook verification
- docs/eml-compatibility.md: file anatomy, test setup, an 8-point checklist
  (opens as a draft, recipient, subject, accents, signature, line breaks,
  editable, sends), troubleshooting for X-Unsent, encodings, recipient,
  signature and read-only / Protected View, with the generator change for each,
  and a results table to fill in per Outlook version.
- New "Plain text files" export (one .txt per draft, named by contact).
- Guides now say to "Extract All" on Windows first, and mention the text fallback.

### 6. Snapshot readiness
- `npm run drafts:snapshot` stops with a clear message if no key is set, prints
  the draft count and estimated cost (≈ €0.32) before any call, and asks for
  confirmation (`-- --yes` skips; it refuses without a terminal otherwise).
- Decision: the output file is committed; it can only contain fixture data. The
  script refuses to run if any fixture email is outside the reserved example
  domains. Documented in CONTRIBUTING.md.

### 7. Deployment, going private
- docs/deployment.md: current setup; GitHub Pro via the Student Developer Pack is
  required for Pages from a private repo, and the site stops when it lapses (options:
  make public again, or Cloudflare Pages); private hides the source but not the site,
  and a static app's code is readable in any browser; step-by-step Cloudflare move,
  including asking users to back up and restore because browser data is per address.
- `BASE_PATH` is one constant in vite.config.ts.
- Found while doing this: the in-app help links pointed at docs on GitHub, which would
  404 for users once the repo is private. The guides are now built into the site as
  pages (`/docs/*.html`) and the app links there.
- The repo is still public at the time of this commit; the owner flips it.

### Network resilience (after the first snapshot run)
- Bug found in the snapshot output: request timeouts were classified "unknown",
  because the SDK's timeout error is a plain `Error("Request timed out.")`.
  Timeouts, resets and other transport errors are now "network".
- The app retries network failures up to 3 times with backoff before a card
  fails, and pauses the batch while the browser is offline, resuming on
  reconnect (banner: "You are offline, so Relance has paused…"). A rejected
  key still stops the batch. Tests cover retries, the offline pause, and a
  batch that loses its connection mid-run.
- Not verified in a real browser: the tools used here can't switch the browser
  offline. Worth one manual check (DevTools → Network → Offline during a batch).

### Snapshot gaps
- `scripts/snapshot-format.ts` (tested) reads and writes the snapshot. Gaps say
  "Not generated (reason). Error: …" plus the command to fill them; a run that is
  cut off leaves "not run yet" gaps, because the file is saved after every draft.
- `--retry-failed` regenerates only gaps (old `**FAILED:**` lines included), keeps
  existing drafts unchanged, and refuses if the prompt hash or model differs.
- Checked against the owner's real file: it parses as 50 entries with the same hash;
  gaps injected into a copy (old and new format) are detected.

## Snapshot review round (owner read all 50 drafts)

### 1. Possible invented facts
- Findings: "for a good cause" (fx-01) rewords "for a local charity" in the notes;
  "the restructuring" (fx-05) is in the service history ("2025: ad-hoc advice on a
  restructuring"). Neither was invented, but neither appeared in personalizationUsed.
  The same fx-05 sentence adds "and that the team is finding its footing", which
  is not in the data: an inferred circumstance.
- Fix: the facts rule now forbids adding motive, reason, cause, feeling, outcome,
  circumstance or context to a stated fact; personalizationUsed must quote each
  source phrase exactly. Interpreted "verbatim" as: facts must be stated in the data
  (rewording allowed, adding not); the quotes themselves are verbatim.
- Snapshot "Source check": flags drafts that quote nothing and quotes not found in
  the contact's notes or work history. Baseline on the first run: 44 of 50 drafts
  flagged (the old prompt never asked for quotes).
- Bait fixture fx-11: "Moved to Lisbon in June. Left the partnership."

### 3. The model didn't know today's date
- Every generation now receives `today`; new rule 10: relative times computed from it,
  no year number unless written in the contact's data, no "last year"/"this year"
  without a dated fact, "the year ahead" instead of a year number in wishes.
- Snapshot: pinned `DEFAULT_SNAPSHOT_DATE` (2026-09-28, or `--date=`), shown in the
  header; `--retry-failed` refuses if the date differs.

### 4. French gender agreement
- New setting `senderGender` (unspecified / feminine / masculine, default
  unspecified) in Settings → Your details, labelled as French-only with a translated
  explanation. Sent only with French drafts.
- Prompt: agree consistently when set; when unspecified, phrase around it; never a
  dual form. The engine rejects « ravi(e) », « certain·e », « heureux/se » (retry
  once, then malformed). Snapshot "Dual gender forms" check.
- PRIVACY (EN/FR) mentions the setting is sent for French drafts.

### 5. Five distinct emails
- Templates now carry a stated `purpose`, sent to the model with the other
  templates' purposes; the shared prompt says what separates a check-in (present,
  no past work), a re-engagement (the gap and the unresolved thing), a post-event
  email (where you met) and a greeting (no work).
- New contact field "Where you met" (form, CSV import column, allowlisted for the
  API, privacy docs updated). The post-event template requires it: in the write
  dialog it is disabled with an explanation when no selected contact has it, and
  contacts without it are left out with a count. Template editor: purpose field
  and a "requires where you met" option.
- Sample contacts: three have a "Where we met" value. Fixture fx-12 has one, so the
  snapshot exercises post-event; other fixtures skip post-event (not counted as gaps).

### 2. Near-identical openers
- Root cause confirmed: the model was given each template's email text as a
  "reference" and reworded it every time.
- The model no longer receives template prose at all. The five built-ins have new
  briefs in both languages (must achieve / must contain / must not contain /
  subject / length); the email text remains, unchanged, for the no-AI mode. (Owner
  asked for the body itself to become an instruction; that would have broken the
  no-AI mode, so the instruction became a separate brief and the body stays hidden
  from the model.)
- Opening rule: built from the contact's specifics when notes exist; stock phrases
  banned; no-notes contacts get one of five opening approaches chosen in code.
- Snapshot "Repeated openings" per template. Baseline on the first run: 22 drafts
  (spring 8/10, holiday 5/10, post-event 4/10, re-engagement 3/10, planning 2/10).
- Template editor and templates guide (EN/FR) explain purpose + brief.

## Second snapshot review

### 1. Invented book title
- fx-12 named "The Culture Code" and admitted in personalizationUsed that it was a
  stand-in. Also found: fx-10's planning and re-engagement drafts answered the
  contact's question on the sender's behalf ("yes, we do work with remote-only
  teams"); the data says only that they asked.
- New rule 1 (outranks fluency): never supply an unknown value, including answers
  to the contact's questions and facts about the sender's own services; write a
  visible [PLACEHOLDER] in the email's language instead.
- App: "Needs your input" badge and banner; approval blocked until filled in (button,
  approve-all, `a` key); editing one into an approved draft un-approves it; never
  exported; batch summary counts them. Snapshot "Needs your input" check.

### 4. Re-engagement invented an unresolved point
- Gating generalised rather than duplicated: `requiresWhereMet` became
  `requiresAnyOf` (any of whereMet / serviceHistory / openThread), used for
  post-event (whereMet) and re-engagement (any of the three). Fields withheld from
  the AI don't count. The template editor has checkboxes for it.
- "A note describing an open thread" can't be detected reliably in code, so it is an
  explicit optional contact field, "Left open" (form, import column, allowlisted,
  privacy docs). Otherwise fx-10, a prospect who asked a question and went quiet,
  would have lost re-engagement. fx-10 and fx-04 fixtures now fill it; fx-08 unchanged
  and correctly skipped.
- Re-engagement brief: work from "left open" first; if nothing says what was left
  open, write [WHAT WAS LEFT OPEN] rather than invent one.
- Review of the other three templates on sparse contacts (fx-02 no notes, fx-08 one
  bare note, fx-10 no history), from the second snapshot:
  - Spring check-in and late-summer planning need no specific detail (no-notes
    contacts get an opening approach), so no gate. But fx-10's planning and
    re-engagement answered the contact's question for the sender ("yes, we do work
    with remote-only teams"): now covered by the unknown-value rule in #1.
  - Holiday greeting needs nothing, but fx-08's assumed Christmas ("joyeux Noël");
    the brief now forbids naming a holiday unless the notes do.
  - None of the three manufactured a missing prerequisite, so none is gated.
- Schema v6: migrates the old flag, adds `openThread`, gates built-in re-engagement,
  and refreshes the re-engagement and holiday briefs where unedited.

### 2 + 3. Consequences and feelings
- Facts rule (now 5) forbids stating or implying a consequence, implication,
  resulting change or knock-on effect of a stated fact, hedged or not, with EN/FR
  hedge examples; acknowledging a fact and asking an open question stays allowed.
- New rule 6: feelings recorded in the notes may guide tone and subject but are
  never stated back, paraphrased or alluded to; let the contact raise them.
- Snapshot checks: "Hedged guesses" (EN/FR hedge patterns) and "Feelings stated
  back" (a feeling word in the notes and one in the email). Both are signals for
  review, not proof.
- Baseline on the second snapshot: 9 hedged guesses (fx-11's "I imagine leaving the
  partnership means…", plus eight more of the same kind: "I imagine that finish line
  was a great feeling", « a dû demander beaucoup d'énergie », « la voile reste,
  j'imagine, une belle façon de décrocher », …) and 1 feeling stated back (fx-09's
  « l'appréhension »). All nine checked by reading them: each is a real guess.

### 5. Source check noise
- Contact fields (company, first name, country, contact type, today's date) count as
  data, not quotes to check; whereMet and openThread count as sources.
- Only quoted text is checked; the "no quote" flag applies only to contacts with
  notes; for contacts without notes, quotes of the email's own wording are ignored.
- Matching ignores punctuation and ellipses, and accepts a quote whose words all
  appear in the source in order (a trimmed quote adds nothing).
- The model is told to quote only from notes, serviceHistory, whereMet or openThread.
- On the second snapshot: 13 → 6 flags, all real: fx-07 ×2 (quotes adding "now on
  board" and the inferred "settling in well"), fx-08 ×2 (the invented project, and a
  quote of the template's own brief), fx-09 (an English source quoted as a French
  paraphrase), fx-12 (the invented book title).

## Third snapshot review

### 1. Hedge rule narrowed to consequence and circumstance
- The rule now forbids only claims (plain or hedged) that a fact caused, changed or
  will change the contact's plans, priorities, situation, work or circumstances.
  Mild remarks about a fact's ordinary character are explicitly allowed. The prompt
  shows two worked examples, each with a permitted and a forbidden version, in EN
  and FR, because the model couldn't locate the line from a description alone.
- Snapshot: "Inferred consequences" (should be 0) and "Mild acknowledgements"
  (information only). A hedge counts as a consequence when its sentence talks about
  plans, priorities, situation, change, next year, recruiting and similar.
- On the third run: fx-11 → consequence, fx-03 → mild (as the owner judged). fx-09's
  « pourrait sans doute prendre un relief particulier avec ce changement à venir »
  is classified as a consequence: it says the upcoming change makes past coaching
  more relevant, an implied effect on her work. Left for the owner to judge.

### 2. Cross-language quoting
- personalizationUsed format: "exact source phrase in its original language" →
  rendering in the email's language (no quotes around the rendering). "No source:"
  when a draft rightly uses nothing from the data (e.g. a greeting for a contact
  whose notes are only about work), so those drafts aren't flagged.
- The checker verifies only the quoted source phrase against the contact's data;
  renderings are ignored.
- The language rule now says to render sources in the email's language, never word
  for word; new snapshot check "Mixed languages" (everyday EN words in FR emails and
  vice versa, ignoring contact data and placeholders). Third run baseline: none.
  fx-12's half-translated « …motivée through a busy season » was in the
  personalizationUsed quote, not in the email; the new format removes the pressure
  that produced it.
- fx-07's "now on board" / "settling in well": no new rule needed. "Settling in
  well" is an inferred circumstance (facts rule: never add outcome or circumstance;
  consequence rule: situation). "Now on board" is a rendering of "joined", which the
  new format reports as a rendering rather than as a quote.

### 3. "Left open" earns its place
- Contact form: helper line and example placeholder ("waiting on their budget
  decision; said they'd come back to us in the spring"), EN and FR.
- Write emails and Due now dialogs say, before generating, how many re-engagement
  drafts will need finishing because "Left open" is empty (AI mode only; demo drafts
  have no gaps). Guides explain the field (getting started, templates; EN and FR).
- **Known product characteristic, not a defect:** re-engagement drafts for contacts
  with an empty "Left open" come back with a [WHAT WAS LEFT OPEN] gap to fill in by
  hand (6 of 9 placeholders in the third run). This is the model correctly refusing
  to invent an unresolved point. Do not "fix" it by letting the model guess; the fix
  is users filling in the field, which the UI and guides now encourage.
