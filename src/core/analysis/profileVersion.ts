// Profile version for cache keys (PROFILE-8; amendment A4) and dealbreaker references (ADR-07).
import { sha256Hex } from '../hash.ts';
import { type Profile, sortedBranches, sortedClaims } from '../schemas/profile.ts';

/**
 * sha256 of the canonical JSON of every analysis-prompt input: claims (id, statement, sorted tags),
 * branches (id, name, rules, dealbreakers) and the output language. PDFs, title filters, the
 * company blocklist and sequence counters are excluded. Asynchronous because `crypto.subtle` is.
 */
export async function profileVersion(profile: Profile, outputLanguage: string): Promise<string> {
  const canonical = {
    claims: sortedClaims(profile.claims).map((c) => ({
      id: c.id,
      statement: c.statement,
      tags: [...c.tags].sort(),
    })),
    branches: sortedBranches(profile.branches).map((b) => ({
      id: b.id,
      name: b.name,
      rules: b.rules,
      dealbreakers: b.dealbreakers,
    })),
    outputLanguage,
  };
  return sha256Hex(JSON.stringify(canonical));
}

/** `<branchId>/d<index>` (zero-based position in the branch) to the dealbreaker text, in id order. */
export function dealbreakerRefs(profile: Pick<Profile, 'branches'>): Map<string, string> {
  const refs = new Map<string, string>();
  for (const branch of sortedBranches(profile.branches)) {
    branch.dealbreakers.forEach((text, index) => {
      refs.set(`${branch.id}/d${index}`, text);
    });
  }
  return refs;
}
