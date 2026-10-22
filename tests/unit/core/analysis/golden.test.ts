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
describe('golden synthetic offers end to end through the fake provider', () => {
  it('loads every fixture the suite is written for', () => {
    expect(offers.map((o) => o.file)).toEqual(['en-backend.json', 'es-fullstack.json']);
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
