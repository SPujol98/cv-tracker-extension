// Recommended CV PDF (ANALYSIS-8; Contract D): the stored PDF for (recommended branch, offer
// language), or a reason and the branch's PDFs. Another language is never substituted.

import type { LanguageCode } from '../languages.ts';
import type { PDF_REASONS } from '../schemas/analysis.ts';
import type { CvPdfMeta } from '../schemas/profile.ts';

export type PdfReason = (typeof PDF_REASONS)[number];

export type PdfPick =
  | { pdf: CvPdfMeta }
  | { pdf: null; reason: PdfReason; alternatives: CvPdfMeta[] };

/** Newest first; the id breaks ties so the order never depends on the input order. */
function newestFirst(a: CvPdfMeta, b: CvPdfMeta): number {
  if (a.addedAt !== b.addedAt) return b.addedAt - a.addedAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Order of checks: no branch, unknown language, then no exact pair. */
export function pickPdf(
  branchId: string | null,
  language: LanguageCode | 'unknown',
  pdfs: readonly CvPdfMeta[],
): PdfPick {
  if (branchId === null) return { pdf: null, reason: 'no_branch', alternatives: [] };
  const alternatives = pdfs.filter((p) => p.branchId === branchId).sort(newestFirst);
  if (language === 'unknown') return { pdf: null, reason: 'language_unknown', alternatives };
  const exact = alternatives.find((p) => p.language === language);
  if (!exact) return { pdf: null, reason: 'no_pdf_for_language', alternatives };
  return { pdf: exact };
}
