// Test-only fake LLM provider (ADR-28). It lives under `tests/` so the release bundle never holds
// it, and its `id` is a plain string because the port types `id` as `string`; services receive
// provider instances as dependencies, so no registry entry is needed.
import type {
  CompletionEvent,
  CompletionRequest,
  KeyCheck,
  LlmProvider,
  ModelEntry,
  Usage,
} from '../../src/core/ports/llm.ts';
import { ProviderError } from '../../src/core/ports/llm.ts';

export const FAKE_PROVIDER_ID = 'fake';

export const FAKE_MODEL = {
  id: 'fake-model',
  qualifiedId: 'anthropic/fake-model',
  displayName: 'Fake model',
  price: { inputPerMTok: 1, outputPerMTok: 2, cachedInputPerMTok: 0.5 },
  isDefault: true,
  verifiedAt: '2026-01-01',
  sourceUrl: 'https://example.com/pricing',
} as const satisfies ModelEntry;

export const FAKE_USAGE: Usage = {
  inputTokens: 100,
  outputTokens: 50,
  cachedInputTokens: 0,
  estimated: false,
};

/** One scripted step: an event to yield, or a `ProviderError` to throw when it is reached. */
export type FakeStep = CompletionEvent | ProviderError;

export function fakeProgress(outputChars: number): CompletionEvent {
  return { type: 'progress', outputChars };
}

export function fakeFinal(
  json: unknown,
  over: { usage?: Usage; model?: string } = {},
): CompletionEvent {
  return {
    type: 'final',
    json,
    usage: over.usage ?? FAKE_USAGE,
    model: over.model ?? FAKE_MODEL.id,
  };
}

export interface FakeProvider extends LlmProvider {
  readonly callCount: number;
  readonly calls: readonly { request: CompletionRequest; key: string }[];
}

/**
 * Every `complete` call replays the same script and is counted before the first step runs. The
 * signal is checked before each step, so an aborted call yields `cancelled` (ADR-21).
 */
export function createFakeProvider(script: readonly FakeStep[]): FakeProvider {
  const calls: { request: CompletionRequest; key: string }[] = [];
  return {
    id: FAKE_PROVIDER_ID,
    displayName: 'Fake',
    origin: 'https://fake.example.com',
    models: [FAKE_MODEL],
    get callCount() {
      return calls.length;
    },
    calls,
    async validateKey(): Promise<KeyCheck> {
      return { result: 'valid' };
    },
    async *complete(request, key, { signal }) {
      calls.push({ request, key });
      for (const step of script) {
        // Like a real adapter (ADR-21), an aborted signal ends the call as `cancelled`.
        if (signal.aborted) throw new ProviderError('cancelled', 'The request was cancelled.');
        if (step instanceof ProviderError) throw step;
        yield step;
      }
    },
  };
}
