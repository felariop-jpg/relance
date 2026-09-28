/**
 * Prompt regression harness (developer tool, not part of the app or tests).
 *
 * Generates a draft for each fixture contact with every built-in template, in
 * the contact's language, against the REAL Anthropic API, and writes them to
 * fixtures/drafts-snapshot.md. Commit the regenerated file together with any
 * prompt change: the git diff shows whether the drafts got better or worse.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot                   (asks first)
 *   ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot -- --yes          (no question)
 *   ANTHROPIC_API_KEY=sk-ant-... npm run drafts:snapshot -- --retry-failed (only the gaps)
 *
 * The file is rewritten after every draft, so an interrupted run leaves its
 * finished drafts plus clearly marked gaps (with the reason) to retry.
 *
 * The output is committed, so it must only ever come from the fictional
 * contacts in fixtures/contacts.json. The script refuses to run if any fixture
 * has an email outside the reserved example domains.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { anthropicSend } from '../src/ai/anthropic';
import { alwaysOnline, classifyError, dualForm, generateWithRetries } from '../src/ai/engine';
import { failedBody, key, okBody, parseSnapshot, pendingBody, renderSnapshot, dualFormCheck, openingCheck, placeholderCheck, sourceCheck, type Entry, type Job } from './snapshot-format';
import { costEur, costUsd, EST_TOKENS_PER_DRAFT, MODEL } from '../src/ai/model';
import { buildRequest, SYSTEM_PROMPT } from '../src/ai/prompt';
import type { Contact } from '../src/db/schema';
import { BUILT_IN_TEMPLATES } from '../src/db/seed';
import { defaultSettings } from '../src/db/settings-defaults';
import { resolveLanguage } from '../src/lib/language';
import { canUseTemplate } from '../src/db/templates';
import { inputPlaceholders } from '../src/lib/needsInput';

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
const OUTPUT = 'fixtures/drafts-snapshot.md';
/**
 * The date given to the model. Pinned (not "today") so reruns are comparable:
 * change it deliberately, or pass --date=YYYY-MM-DD. Recorded in the file header.
 */
const DEFAULT_SNAPSHOT_DATE = '2026-09-28';
const dateArg = process.argv.find((a) => a.startsWith('--date='))?.slice(7);
if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) fail('--date must look like --date=2026-09-28');
const snapshotDate = dateArg ?? DEFAULT_SNAPSHOT_DATE;
const retryFailed = process.argv.includes('--retry-failed');
const settings = defaultSettings('en');
const send = anthropicSend(apiKey);
const families = [...new Set(BUILT_IN_TEMPLATES.map((t) => t.family))];
const promptHash = createHash('sha256')
  .update(SYSTEM_PROMPT + JSON.stringify(BUILT_IN_TEMPLATES))
  .digest('hex')
  .slice(0, 12);

// Every (contact, template) pair the app would allow, in file order. Post-event
// needs "where we met", so contacts without it are left out (not a gap).
const plan = contacts.flatMap((contact) => {
  const language = resolveLanguage(contact, settings);
  return families.flatMap((family) => {
    const template =
      BUILT_IN_TEMPLATES.find((t) => t.family === family && t.language === language) ??
      BUILT_IN_TEMPLATES.find((t) => t.family === family)!;
    if (!canUseTemplate(template, contact)) return [];
    const job: Job = { contactId: contact.id, contactCase: contact.case, heading: `${template.name} (${language})` };
    const otherTemplates = families
      .filter((f) => f !== family)
      .map((f) => BUILT_IN_TEMPLATES.find((t) => t.family === f && t.language === language) ?? BUILT_IN_TEMPLATES.find((t) => t.family === f)!)
      .map((t) => ({ name: t.name, purpose: t.purpose }));
    return [{ job, contact, template, language, otherTemplates }];
  });
});
const jobs = plan.map((p) => p.job);

