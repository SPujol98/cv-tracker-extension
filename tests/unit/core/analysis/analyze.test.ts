import { describe, expect, it } from 'vitest';
import { type AnalyzeInput, analyzeOffer } from '../../../../src/core/analysis/analyze.ts';
import { profileVersion } from '../../../../src/core/analysis/profileVersion.ts';
import { PROMPT_VERSION } from '../../../../src/core/analysis/prompt.ts';
import { computeCost } from '../../../../src/core/cost.ts';
import { type CompletionEvent, ProviderError } from '../../../../src/core/ports/llm.ts';
import { analysisOutcomeSchema } from '../../../../src/core/schemas/analysis.ts';
import type { Profile } from '../../../../src/core/schemas/profile.ts';
import { ELISION_MARKER, MAX_OFFER_CHARS } from '../../../../src/core/text.ts';
import {
  createFakeProvider,
  FAKE_MODEL,
  FAKE_USAGE,
  fakeFinal,
  fakeProgress,
} from '../../../support/fakeProvider.ts';

const snapshot: Profile = {
  id: 'active',
  claims: [{ id: 'c-1', statement: 'Writes TypeScript', tags: [] }],
  branches: [],
  companyBlocklist: [],
  nextClaimSeq: 2,
  nextBranchSeq: 1,
};

const offerText = 'We need five years of TypeScript experience. Remote friendly team.';

const goodOutput = {
  requirements: [
    { text: 'TypeScript experience', evidence: 'five years of TypeScript', must_have: true },
  ],
  fit: [{ requirement: 'TypeScript experience', claim_ids: ['c-1'] }],
  walls: [],
  score: 72,
  branch_id: '',
  rationale: 'Good overlap with the stack.',
};

const NOW = 1_700_000_000_000;

function input(over: Partial<AnalyzeInput> = {}): AnalyzeInput {
  return {
    fullText: offerText,
    offer: { source: 'generic', title: 'Engineer', company: 'Example Co' },
    snapshot,
    pdfs: [],
    model: FAKE_MODEL,
    outputLanguage: 'en',
    adapterVersion: null,
    key: 'test-key',
    signal: new AbortController().signal,
    ...over,
  };
}

const deps = (provider: ReturnType<typeof createFakeProvider>) => ({ provider, now: () => NOW });

describe('analyzeOffer makes exactly one call (ANALYSIS-1; ADR-06)', () => {
  it('calls the provider once and returns a complete ok result', async () => {
    const provider = createFakeProvider([fakeProgress(20), fakeFinal(goodOutput)]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(provider.callCount).toBe(1);
    expect(analysisOutcomeSchema.safeParse(outcome).success).toBe(true);
    expect(outcome).toMatchObject({
      status: 'ok',
      score: 72,
      verdict: 'apply',
      cached: false,
      truncated: false,
      modelId: FAKE_MODEL.qualifiedId,
      promptVersion: PROMPT_VERSION,
      outputLanguage: 'en',
      adapterVersion: null,
      createdAt: NOW,
    });
    expect(outcome.status === 'ok' && outcome.profileVersion).toBe(
      await profileVersion(snapshot, 'en'),
    );
  });

  it('builds the request from the prompt, the schema and the key', async () => {
    const provider = createFakeProvider([fakeFinal(goodOutput)]);
    await analyzeOffer(input(), deps(provider));
    const call = provider.calls[0];
    expect(call?.key).toBe('test-key');
    expect(call?.request).toMatchObject({
      modelId: FAKE_MODEL.id,
      schemaName: 'offer_analysis_v2',
    });
    expect(call?.request.prefix).toHaveLength(3);
    expect(call?.request.variable).toContain(offerText);
    expect(call?.request.maxOutputTokens).toBeGreaterThan(0);
  });

  it('asks the model for no verdict, language or PDF', async () => {
    const provider = createFakeProvider([fakeFinal(goodOutput)]);
    await analyzeOffer(input(), deps(provider));
    const schema = JSON.stringify(provider.calls[0]?.request.jsonSchema);
    for (const field of ['verdict', 'language', 'pdf']) expect(schema).not.toContain(field);
  });

  it('rejects an output that carries a verdict, language or PDF of its own', async () => {
    const provider = createFakeProvider([fakeFinal({ ...goodOutput, verdict: 'apply' })]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'invalid_output' });
  });
});

