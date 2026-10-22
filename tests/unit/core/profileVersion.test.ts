import { describe, expect, it } from 'vitest';
import { dealbreakerRefs, profileVersion } from '../../../src/core/analysis/profileVersion.ts';
import {
  type Branch,
  branchSchema,
  type Claim,
  type CvPdfMeta,
  claimSchema,
  cvPdfMetaSchema,
  type Profile,
  profileSchema,
  titleFilterSchema,
} from '../../../src/core/schemas/profile.ts';

const claim = (n: number, statement: string, tags: string[] = []): Claim => ({
  id: `c-${n}`,
  statement,
  tags,
});

const branch = (n: number, over: Partial<Branch> = {}): Branch => ({
  id: `b-${n}`,
  name: `Branch ${n}`,
  titleFilter: { includeGroups: [], excludeTerms: [] },
  rules: [],
  dealbreakers: [],
  ...over,
});

function profile(over: Partial<Profile> = {}): Profile {
  return {
    id: 'active',
    claims: [claim(1, 'Built a billing service', ['go', 'sql']), claim(2, 'Led a small team')],
    branches: [
      branch(1, { rules: ['prefer remote'], dealbreakers: ['no on-call', 'no relocation'] }),
      branch(2, { name: 'Data', dealbreakers: ['no travel'] }),
    ],
    companyBlocklist: [],
    nextClaimSeq: 3,
    nextBranchSeq: 3,
    ...over,
  };
}

describe('profileVersion (PROFILE-8; A4)', () => {
  it('is deterministic for identical content', async () => {
    const a = await profileVersion(profile(), 'en');
    const b = await profileVersion(profile(), 'en');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is independent of insertion order of claims, branches and tags', async () => {
    const base = profile();
    const shuffled = profile({
      claims: [claim(2, 'Led a small team'), claim(1, 'Built a billing service', ['sql', 'go'])],
      branches: [...base.branches].reverse(),
    });
    expect(await profileVersion(shuffled, 'en')).toBe(await profileVersion(base, 'en'));
  });

  it('keeps numeric id order so c-10 sorts after c-9 consistently', async () => {
    const a = profile({ claims: [claim(9, 'nine'), claim(10, 'ten')] });
    const b = profile({ claims: [claim(10, 'ten'), claim(9, 'nine')] });
    expect(await profileVersion(a, 'en')).toBe(await profileVersion(b, 'en'));
  });

  it.each([
    [
      'a claim statement',
      (p: Profile) => ({
        ...p,
        claims: [claim(1, 'Built a billing system', ['go', 'sql']), p.claims[1] as Claim],
      }),
    ],
    [
      'a claim tag',
      (p: Profile) => ({
        ...p,
        claims: [claim(1, 'Built a billing service', ['go']), p.claims[1] as Claim],
      }),
    ],
    ['claim set membership (removed)', (p: Profile) => ({ ...p, claims: [p.claims[0] as Claim] })],
    [
      'claim set membership (added)',
      (p: Profile) => ({ ...p, claims: [...p.claims, claim(3, 'New')] }),
    ],
    [
      'a branch name',
      (p: Profile) => ({
        ...p,
        branches: [branch(1, { name: 'Renamed' }), p.branches[1] as Branch],
      }),
    ],
    [
      'a branch rule',
      (p: Profile) => ({
        ...p,
        branches: [
          branch(1, { rules: ['prefer onsite'], dealbreakers: ['no on-call', 'no relocation'] }),
          p.branches[1] as Branch,
        ],
      }),
    ],
    [
      'a dealbreaker',
      (p: Profile) => ({
        ...p,
        branches: [
          branch(1, { rules: ['prefer remote'], dealbreakers: ['no on-call'] }),
          p.branches[1] as Branch,
        ],
      }),
    ],
    ['branch set membership', (p: Profile) => ({ ...p, branches: [p.branches[0] as Branch] })],
  ])('changes when %s changes', async (_name, mutate) => {
    const base = profile();
    expect(await profileVersion(mutate(base), 'en')).not.toBe(await profileVersion(base, 'en'));
  });

  it('changes with the output language (A4)', async () => {
    expect(await profileVersion(profile(), 'es')).not.toBe(await profileVersion(profile(), 'en'));
  });

  it('does not change on title filter or company blocklist edits', async () => {
    const base = profile();
    const edited = profile({
      companyBlocklist: ['Acme'],
      branches: base.branches.map((b) => ({
        ...b,
        titleFilter: { includeGroups: [['backend']], excludeTerms: ['intern'] },
      })),
    });
    expect(await profileVersion(edited, 'en')).toBe(await profileVersion(base, 'en'));
  });

  it('does not change on PDF changes (PDFs are not part of the profile document)', async () => {
    const withPdf = { ...profile(), pdfs: [{ id: 'p-1' }] } as unknown as Profile;
    expect(await profileVersion(withPdf, 'en')).toBe(await profileVersion(profile(), 'en'));
  });

  it('does not collide when a value shifts between adjacent fields', async () => {
    const a = profile({ branches: [branch(1, { rules: ['a', 'b'], dealbreakers: [] })] });
    const b = profile({ branches: [branch(1, { rules: ['a'], dealbreakers: ['b'] })] });
    expect(await profileVersion(a, 'en')).not.toBe(await profileVersion(b, 'en'));
  });
});

