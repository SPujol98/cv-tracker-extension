import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  type CompletionEvent,
  type CompletionRequest,
  type LlmProvider,
  ProviderError,
} from '../../../src/core/ports/llm.ts';
import {
  createFakeProvider,
  FAKE_MODEL,
  fakeFinal,
  fakeProgress,
} from '../../support/fakeProvider.ts';

const request: CompletionRequest = {
  modelId: FAKE_MODEL.id,
  prefix: ['rubric'],
  variable: 'offer',
  schemaName: 'offer_analysis_v2',
  jsonSchema: {},
  maxOutputTokens: 100,
};

const signal = new AbortController().signal;

async function collect(provider: LlmProvider): Promise<CompletionEvent[]> {
  const events: CompletionEvent[] = [];
  for await (const event of provider.complete(request, 'test-key', { signal })) events.push(event);
  return events;
}

describe('createFakeProvider (ADR-28)', () => {
  it('is an LlmProvider with a plain-string id', () => {
    const provider = createFakeProvider([fakeFinal({})]);
    expectTypeOf(provider).toMatchTypeOf<LlmProvider>();
    expectTypeOf(provider.id).toBeString();
    expect(provider.id).toBe('fake');
    expect(provider.models).toEqual([FAKE_MODEL]);
  });

  it('yields the scripted progress events and then the final event, in order', async () => {
    const provider = createFakeProvider([
      fakeProgress(10),
      fakeProgress(25),
      fakeFinal({ score: 1 }),
    ]);
    const events = await collect(provider);
    expect(events.map((e) => e.type)).toEqual(['progress', 'progress', 'final']);
    expect(events[2]).toMatchObject({ type: 'final', json: { score: 1 }, model: FAKE_MODEL.id });
  });

  it('lets a final event override usage and model', async () => {
    const usage = { inputTokens: 7, outputTokens: 3, cachedInputTokens: 2, estimated: true };
    const provider = createFakeProvider([fakeFinal({}, { usage, model: 'fake/other' })]);
    expect((await collect(provider))[0]).toMatchObject({ usage, model: 'fake/other' });
  });

  it('throws a scripted ProviderError when the script reaches it, after earlier events', async () => {
    const provider = createFakeProvider([
      fakeProgress(5),
      new ProviderError('rate_limit', 'slow', 1000),
    ]);
    const seen: CompletionEvent[] = [];
    const run = async () => {
      for await (const event of provider.complete(request, 'k', { signal })) seen.push(event);
    };
    await expect(run()).rejects.toMatchObject({ cls: 'rate_limit', retryAfterMs: 1000 });
    expect(seen).toHaveLength(1);
  });

  it('counts calls and records each request and key', async () => {
    const provider = createFakeProvider([fakeFinal({})]);
    expect(provider.callCount).toBe(0);
    await collect(provider);
    await collect(provider);
    expect(provider.callCount).toBe(2);
    expect(provider.calls[1]).toEqual({ request, key: 'test-key' });
  });

  it('counts a call that fails immediately', async () => {
    const provider = createFakeProvider([new ProviderError('auth', 'nope')]);
    await expect(collect(provider)).rejects.toBeInstanceOf(ProviderError);
    expect(provider.callCount).toBe(1);
  });

  it('validates any key as valid', async () => {
    const provider = createFakeProvider([]);
    await expect(provider.validateKey('k', signal)).resolves.toEqual({ result: 'valid' });
  });
});
