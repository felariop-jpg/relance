/**
 * Prompt regression harness (developer tool, not part of the app or tests).
 *
 * Generates a draft for each fixture contact with every built-in template, in
 * the contact's language, against the REAL Anthropic API, and writes them to
 * fixtures/drafts-snapshot.md. Commit the regenerated file together with any
 * prompt change: the git diff shows whether the drafts got better or worse.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot          (asks first)
 *   ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot -- --yes (no question)
 *
 * The output is committed, so it must only ever come from the fictional
 * contacts in fixtures/contacts.json. The script refuses to run if any fixture
 * has an email outside the reserved example domains.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { anthropicSend } from '../src/ai/anthropic';
import { generateWithRetries } from '../src/ai/engine';
import { costEur, costUsd, EST_TOKENS_PER_DRAFT, MODEL } from '../src/ai/model';
import { buildRequest, SYSTEM_PROMPT } from '../src/ai/prompt';
import type { Contact } from '../src/db/schema';
import { BUILT_IN_TEMPLATES } from '../src/db/seed';
import { defaultSettings } from '../src/db/settings-defaults';
import { resolveLanguage } from '../src/lib/language';

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
  fail(
    'No API key set, so nothing was run.\n' +
      'This script calls the real Anthropic API. Run it like this:\n' +
      '  ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot',
  );
}

type FixtureContact = Contact & { case: string };
const contacts: FixtureContact[] = JSON.parse(readFileSync('fixtures/contacts.json', 'utf8'));
const notFictional = contacts.filter((c) => c.email && !/@example\.(com|net|org)$/i.test(c.email));
if (notFictional.length > 0) {
  fail(
    'fixtures/contacts.json must contain fictional contacts only (emails at example.com/.net/.org),\n' +
      'because the snapshot is committed. Offending ids: ' +
      notFictional.map((c) => c.id).join(', '),
  );
}
const settings = defaultSettings('en');
const send = anthropicSend(apiKey);
const families = [...new Set(BUILT_IN_TEMPLATES.map((t) => t.family))];

const drafts = contacts.length * families.length;
const estimate = { inputTokens: EST_TOKENS_PER_DRAFT.input * drafts, outputTokens: EST_TOKENS_PER_DRAFT.output * drafts };
console.log(
  `\nThis will write ${drafts} drafts (${contacts.length} fixture contacts × ${families.length} templates) with ${MODEL}.\n` +
    `Estimated cost: about $${costUsd(estimate).toFixed(2)} (≈ €${costEur(estimate).toFixed(2)}), billed to the key in ANTHROPIC_API_KEY.`,
);
if (!process.argv.includes('--yes')) {
  if (!process.stdin.isTTY) fail('Not running without confirmation. Re-run in a terminal, or add -- --yes.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Continue? [y/N] ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 'yes') fail('Cancelled. Nothing was sent.');
}
const promptHash = createHash('sha256')
  .update(SYSTEM_PROMPT + JSON.stringify(BUILT_IN_TEMPLATES))
  .digest('hex')
  .slice(0, 12);

const lines: string[] = [
  '# Draft snapshot',
  '',
  `Model: \`${MODEL}\` · Prompt + templates hash: \`${promptHash}\``,
  '',
  'Raw model output (placeholders not yet filled). Regenerate with `npm run drafts:snapshot`.',
  '',
];
let total = 0;

for (const contact of contacts) {
  const language = resolveLanguage(contact, settings);
  lines.push(`## ${contact.id}: ${contact.case}`, '');
  for (const family of families) {
    const template =
      BUILT_IN_TEMPLATES.find((t) => t.family === family && t.language === language) ??
      BUILT_IN_TEMPLATES.find((t) => t.family === family)!;
    const request = buildRequest({ contact, template, settings });
    process.stdout.write(`${contact.id} ${family} (${language})… `);
    try {
      const { output, usage } = await generateWithRetries(request, language, send);
      total += costEur(usage);
      lines.push(
        `### ${template.name} (${language})`,
        '',
        `**Subject:** ${output.subject}`,
        '',
        `**Personalization used:** ${output.personalizationUsed}`,
        '',
        ...output.body.split('\n').map((l) => (l ? `> ${l}` : '>')),
        '',
      );
      console.log('ok');
    } catch (error) {
      lines.push(`### ${template.name} (${language})`, '', `**FAILED:** ${String(error)}`, '');
      console.log('failed');
    }
  }
}

writeFileSync('fixtures/drafts-snapshot.md', lines.join('\n'));
console.log(`\nWrote fixtures/drafts-snapshot.md. Actual cost: about €${total.toFixed(2)}.`);