describe('dealbreakerRefs (ADR-07)', () => {
  it('maps <branchId>/d<index> to the dealbreaker text', () => {
    const refs = dealbreakerRefs(profile());
    expect([...refs.entries()]).toEqual([
      ['b-1/d0', 'no on-call'],
      ['b-1/d1', 'no relocation'],
      ['b-2/d0', 'no travel'],
    ]);
  });

  it('is stable for the same content regardless of branch order', () => {
    const base = profile();
    const reversed = profile({ branches: [...base.branches].reverse() });
    expect([...dealbreakerRefs(reversed)]).toEqual([...dealbreakerRefs(base)]);
  });

  it('is empty when no branch has dealbreakers', () => {
    expect(dealbreakerRefs(profile({ branches: [branch(1)] })).size).toBe(0);
  });
});

describe('profile schemas (PROFILE-3, PROFILE-4, PROFILE-8)', () => {
  it('accepts claim ids of the form c-<n> and rejects others', () => {
    expect(claimSchema.safeParse(claim(7, 'ok')).success).toBe(true);
    for (const id of ['c-', 'c-x', 'C-1', 'b-1', '1', 'c-1 ', 'c--1']) {
      expect(claimSchema.safeParse({ ...claim(1, 'ok'), id }).success, id).toBe(false);
    }
  });

  it('rejects a blank claim statement', () => {
    expect(claimSchema.safeParse(claim(1, '')).success).toBe(false);
    expect(claimSchema.safeParse(claim(1, '   \n')).success).toBe(false);
  });

  it('accepts branch ids of the form b-<n> and rejects others', () => {
    expect(branchSchema.safeParse(branch(3)).success).toBe(true);
    for (const id of ['b-', 'b-x', 'c-1', 'B-1', 'b-1/d0']) {
      expect(branchSchema.safeParse({ ...branch(1), id }).success, id).toBe(false);
    }
  });

  it('parses a whole profile and requires the active id', () => {
    expect(profileSchema.safeParse(profile()).success).toBe(true);
    expect(profileSchema.safeParse({ ...profile(), id: 'other' }).success).toBe(false);
  });

  it('requires non-negative integer sequences', () => {
    expect(profileSchema.safeParse({ ...profile(), nextClaimSeq: -1 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...profile(), nextBranchSeq: 1.5 }).success).toBe(false);
  });

  it('defines the title filter shape', () => {
    expect(
      titleFilterSchema.safeParse({ includeGroups: [['a', 'b'], ['c']], excludeTerms: ['d'] })
        .success,
    ).toBe(true);
    expect(titleFilterSchema.safeParse({ includeGroups: ['a'], excludeTerms: [] }).success).toBe(
      false,
    );
  });

  it('defines the blob-free PDF metadata', () => {
    const meta: CvPdfMeta = {
      id: 'p-1',
      branchId: 'b-1',
      language: 'en',
      fileName: 'cv.pdf',
      size: 10,
      sha256: 'ab'.repeat(32),
      addedAt: 1,
    };
    expect(cvPdfMetaSchema.safeParse(meta).success).toBe(true);
    expect(cvPdfMetaSchema.safeParse({ ...meta, size: -1 }).success).toBe(false);
  });
});
