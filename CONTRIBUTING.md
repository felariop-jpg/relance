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

Any change to the shared prompt (`src/ai/prompt.ts`), the model (`src/ai/model.ts`) or the built-in templates (`src/db/seed.ts`) must regenerate the draft snapshot **in the same commit**:

```sh
ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot
```

This writes `fixtures/drafts-snapshot.md`: ten fixture contacts (`fixtures/contacts.json`) × every built-in template, against the real API, about €0.35. Reviewers read the diff to judge whether the drafts got better or worse. The script is a developer tool; it is not part of the app or of `npm test`.

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
