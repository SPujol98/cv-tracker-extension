// Derived fields of an analysis (Contract C steps 9-13; ANALYSIS-9, ANALYSIS-10; amendments A15,
// A18). `derive` runs on every fresh result and on every cache hit, so verdict, language, warnings,
// injection flags and the recommended PDF always come from the current offer text and PDFs; only
// the `ValidatedOutput` is ever stored.
import { detectApplyWarnings } from '../applyWarnings.ts';
import { injectionSignals } from '../injectionSignals.ts';
import { inferLanguage } from '../language.ts';
import type { AnalysisResult, ValidatedOutput } from '../schemas/analysis.ts';
import type { CvPdfMeta, Profile } from '../schemas/profile.ts';
import { pickPdf } from './pickPdf.ts';
import { deriveVerdict } from './verdict.ts';

/** Fields of the result that come from the call itself, not from the validated output. */
export interface DeriveMeta {
  cached: boolean;
  truncated: boolean;
  usage: AnalysisResult['usage'];
  modelId: string;
  promptVersion: string;
  profileVersion: string;
  adapterVersion: string | null;
  outputLanguage: string;
  createdAt: number;
}

export interface DeriveContext {
  /** The full normalized offer text, never the capped request (A16). */
  fullText: string;
  snapshot: Profile;
  pdfs: readonly CvPdfMeta[];
  meta: DeriveMeta;
}

export function derive(validated: ValidatedOutput, context: DeriveContext): AnalysisResult {
  const { fullText, snapshot, pdfs, meta } = context;
  const injection = injectionSignals(fullText);
  const { verdict, reason } = deriveVerdict({
    score: validated.score,
    acceptedWalls: validated.walls,
    injectionSuspected: injection.suspected,
    // A18: the count stands in for the rationale, which the verdict never sees.
    ungroundedClaims: validated.diagnostics.ungroundedClaims.count,
  });
  const language = inferLanguage(fullText);
  const pick = pickPdf(validated.branchId, language, pdfs);
  const branch = snapshot.branches.find((b) => b.id === validated.branchId);
  return {
    status: 'ok',
    score: validated.score,
    verdict,
    verdictReason: reason,
    requirements: validated.requirements,
    fit: validated.fit,
    walls: validated.walls,
    rationale: validated.rationale,
    language,
    applyWarnings: detectApplyWarnings(fullText),
    branchId: validated.branchId,
    branchName: branch?.name ?? null,
    pdf: pick.pdf,
    pdfReason: pick.pdf ? null : pick.reason,
    pdfAlternatives: pick.pdf ? [] : pick.alternatives,
    truncated: meta.truncated,
    cached: meta.cached,
    usage: meta.usage,
    modelId: meta.modelId,
    promptVersion: meta.promptVersion,
    profileVersion: meta.profileVersion,
    adapterVersion: meta.adapterVersion,
    outputLanguage: meta.outputLanguage,
    diagnostics: validated.diagnostics,
    flags: { injectionSuspected: injection.suspected, injectionMatches: injection.matches },
    createdAt: meta.createdAt,
  };
}
