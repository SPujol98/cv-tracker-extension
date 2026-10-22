import { describe, expect, it } from 'vitest';
import { type AnalyzeInput, analyzeOffer } from '../../../../src/core/analysis/analyze.ts';
import { profileVersion } from '../../../../src/core/analysis/profileVersion.ts';
import { PROMPT_VERSION } from '../../../../src/core/analysis/prompt.ts';
import { computeCost } from '../../../../src/core/cost.ts';
import { ProviderError } from '../../../../src/core/ports/llm.ts';
import { analysisOutcomeSchema } from '../../../../src/core/schemas/analysis.ts';
import type { Profile } from '../../../../src/core/schemas/profile.ts';
import { ELISION_MARKER, MAX_OFFER_CHARS } from '../../../../src/core/text.ts';
import {
  createFakeProvider,
  FAKE_MODEL,
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
