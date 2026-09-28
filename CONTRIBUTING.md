# Contributing

(The full guide arrives with the docs; the rule below already applies.)

## Prompt changes need a new snapshot

Any change to the shared prompt (`src/ai/prompt.ts`), the model (`src/ai/model.ts`)
or the built-in templates (`src/db/seed.ts`) must regenerate the draft snapshot
**in the same commit**:

```sh
ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot
```

This writes `fixtures/drafts-snapshot.md` from the ten fixture contacts in
`fixtures/contacts.json` against every built-in template, using the real API
(about €0.50). Reviewers read the diff to judge whether drafts got better.
