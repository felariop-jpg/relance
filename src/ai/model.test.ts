import { describe, expect, it } from 'vitest';
import {
  costEur,
  costUsd,
  estimateCostEur,
  EUR_PER_USD,
  MODEL,
  USD_PER_MILLION_INPUT_TOKENS,
  USD_PER_MILLION_OUTPUT_TOKENS,
} from './model';

describe('pricing', () => {
  it('uses the published Sonnet 5 prices, in USD', () => {
    expect(MODEL).toBe('claude-sonnet-5');
    expect(USD_PER_MILLION_INPUT_TOKENS).toBe(2);
    expect(USD_PER_MILLION_OUTPUT_TOKENS).toBe(10);
  });

  it('works out a real cost from token usage, then converts once', () => {
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0 })).toBe(2);
    expect(costUsd({ inputTokens: 0, outputTokens: 1_000_000 })).toBe(10);
    expect(costEur({ inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(12 * EUR_PER_USD);
  });

  it('estimates well under one euro cent per draft', () => {
    const perDraft = estimateCostEur(1);
    expect(perDraft).toBeGreaterThan(0.004);
    expect(perDraft).toBeLessThan(0.01);
    expect(estimateCostEur(50)).toBeCloseTo(perDraft * 50);
  });
});
