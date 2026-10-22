// Profile schemas (PROFILE-1..8, Contract I). Zod is the single source of truth for the types.
import { z } from 'zod';

const CLAIM_ID = /^c-\d+$/;
const BRANCH_ID = /^b-\d+$/;

const sequence = z.number().int().nonnegative();

/** Include groups (each needs one matching term) and exclude terms for beacon title filtering (BEACON-3). */
export const titleFilterSchema = z.object({
  includeGroups: z.array(z.array(z.string())),
  excludeTerms: z.array(z.string()),
});

export type TitleFilter = z.infer<typeof titleFilterSchema>;

/** A claim about the candidate. Ids are `c-<n>` and are never reused after deletion. */
export const claimSchema = z.object({
  id: z.string().regex(CLAIM_ID),
  statement: z.string().refine((value) => value.trim().length > 0, 'statement must not be blank'),
  tags: z.array(z.string()),
});

export type Claim = z.infer<typeof claimSchema>;

/** A user-defined branch. Ids are `b-<n>`. */
export const branchSchema = z.object({
  id: z.string().regex(BRANCH_ID),
  name: z.string(),
  titleFilter: titleFilterSchema,
  rules: z.array(z.string()),
  dealbreakers: z.array(z.string()),
});

export type Branch = z.infer<typeof branchSchema>;

function hasDuplicateIds(items: readonly { id: string }[]): boolean {
  return new Set(items.map((item) => item.id)).size !== items.length;
}

/** The single stored profile document. Empty on a fresh install (PROFILE-1). */
export const profileSchema = z
  .object({
    id: z.literal('active'),
    claims: z.array(claimSchema),
    branches: z.array(branchSchema),
    companyBlocklist: z.array(z.string()),
    nextClaimSeq: sequence,
    nextBranchSeq: sequence,
  })
  .superRefine((profile, ctx) => {
    if (hasDuplicateIds(profile.claims)) {
      ctx.addIssue({ code: 'custom', path: ['claims'], message: 'claim ids must be unique' });
    }
    if (hasDuplicateIds(profile.branches)) {
      ctx.addIssue({ code: 'custom', path: ['branches'], message: 'branch ids must be unique' });
    }
  });

export type Profile = z.infer<typeof profileSchema>;

/**
 * A stored CV PDF without its blob. `language` is a language-table code; the table itself
 * arrives with the language module, so it is a plain string here.
 */
export const cvPdfMetaSchema = z.object({
  id: z.string(),
  branchId: z.string(),
  language: z.string(),
  fileName: z.string(),
  size: sequence,
  sha256: z.string(),
  addedAt: z.number(),
});

export type CvPdfMeta = z.infer<typeof cvPdfMetaSchema>;

/** A stored CV PDF with its binary object (PROFILE-6). Not a Zod schema: a `Blob` is not JSON. */
export type CvPdf = CvPdfMeta & { blob: Blob };

/**
 * Numeric part of a `c-<n>` or `b-<n>` id; ids sort by it so `c-10` follows `c-9`. An id the
 * schema would reject has no numeric part and sorts last, so the comparison never sees NaN.
 */
function sequenceOf(id: string): number {
  const sequence = Number(id.slice(id.indexOf('-') + 1));
  return Number.isNaN(sequence) ? Number.POSITIVE_INFINITY : sequence;
}

/** Total order: numeric suffix first, then the full id string, so insertion order never matters. */
function compareIds(a: string, b: string): number {
  const bySequence = sequenceOf(a) - sequenceOf(b);
  if (bySequence < 0) return -1;
  if (bySequence > 0) return 1;
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => compareIds(a.id, b.id));
}

/** Claims in id order. */
export function sortedClaims(claims: readonly Claim[]): Claim[] {
  return byId(claims);
}

/** Branches in id order. */
export function sortedBranches(branches: readonly Branch[]): Branch[] {
  return byId(branches);
}