let entries = new Map<string, Entry>();
if (retryFailed) {
  if (!existsSync(OUTPUT)) fail(`--retry-failed needs an existing ${OUTPUT}. Run a full snapshot first.`);
  const existing = parseSnapshot(readFileSync(OUTPUT, 'utf8'));
  if (existing.hash !== promptHash || existing.model !== MODEL || existing.date !== snapshotDate) {
    fail(
      'The prompt, templates, model or date changed since this snapshot was written, so filling only the gaps\n' +
        'would mix old and new drafts. Run a full snapshot instead (without --retry-failed).',
    );
  }
  entries = existing.entries;
}
const todo = plan.filter((p) => entries.get(key(p.job.contactId, p.job.heading))?.kind !== 'ok');
if (todo.length === 0) {
  console.log(`\nNothing to do: all ${jobs.length} drafts in ${OUTPUT} are present.`);
  process.exit(0);
}

const estimate = { inputTokens: EST_TOKENS_PER_DRAFT.input * todo.length, outputTokens: EST_TOKENS_PER_DRAFT.output * todo.length };
console.log(
  retryFailed
    ? `\nThis will write the ${todo.length} missing drafts (of ${jobs.length}) with ${MODEL}, keeping the others as they are.`
    : `\nThis will write ${todo.length} drafts (${contacts.length} fixture contacts × ${families.length} templates; post-event only where "where we met" is set) with ${MODEL}.`,
);
console.log(
  `Estimated cost: about $${costUsd(estimate).toFixed(2)} (≈ €${costEur(estimate).toFixed(2)}), billed to the key in ANTHROPIC_API_KEY.`,
);
if (!process.argv.includes('--yes')) {
  if (!process.stdin.isTTY) fail('Not running without confirmation. Re-run in a terminal, or add -- --yes.');
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Continue? [y/N] ')).trim().toLowerCase();
  rl.close();
  if (answer !== 'y' && answer !== 'yes') fail('Cancelled. Nothing was sent.');
}

// Mark everything still to do as "not run yet" so an interrupted run leaves visible gaps.
for (const p of todo) entries.set(key(p.job.contactId, p.job.heading), { kind: 'pending', body: pendingBody() });
const checks = () => {
  const items = plan.map((p) => ({
    label: `${p.job.contactId} ${p.job.heading}`,
    entry: entries.get(key(p.job.contactId, p.job.heading)) ?? { kind: 'pending' as const, body: [] },
    sources: `${p.contact.notes}\n${p.contact.serviceHistory}\n${p.contact.whereMet ?? ''}`,
  }));
  const openings = plan.map((p, i) => ({
    ...items[i],
    group: BUILT_IN_TEMPLATES.find((t) => t.family === p.template.family && t.language === 'en')?.name ?? p.template.family,
    firstName: p.contact.firstName,
  }));
  return [
    ...openingCheck(openings),
    '',
    ...placeholderCheck(items, inputPlaceholders),
    '',
    ...sourceCheck(items),
    '',
    ...dualFormCheck(items, dualForm),
  ];
};
const save = () =>
  writeFileSync(OUTPUT, renderSnapshot(MODEL, promptHash, jobs, entries, checks(), [`Date given to the model: \`${snapshotDate}\``, '']));
save();

let total = 0;
let failed = 0;
for (const { job, contact, template, language, otherTemplates } of todo) {
  process.stdout.write(`${job.contactId} ${job.heading}… `);
  try {
    const request = buildRequest({ contact, template, settings, today: snapshotDate, otherTemplates });
    const { output, usage } = await generateWithRetries(request, language, send, { connectivity: alwaysOnline });
    total += costEur(usage);
    entries.set(key(job.contactId, job.heading), { kind: 'ok', body: okBody(output) });
    console.log('ok');
  } catch (error) {
    const failure = classifyError(error);
    entries.set(key(job.contactId, job.heading), { kind: 'failed', body: failedBody(failure.code, failure.detail) });
    failed++;
    console.log(`not generated (${failure.code})`);
  }
  save();
}

console.log(`\nWrote ${OUTPUT}: ${todo.length - failed} written, ${failed} not generated. Cost of this run: about €${total.toFixed(2)}.`);
if (failed > 0) {
  console.log('The gaps are marked in the file with their reason. Fill them with: npm run drafts:snapshot -- --retry-failed');
  process.exit(1);
}
