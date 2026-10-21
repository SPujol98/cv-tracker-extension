import { readFileSync } from 'node:fs';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  LLM_ERROR_CLASSES,
  type LlmProvider,
  type ModelEntry,
  ProviderError,
  type ProviderId,
} from '../../../src/core/ports/llm.ts';
import type { Clock, FetchLike, Rng } from '../../../src/core/ports/runtime.ts';
import {
  type ModelEntry as CatalogModelEntry,
  type ProviderId as CatalogProviderId,
  PRICE_CATALOG,
  REAL_PROVIDER_IDS,
} from '../../../src/core/pricing/catalog.ts';

describe('ProviderError (ADR-21)', () => {
  it('carries cls, retryAfterMs and afterFirstChunk', () => {
    const error = new ProviderError('rate_limit', 'slow down', 1500, true);
    expect(error).toBeInstanceOf(Error);
    expect(error.cls).toBe('rate_limit');
    expect(error.message).toBe('slow down');
    expect(error.retryAfterMs).toBe(1500);
    expect(error.afterFirstChunk).toBe(true);
  });

  it('defaults retryAfterMs to undefined and afterFirstChunk to false', () => {
    const error = new ProviderError('auth', 'bad key');
    expect(error.retryAfterMs).toBeUndefined();
    expect(error.afterFirstChunk).toBe(false);
  });

  it('lists exactly the ten error classes of ADR-21', () => {
    expect([...LLM_ERROR_CLASSES].sort()).toEqual(
      [
        'auth',
        'budget_exceeded',
        'cancelled',
        'invalid_output',
        'invalid_request',
        'permission_missing',
        'rate_limit',
        'refusal',
        'timeout',
        'transient',
      ].sort(),
    );
    expect(new Set(LLM_ERROR_CLASSES).size).toBe(10);
  });
});

describe('catalog and port ownership (Contract A)', () => {
  it('derives REAL_PROVIDER_IDS from the catalog keys', () => {
    expect([...REAL_PROVIDER_IDS]).toEqual(Object.keys(PRICE_CATALOG));
    expect([...REAL_PROVIDER_IDS].sort()).toEqual(['anthropic', 'openai']);
  });

  it('gives every provider a display name', () => {
    for (const id of REAL_PROVIDER_IDS) {
      expect(PRICE_CATALOG[id].displayName.length).toBeGreaterThan(0);
    }
  });

  it('re-exports ProviderId and ModelEntry from the catalog', () => {
    expectTypeOf<ProviderId>().toEqualTypeOf<CatalogProviderId>();
    expectTypeOf<ModelEntry>().toEqualTypeOf<CatalogModelEntry>();
    const source = readFileSync('src/core/ports/llm.ts', 'utf8');
    expect(source).toMatch(/export type \{[^}]*ProviderId[^}]*\} from '\.\.\/pricing\/catalog/);
    expect(source).toMatch(/export type \{[^}]*ModelEntry[^}]*\} from '\.\.\/pricing\/catalog/);
  });

  it('keeps the catalog free of imports from llm.ts', () => {
    const source = readFileSync('src/core/pricing/catalog.ts', 'utf8');
    const importLines = source
      .split('\n')
      .filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line));
    expect(importLines.join('\n')).not.toMatch(/ports\/llm/);
  });

  it('accepts a test-only provider with a non-production id', () => {
    const fake: LlmProvider = {
      id: 'fake',
      displayName: 'Fake',
      origin: 'https://example.invalid',
      models: [],
      validateKey: async () => ({ result: 'valid' }),
      // biome-ignore lint/correctness/useYield: an empty stream is enough for a type check
      async *complete() {
        return;
      },
    };
    expect(fake.id).toBe('fake');
  });

  it('types the runtime ports as plain functions and interfaces', () => {
    expectTypeOf<FetchLike>().toBeFunction();
    expectTypeOf<Rng>().toEqualTypeOf<() => number>();
    expectTypeOf<Clock['now']>().toEqualTypeOf<() => number>();
  });
});
