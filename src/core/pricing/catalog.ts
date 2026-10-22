// Versioned price catalog (LLM-8, LLM-10). Pure data, importable by core, providers and UI.
// This file imports nothing from `src/core/ports/llm.ts`, so there is no import cycle.
export type ProviderId = 'anthropic' | 'openai';

export interface ModelEntry {
  /** Provider model id. */
  id: string;
  /** `<provider>/<id>`, used in the cache key and in usage records. */
  qualifiedId: `${ProviderId}/${string}`;
  displayName: string;
  price: { inputPerMTok: number; outputPerMTok: number; cachedInputPerMTok: number };
  /** The cheapest suitable model of its provider (LLM-10). */
  isDefault: boolean;
  verifiedAt: string;
  sourceUrl: string;
}

export interface ProviderCatalog {
  displayName: string;
  models: readonly ModelEntry[];
}

/**
 * The price catalog. Model entries are filled in sub-change 2b (task 2b.12) after the prices are
 * re-verified against the providers' pricing pages; no price is invented here.
 */
export const PRICE_CATALOG: Readonly<Record<ProviderId, ProviderCatalog>> = {
  anthropic: { displayName: 'Anthropic', models: [] },
  openai: { displayName: 'OpenAI', models: [] },
};

/** Production provider ids, derived from the catalog keys. */
export const REAL_PROVIDER_IDS = Object.keys(PRICE_CATALOG) as readonly ProviderId[];
