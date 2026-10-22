import { describe, expect, it } from 'vitest';
import { pickPdf } from '../../../../src/core/analysis/pickPdf.ts';
import type { CvPdfMeta } from '../../../../src/core/schemas/profile.ts';

const pdf = (branchId: string, language: string, over: Partial<CvPdfMeta> = {}): CvPdfMeta => ({
  id: `${branchId}-${language}`,
  branchId,
  language,
  fileName: `${branchId}-${language}.pdf`,
  size: 1000,
  sha256: 'a'.repeat(64),
  addedAt: 1,
  ...over,
});

const backendEn = pdf('b-1', 'en');
const backendEs = pdf('b-1', 'es');
const dataEs = pdf('b-2', 'es');
const all = [backendEn, dataEs, backendEs];

describe('pickPdf (ANALYSIS-8)', () => {
  it('recommends the exact (branch, language) pair', () => {
    expect(pickPdf('b-1', 'es', all)).toEqual({ pdf: backendEs });
    expect(pickPdf('b-1', 'en', all)).toEqual({ pdf: backendEn });
    expect(pickPdf('b-2', 'es', all)).toEqual({ pdf: dataEs });
  });

  it('a null branch gives no_branch with no alternatives to offer', () => {
    expect(pickPdf(null, 'es', all)).toEqual({ pdf: null, reason: 'no_branch', alternatives: [] });
  });

  it('checks the branch before the language', () => {
    expect(pickPdf(null, 'unknown', all)).toMatchObject({ reason: 'no_branch' });
  });

  it('an unknown language gives language_unknown with that branch PDFs as alternatives', () => {
    expect(pickPdf('b-1', 'unknown', all)).toEqual({
      pdf: null,
      reason: 'language_unknown',
      alternatives: [backendEn, backendEs],
    });
  });

  it('a missing language gives no_pdf_for_language, listing that branch PDFs only', () => {
    const onlyEn = [backendEn, dataEs];
    expect(pickPdf('b-1', 'ca', onlyEn)).toEqual({
      pdf: null,
      reason: 'no_pdf_for_language',
      alternatives: [backendEn],
    });
  });

  it('never substitutes another language or another branch', () => {
    const result = pickPdf('b-2', 'en', all);
    expect(result).toEqual({ pdf: null, reason: 'no_pdf_for_language', alternatives: [dataEs] });
  });

  it('a branch with no PDFs at all gives no_pdf_for_language with no alternatives', () => {
    expect(pickPdf('b-9', 'es', all)).toEqual({
      pdf: null,
      reason: 'no_pdf_for_language',
      alternatives: [],
    });
  });

  it('picks the most recently added PDF when a pair is duplicated, whatever the input order', () => {
    const older = pdf('b-1', 'es', { id: 'old', addedAt: 1 });
    const newer = pdf('b-1', 'es', { id: 'new', addedAt: 2 });
    expect(pickPdf('b-1', 'es', [older, newer])).toEqual({ pdf: newer });
    expect(pickPdf('b-1', 'es', [newer, older])).toEqual({ pdf: newer });
  });
});
