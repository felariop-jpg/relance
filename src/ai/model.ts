/**
 * The model used for every draft. Swapping models is this one line.
 */
export const MODEL = 'claude-sonnet-5';

export const MAX_OUTPUT_TOKENS = 1024;

/**
 * Prices in EUR per million tokens, used for the estimate and the actual cost.
 * Assumption: USD 3 input / USD 15 output per million tokens (Sonnet-class
 * pricing) at 0.92 EUR per USD. Check anthropic.com/pricing when changing MODEL.
 */
export const EUR_PER_MILLION_TOKENS = { input: 2.76, output: 13.8 } as const;

/** Rough tokens for one draft: system prompt + contact + template, and the reply. */
export const EST_TOKENS_PER_DRAFT = { input: 1800, output: 350 } as const;

export function costEur(usage: { inputTokens: number; outputTokens: number }): number {
  return (
    (usage.inputTokens * EUR_PER_MILLION_TOKENS.input +
      usage.outputTokens * EUR_PER_MILLION_TOKENS.output) /
    1_000_000
  );
}

export function estimateCostEur(drafts: number): number {
  return costEur({
    inputTokens: EST_TOKENS_PER_DRAFT.input * drafts,
    outputTokens: EST_TOKENS_PER_DRAFT.output * drafts,
  });
}
