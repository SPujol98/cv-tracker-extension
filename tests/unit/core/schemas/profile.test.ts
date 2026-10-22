import { describe, expect, it } from 'vitest';
import {
  type Branch,
  type Claim,
  profileSchema,
  sortedBranches,
  sortedClaims,
} from '../../../../src/core/schemas/profile.ts';

const claim = (id: string): Claim => ({ id, statement: `statement ${id}`, tags: [] });

const branch = (id: string): Branch => ({
  id,
  name: `name ${id}`,
  titleFilter: { includeGroups: [], excludeTerms: [] },
  rules: [],
  dealbreakers: [],
});

const profileWith = (claims: Claim[], branches: Branch[]) => ({
  id: 'active' as const,
  claims,
  branches,
  companyBlocklist: [],
  nextClaimSeq: 100,
  nextBranchSeq: 100,
});

describe('profileSchema ids', () => {
  it('accepts unique, well-formed ids', () => {
    const parsed = profileSchema.safeParse(
      profileWith([claim('c-1'), claim('c-2')], [branch('b-1'), branch('b-2')]),
    );
    expect(parsed.success).toBe(true);
  });

  it('rejects duplicate claim ids', () => {
    const parsed = profileSchema.safeParse(profileWith([claim('c-1'), claim('c-1')], []));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['claims']);
  });

  it('rejects duplicate branch ids', () => {
    const parsed = profileSchema.safeParse(profileWith([], [branch('b-3'), branch('b-3')]));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.path).toEqual(['branches']);
  });

  it('rejects malformed claim and branch ids', () => {
    expect(profileSchema.safeParse(profileWith([claim('c-x')], [])).success).toBe(false);
    expect(profileSchema.safeParse(profileWith([claim('b-1')], [])).success).toBe(false);
    expect(profileSchema.safeParse(profileWith([], [branch('b-')])).success).toBe(false);
    expect(profileSchema.safeParse(profileWith([], [branch('c-1')])).success).toBe(false);
  });

  it('keeps the same numeric sequence under different spellings as distinct ids', () => {
    expect(profileSchema.safeParse(profileWith([claim('c-1'), claim('c-01')], [])).success).toBe(
      true,
    );
  });
});

describe('sortedClaims and sortedBranches', () => {
  it('orders by numeric suffix, so c-10 follows c-9', () => {
    const ids = sortedClaims([claim('c-10'), claim('c-2'), claim('c-9')]).map((c) => c.id);
    expect(ids).toEqual(['c-2', 'c-9', 'c-10']);
    expect(sortedBranches([branch('b-3'), branch('b-1')]).map((b) => b.id)).toEqual(['b-1', 'b-3']);
  });

  it('breaks numeric ties on the full id string, whatever the insertion order', () => {
    const forward = sortedClaims([claim('c-01'), claim('c-1'), claim('c-001')]).map((c) => c.id);
    const reverse = sortedClaims([claim('c-001'), claim('c-1'), claim('c-01')]).map((c) => c.id);
    expect(forward).toEqual(['c-001', 'c-01', 'c-1']);
    expect(reverse).toEqual(forward);
  });

  it('is total even for ids the schema would reject (no NaN comparisons)', () => {
    const orders = [
      ['c-2', 'c-x', 'c-1', 'c-y'],
      ['c-y', 'c-1', 'c-x', 'c-2'],
      ['c-x', 'c-y', 'c-2', 'c-1'],
    ].map((ids) => sortedClaims(ids.map(claim)).map((c) => c.id));
    expect(orders[0]).toEqual(['c-1', 'c-2', 'c-x', 'c-y']);
    expect(orders[1]).toEqual(orders[0]);
    expect(orders[2]).toEqual(orders[0]);
  });
});