describe('analyzeOffer failures are typed and never retried', () => {
  it('yields invalid_output for malformed output after exactly one call', async () => {
    const provider = createFakeProvider([fakeFinal({ requirements: [] })]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome).toMatchObject({
      status: 'failed',
      errorClass: 'invalid_output',
      createdAt: NOW,
    });
    expect(provider.callCount).toBe(1);
  });

  it('yields invalid_output when the stream ends without a final event', async () => {
    const provider = createFakeProvider([fakeProgress(5)]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'invalid_output' });
    expect(provider.callCount).toBe(1);
  });

  it('names the failing post-validation step in the message', async () => {
    const provider = createFakeProvider([fakeFinal({ ...goodOutput, score: 101 })]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome.status === 'failed' && outcome.message).toContain('score');
  });

  it('surfaces an auth error typed, with no verdict, after one call', async () => {
    const provider = createFakeProvider([new ProviderError('auth', 'bad key')]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome).toEqual({
      status: 'failed',
      errorClass: 'auth',
      message: 'bad key',
      createdAt: NOW,
    });
    expect(outcome).not.toHaveProperty('verdict');
    expect(provider.callCount).toBe(1);
  });

  it('surfaces a mid-stream error with the same class and does not retry', async () => {
    const provider = createFakeProvider([
      fakeProgress(3),
      new ProviderError('transient', 'dropped', undefined, true),
    ]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'transient' });
    expect(provider.callCount).toBe(1);
  });

  it('does not swallow an error that is not a ProviderError', async () => {
    const provider = createFakeProvider([]);
    provider.complete = () => {
      throw new TypeError('bug');
    };
    await expect(analyzeOffer(input(), deps(provider))).rejects.toBeInstanceOf(TypeError);
  });
});

