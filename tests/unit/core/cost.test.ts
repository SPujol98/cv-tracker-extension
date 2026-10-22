import { describe, expect, it } from 'vitest';
import { computeCost, estimateTokens } from '../../../src/core/cost.ts';

const PRICE = { inputPerMTok: 1, outputPerMTok: 5, cachedInputPerMTok: 0.1 };

describe('computeCost (LLM-8)', () => {
  it('prices 10,000 input and 2,000 output tokens at $0.02', () => {
    const cost = computeCost(
      { inputTokens: 10_000, outputTokens: 2_000, cachedInputTokens: 0, estimated: false },
      PRICE,
    );
    expect(cost.costUsd).toBeCloseTo(0.02, 10);
  });

  it('prices cached input tokens at the cached rate and the rest at the input rate', () => {
    const cost = computeCost(
      { inputTokens: 10_000, outputTokens: 0, cachedInputTokens: 8_000, estimated: false },
      PRICE,
    );
    // 2,000 uncached at $1/MTok plus 8,000 cached at $0.10/MTok.
    expect(cost.costUsd).toBeCloseTo(0.002 + 0.0008, 10);
  });

  it('never prices a negative uncached count when cached exceeds input', () => {
    const cost = computeCost(
      { inputTokens: 100, outputTokens: 0, cachedInputTokens: 500, estimated: false },
      PRICE,
    );
    expect(cost.costUsd).toBeCloseTo((500 * 0.1) / 1_000_000, 12);
  });

  it('costs zero for a zero-token call', () => {
    const cost = computeCost(
      { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, estimated: false },
      PRICE,
    );
    expect(cost.costUsd).toBe(0);
  });

  it('propagates the estimated flag', () => {
    const usage = { inputTokens: 1_000, outputTokens: 10, cachedInputTokens: 0 };
    expect(computeCost({ ...usage, estimated: true }, PRICE).estimated).toBe(true);
    expect(computeCost({ ...usage, estimated: false }, PRICE).estimated).toBe(false);
  });
});

describe('estimateTokens', () => {
  it.each([
    [0, 0],
    [1, 1],
    [4, 1],
    [5, 2],
    [8, 2],
    [9, 3],
    [11_000, 2_750],
  ])('maps %i characters to %i tokens (ceil(chars / 4))', (chars, tokens) => {
    expect(estimateTokens(chars)).toBe(tokens);
  });
});
