/**
 * The model used for every draft. Swapping models is this one line.
 */
export const MODEL = 'claude-sonnet-5';

export const MAX_OUTPUT_TOKENS = 1024;

/**
 * Anthropic's published prices for MODEL, in US dollars per million tokens.
 * Claude Sonnet 5: $2 input, $10 output. Source: anthropic.com/pricing.
 * Update these (and regenerate the prompt snapshot) whenever MODEL changes.
 */
export const USD_PER_MILLION_INPUT_TOKENS = 2;
export const USD_PER_MILLION_OUTPUT_TOKENS = 10;

/**
 * Fixed conversion used to show costs in euros: 1 USD = 0.86 EUR.
 * Set 2026-09-28 (approximate ECB reference rate at the time). Anthropic bills
 * in USD, so every euro figure in the app is an estimate. Update occasionally.
 */
export const EUR_PER_USD = 0.86;

/**
 * Rough tokens for one draft (system prompt + template brief + contact in, the
 * email out). First real drafts (2026-09-28): about 2,200 in and 300 out. The
 * no-invention, placeholder, consequence (with worked examples), feelings and
 * cross-language quoting rules grew the prompt to about 3,300 in, measured from
 * the fixture requests; replies about 350 out with source renderings.
 */
export const EST_TOKENS_PER_DRAFT = { input: 3300, output: 350 } as const;

export function costUsd(usage: { inputTokens: number; outputTokens: number }): number {
  return (
    (usage.inputTokens * USD_PER_MILLION_INPUT_TOKENS + usage.outputTokens * USD_PER_MILLION_OUTPUT_TOKENS) /
    1_000_000
  );
}

export function costEur(usage: { inputTokens: number; outputTokens: number }): number {
  return costUsd(usage) * EUR_PER_USD;
}

export function estimateCostEur(drafts: number): number {
  return costEur({
    inputTokens: EST_TOKENS_PER_DRAFT.input * drafts,
    outputTokens: EST_TOKENS_PER_DRAFT.output * drafts,
  });
}