describe('analyzeOffer cancellation (ADR-21; R3-abort-path-unproved)', () => {
  it('returns a typed cancelled failure without calling the provider when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const provider = createFakeProvider([fakeFinal(goodOutput)]);
    const outcome = await analyzeOffer(input({ signal: controller.signal }), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'cancelled', createdAt: NOW });
    expect(outcome).not.toHaveProperty('verdict');
    expect(provider.callCount).toBe(0);
  });

  it('returns cancelled when the signal aborts mid-stream (fake honours the signal)', async () => {
    const controller = new AbortController();
    const fake = createFakeProvider([fakeProgress(3), fakeFinal(goodOutput)]);
    const provider = {
      ...fake,
      async *complete(...args: Parameters<typeof fake.complete>): AsyncGenerator<CompletionEvent> {
        for await (const event of fake.complete(...args)) {
          yield event;
          controller.abort();
        }
      },
    };
    const outcome = await analyzeOffer(
      input({ signal: controller.signal }),
      deps(provider as unknown as ReturnType<typeof createFakeProvider>),
    );
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'cancelled' });
    expect(outcome).not.toHaveProperty('score');
    expect(fake.callCount).toBe(1);
  });

  it('maps a raw AbortError thrown while the signal is aborted to cancelled', async () => {
    const controller = new AbortController();
    const provider = createFakeProvider([]);
    // biome-ignore lint/correctness/useYield: the stub aborts and throws like a fetch would
    provider.complete = async function* () {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    };
    const outcome = await analyzeOffer(input({ signal: controller.signal }), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'cancelled' });
  });

  it('discards a final result that arrives after the abort (nothing is returned for caching)', async () => {
    const controller = new AbortController();
    const provider = createFakeProvider([]);
    provider.complete = async function* () {
      controller.abort();
      yield { type: 'final', json: goodOutput, usage: FAKE_USAGE, model: FAKE_MODEL.id };
    };
    const outcome = await analyzeOffer(input({ signal: controller.signal }), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'cancelled' });
  });

  it('keeps the billed usage and cost on the cancelled failure of a late final (R4-001)', async () => {
    const controller = new AbortController();
    const provider = createFakeProvider([]);
    const usage = {
      inputTokens: 1_000,
      outputTokens: 400,
      cachedInputTokens: 200,
      estimated: false,
    };
    provider.complete = async function* () {
      controller.abort();
      yield { type: 'final', json: goodOutput, usage, model: FAKE_MODEL.id };
    };
    const outcome = await analyzeOffer(input({ signal: controller.signal }), deps(provider));
    const { costUsd, estimated } = computeCost(usage, FAKE_MODEL.price);
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'cancelled' });
    expect(outcome).toHaveProperty('usage', {
      inputTokens: 1_000,
      outputTokens: 400,
      cachedInputTokens: 200,
      costUsd,
      estimated,
    });
    expect(analysisOutcomeSchema.parse(outcome)).toEqual(outcome);
  });

  it('carries no usage on a cancelled failure that never saw a final event', async () => {
    const controller = new AbortController();
    controller.abort();
    const outcome = await analyzeOffer(
      input({ signal: controller.signal }),
      deps(createFakeProvider([])),
    );
    expect(outcome).not.toHaveProperty('usage');
  });

  it.each(['transient', 'rate_limit', 'auth', 'timeout'] as const)(
    'maps a %s ProviderError thrown while aborted to cancelled (R3 abort precedence)',
    async (cls) => {
      const controller = new AbortController();
      const provider = createFakeProvider([]);
      // biome-ignore lint/correctness/useYield: the stub aborts and throws a classified error
      provider.complete = async function* () {
        controller.abort();
        throw new ProviderError(cls, 'late transport failure');
      };
      const outcome = await analyzeOffer(input({ signal: controller.signal }), deps(provider));
      expect(outcome).toMatchObject({ status: 'failed', errorClass: 'cancelled' });
    },
  );

  it('keeps the error class of a ProviderError when the signal is not aborted', async () => {
    const provider = createFakeProvider([new ProviderError('rate_limit', 'slow down')]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'rate_limit' });
  });

  it('rethrows a programming error even when the signal is aborted (R4-002)', async () => {
    const controller = new AbortController();
    const provider = createFakeProvider([]);
    // biome-ignore lint/correctness/useYield: the stub aborts and then hits a bug
    provider.complete = async function* () {
      controller.abort();
      throw new TypeError('bug');
    };
    await expect(
      analyzeOffer(input({ signal: controller.signal }), deps(provider)),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('rethrows an AbortError when nothing was aborted', async () => {
    const provider = createFakeProvider([]);
    // biome-ignore lint/correctness/useYield: the stub throws like a foreign abort
    provider.complete = async function* () {
      throw new DOMException('aborted', 'AbortError');
    };
    await expect(analyzeOffer(input(), deps(provider))).rejects.toBeInstanceOf(DOMException);
  });

  it('still surfaces a non-abort error that is not a ProviderError', async () => {
    const provider = createFakeProvider([]);
    provider.complete = () => {
      throw new TypeError('bug');
    };
    await expect(analyzeOffer(input(), deps(provider))).rejects.toBeInstanceOf(TypeError);
  });
});

describe('analyzeOffer usage and truncation', () => {
  it('forwards usage and prices it with the model price', async () => {
    const usage = {
      inputTokens: 1_000,
      outputTokens: 400,
      cachedInputTokens: 200,
      estimated: true,
    };
    const provider = createFakeProvider([fakeFinal(goodOutput, { usage })]);
    const outcome = await analyzeOffer(input(), deps(provider));
    const { costUsd } = computeCost(usage, FAKE_MODEL.price);
    expect(outcome.status === 'ok' && outcome.usage).toEqual({
      inputTokens: 1_000,
      outputTokens: 400,
      cachedInputTokens: 200,
      costUsd,
      estimated: true,
    });
    expect(costUsd).toBeGreaterThan(0);
  });

  it('sets truncated and caps the request when the offer exceeds the cap', async () => {
    const fullText = `${offerText} ${'Filler sentence about the team. '.repeat(600)}Please send a cover letter.`;
    expect(fullText.length).toBeGreaterThan(MAX_OFFER_CHARS);
    const provider = createFakeProvider([fakeFinal(goodOutput)]);
    const outcome = await analyzeOffer(input({ fullText }), deps(provider));
    expect(outcome.status === 'ok' && outcome.truncated).toBe(true);
    const variable = provider.calls[0]?.request.variable ?? '';
    expect(variable).toContain(ELISION_MARKER);
    expect(variable.length).toBeLessThan(fullText.length);
  });

  it('does not set truncated for an offer under the cap', async () => {
    const provider = createFakeProvider([fakeFinal(goodOutput)]);
    const outcome = await analyzeOffer(input(), deps(provider));
    expect(outcome.status === 'ok' && outcome.truncated).toBe(false);
  });
});
