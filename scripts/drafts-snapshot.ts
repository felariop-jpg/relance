/**
 * Prompt regression harness (developer tool, not part of the app or tests).
 *
 * Generates a draft for each fixture contact with every built-in template, in
 * the contact's language, against the REAL Anthropic API, and writes them to
 * fixtures/drafts-snapshot.md. Commit the regenerated file together with any
 * prompt change: the git diff shows whether the drafts got better or worse.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot
 *
 * Cost: 10 contacts × 5 templates = 50 drafts, roughly €0.35.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { anthropicSend } from '../src/ai/anthropic';
import { generateWithRetries } from '../src/ai/engine';
import { costEur, MODEL } from '../src/ai/model';
import { buildRequest, SYSTEM_PROMPT } from '../src/ai/prompt';
import type { Contact } from '../src/db/schema';
import { BUILT_IN_TEMPLATES } from '../src/db/seed';
import { defaultSettings } from '../src/db/settings-defaults';
import { resolveLanguage } from '../src/lib/language';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Set ANTHROPIC_API_KEY to run the snapshot. It calls the real API (about €0.35).');
  process.exit(1);
}

type FixtureContact = Contact & { case: string };
const contacts: FixtureContact[] = JSON.parse(readFileSync('fixtures/contacts.json', 'utf8'));
const settings = defaultSettings('en');
const send = anthropicSend(apiKey);
const families = [...new Set(BUILT_IN_TEMPLATES.map((t) => t.family))];
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
console.log(`\nWrote fixtures/drafts-snapshot.md. Approximate cost: €${total.toFixed(2)}`);
