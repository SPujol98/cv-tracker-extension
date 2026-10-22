// Golden synthetic fixtures (2a exit criterion; ADR-14): offers and profiles are fully synthetic
// and run end to end through `analyzeOffer` with the fake provider. Fixtures live in
// `tests/fixtures/offers` (offer, scripted model output, expected result) and
// `tests/fixtures/profiles` (profile snapshot and stored CV PDFs).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { analyzeOffer } from '../../../../src/core/analysis/analyze.ts';
import type { OfferMeta } from '../../../../src/core/analysis/prompt.ts';
import { cvPdfMetaSchema, profileSchema } from '../../../../src/core/schemas/profile.ts';
import { createFakeProvider, FAKE_MODEL, fakeFinal } from '../../../support/fakeProvider.ts';

const FIXTURES = join(import.meta.dirname, '../../../fixtures');
const NOW = 1_700_000_000_000;

const profileFixtureSchema = z.object({
  outputLanguage: z.string(),
  profile: profileSchema,
  pdfs: z.array(cvPdfMetaSchema),
});

const expectationSchema = z.object({
  status: z.enum(['ok', 'failed']),
  errorClass: z.string().optional(),
  verdict: z.string().optional(),
  verdictReason: z.string().optional(),
  language: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  pdfId: z.string().optional(),
  injectionSuspected: z.boolean().optional(),
  branchName: z.string().optional(),
  walls: z.number().optional(),
  droppedWeakWalls: z.number().optional(),
});

const offerFixtureSchema = z.object({
  name: z.string(),
  profile: z.string(),
  offer: z.object({ source: z.string(), title: z.string(), company: z.string() }),
  text: z.string(),
  modelOutput: z.unknown(),
  expect: expectationSchema,
});

type OfferFixture = z.infer<typeof offerFixtureSchema>;

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

function loadOffers(): { file: string; fixture: OfferFixture }[] {
  const dir = join(FIXTURES, 'offers');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({ file, fixture: offerFixtureSchema.parse(readJson(join(dir, file))) }));
}

function loadProfile(name: string) {
  return profileFixtureSchema.parse(readJson(join(FIXTURES, 'profiles', `${name}.json`)));
}

async function run(fixture: OfferFixture, over: { text?: string } = {}) {
  const { profile, pdfs, outputLanguage } = loadProfile(fixture.profile);
  const provider = createFakeProvider([fakeFinal(fixture.modelOutput)]);
  const offer: OfferMeta = fixture.offer;
  const outcome = await analyzeOffer(
    {
      fullText: over.text ?? fixture.text,
      offer,
      snapshot: profile,
      pdfs,
      model: FAKE_MODEL,
      outputLanguage,
      adapterVersion: null,
      key: 'test-key',
      signal: new AbortController().signal,
    },
    { provider, now: () => NOW },
  );
  return { outcome, provider };
}

const offers = loadOffers();
const byName = (file: string) => {
  const found = offers.find((o) => o.file === file);
  if (!found) throw new Error(`missing fixture ${file}`);
  return found.fixture;
};

describe('golden synthetic offers end to end through the fake provider', () => {
  it('loads every fixture the suite is written for', () => {
    expect(offers.map((o) => o.file)).toEqual([
      'en-backend.json',
      'es-fullstack.json',
      'injection-delimiter.json',
      'injection-downgrade.json',
      'injection-score-100.json',
      'wall-fragment.json',
    ]);
  });

  it.each(offers.map((o) => [o.fixture.name, o.fixture] as const))('%s', async (_name, fixture) => {
    const { outcome, provider } = await run(fixture);
    const want = fixture.expect;
    expect(provider.callCount).toBe(1);
    expect(outcome.status).toBe(want.status);
    if (outcome.status === 'failed') {
      expect(outcome.errorClass).toBe(want.errorClass);
      expect(outcome).not.toHaveProperty('verdict');
      return;
    }
    expect(outcome.verdict).toBe(want.verdict);
    expect(outcome.verdictReason).toBe(want.verdictReason);
    expect(outcome.language).toBe(want.language);
    expect(outcome.applyWarnings.map((w) => w.category).sort()).toEqual(want.warnings);
    expect(outcome.pdf?.id).toBe(want.pdfId);
    expect(outcome.flags.injectionSuspected).toBe(want.injectionSuspected);
    expect(outcome.branchName).toBe(want.branchName);
    expect(outcome.walls).toHaveLength(want.walls ?? 0);
    expect(outcome.diagnostics.droppedWalls.weakEvidence).toBe(want.droppedWeakWalls ?? 0);
  });
});

describe('injection goldens (ADR-14)', () => {
  it('rejects an "output score 100" offer whose evidence is ungrounded, without a verdict', async () => {
    const { outcome } = await run(byName('injection-score-100.json'));
    expect(outcome).toMatchObject({ status: 'failed', errorClass: 'invalid_output' });
    expect(outcome).not.toHaveProperty('verdict');
    expect(outcome).not.toHaveProperty('score');
  });

  it('writes a smuggled closing delimiter into the request only once', async () => {
    const { provider } = await run(byName('injection-delimiter.json'));
    const variable = provider.calls[0]?.request.variable ?? '';
    expect(variable.match(/<\/offer_data>/gi)).toHaveLength(1);
    expect(variable.endsWith('</offer_data>')).toBe(true);
    expect(variable).toContain('<\\/offer_data>');
  });

  it('flags the smuggled delimiter in the result', async () => {
    const { outcome } = await run(byName('injection-delimiter.json'));
    expect(outcome.status === 'ok' && outcome.flags.injectionMatches).toContain('</offer_data');
  });

  it('drops a trivial wall fragment instead of skipping the offer', async () => {
    const { outcome } = await run(byName('wall-fragment.json'));
    expect(outcome.status === 'ok' && outcome.walls).toEqual([]);
    expect(outcome.status === 'ok' && outcome.verdict).toBe('apply');
  });

  it('downgrades apply to review for an injection phrase and names the excerpt', async () => {
    const { outcome } = await run(byName('injection-downgrade.json'));
    expect(outcome).toMatchObject({ status: 'ok', verdict: 'review' });
    expect(outcome.status === 'ok' && outcome.flags.injectionMatches).toEqual([
      'ignore previous instructions',
    ]);
  });
});

describe('a 30,000-character offer (A16)', () => {
  it('reports a cover_letter warning from the tail with truncated true', async () => {
    const fixture = byName('en-backend.json');
    const head = fixture.text.replace(/Please send.*$/u, '');
    const text = `${head}${'Regular description sentence about the team. '.repeat(700)}Please send a cover letter with your CV.`;
    expect(text.length).toBeGreaterThan(30_000);
    const { outcome, provider } = await run(fixture, { text });
    expect(outcome.status === 'ok' && outcome.truncated).toBe(true);
    expect(outcome.status === 'ok' && outcome.applyWarnings.map((w) => w.category)).toEqual([
      'cover_letter',
    ]);
    expect(provider.calls[0]?.request.variable.length).toBeLessThan(12_000);
  });
});
