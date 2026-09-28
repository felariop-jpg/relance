# Contributing to Relance

Thank you for helping. Relance is small on purpose, and its users are mostly not technical, so the bar for new features is "does this make it simpler or safer for them?"

## Setting up

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # must pass before every commit
npm run build   # type check + production build in dist/
```

Node 22 or newer.

## The rules that never bend

These are also in [CLAUDE.md](CLAUDE.md), with the reasons.

1. **No backend.** Static files only. No server, database, accounts or paid hosting.
2. **Never send email.** No SMTP, mail APIs or "send" buttons, not even behind a flag. `src/guards.test.ts` fails if mail-sending code or packages appear.
3. **Contact data stays local.** The only network call is to the Anthropic API, and contact data reaches it only through `redactForApi` (an allowlist). Adding a field to `API_FIELDS` needs a very good reason and an update to PRIVACY.md and PRIVACY.fr.md.
4. **No build step for users.** They open a URL.
5. **Every user-facing string is translatable.** Add keys to both `src/i18n/locales/en.json` and `fr.json`. `src/i18n/i18n.test.ts` checks that the two files match and scans components for text written directly in JSX.

## How the code is organised

| Folder | What is there |
|---|---|
| `src/db` | Dexie schema, contacts, drafts, templates, settings, built-in templates |
| `src/lib` | Pure helpers: CSV import, languages, countries, dates, placeholders, scheduling |
| `src/ai` | Redaction, prompt, engine (retries, errors), batch queue, demo mode |
| `src/export` | .eml, zip, Brevo CSV, backup/restore |
| `src/screens` | Contacts, Due now, Review, Settings, first run |
| `src/components` | Small shared UI pieces (no component library) |
| `fixtures` | Prompt-regression contacts and the committed draft snapshot |
| `docs` | Plain-language guides, English and French, with screenshots |

## Prompt changes need a new snapshot

Any change to the shared prompt (`src/ai/prompt.ts`), the model or prices
(`src/ai/model.ts`) or the built-in templates (`src/db/seed.ts`) must regenerate the
draft snapshot **in the same commit**:

```sh
ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot
```

- It writes `fixtures/drafts-snapshot.md`: the ten fixture contacts in
  `fixtures/contacts.json` × every built-in template, against the real API.
- Before calling the API it prints the number of drafts and an estimated cost
  (about €0.35), then asks you to confirm. Add `-- --yes` to skip the question
  (it also refuses to run without a terminal unless `--yes` is given).
- With no `ANTHROPIC_API_KEY` it stops with a message and sends nothing.
- The model is given a pinned date (`DEFAULT_SNAPSHOT_DATE` in the script, or
  `-- --date=YYYY-MM-DD`), recorded in the file header, so reruns are comparable.
- The file is saved after every draft. If a draft can't be written (for example
  the laptop sleeps and the connection drops), it appears as **Not generated**
  with the reason, so a gap is never mistaken for a bad draft. Network failures
  are retried 3 times first.
- `npm run drafts:snapshot -- --retry-failed` writes only the missing drafts and
  leaves every existing one byte for byte. It refuses if the prompt, templates
  or model changed since the file was written, because that would mix old and
  new drafts; run a full snapshot then.
- Reviewers read the diff to judge whether the drafts got better or worse. It is a
  developer tool, not part of the app or of `npm test`.

**The snapshot is committed, so it must only ever contain fixture data.** Its only
input is `fixtures/contacts.json`, which holds fictional people with emails at the
reserved `example.com`/`.net`/`.org` domains. The script refuses to run if any
fixture email is outside those domains. Never point it at real contacts, and never
paste real notes into the fixtures.

## Email export

The .eml format and its known limits (classic vs. new Outlook, X-Unsent,
encodings) are documented in [docs/eml-compatibility.md](docs/eml-compatibility.md),
with the manual test to run on Windows. Update its results table when you test.

## Writing for users

User-facing text and the guides in `docs/` are for people who have never used a developer tool.

- Plain words. No jargon. Don't write "simply" or "just".
- Numbered steps with one action each.
- Say what will happen, and how to undo it.
- Every English change needs the French one, and the other way round.

## Pull requests

- Keep them focused.
- Include tests for logic (`src/lib`, `src/ai`, `src/export`, `src/db`).
- Check the change in both languages and on a phone-sized window.
- If you add a screen state (empty, loading, error), make it helpful: say what happened and what to do next.
