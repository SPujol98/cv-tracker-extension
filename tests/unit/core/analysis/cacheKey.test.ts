import { describe, expect, it } from 'vitest';
import { cacheKey } from '../../../../src/core/analysis/cacheKey.ts';
import {
  AUDIT_TABLES,
  AUDIT_VERSION,
  auditRationale,
} from '../../../../src/core/analysis/rationaleAudit.ts';
import { sha256Hex } from '../../../../src/core/hash.ts';

const base = ['offer text', 'anthropic/model-a', 'analysis-2', 'pv-1'] as const;

describe('cacheKey (ANALYSIS-9, interpretation (a))', () => {
  it('is sha256(requestText \\0 qualifiedModelId \\0 promptVersion \\0 profileVersion)', async () => {
    expect(await cacheKey(...base)).toBe(
      await sha256Hex('offer text\0anthropic/model-a\0analysis-2\0pv-1'),
    );
  });

  it('is deterministic', async () => {
    expect(await cacheKey(...base)).toBe(await cacheKey(...base));
  });

  it.each([
    ['request text', 0, 'other offer'],
    ['qualified model id', 1, 'openai/model-a'],
    ['prompt version', 2, 'analysis-3'],
    ['profile version', 3, 'pv-2'],
  ])('changes when the %s changes', async (_name, index, value) => {
    const parts = [...base] as [string, string, string, string];
    parts[index] = value;
    expect(await cacheKey(...parts)).not.toBe(await cacheKey(...base));
  });

  it('separates the model id by provider: the same model name under two providers misses', async () => {
    expect(await cacheKey('t', 'anthropic/x', 'p', 'v')).not.toBe(
      await cacheKey('t', 'openai/x', 'p', 'v'),
    );
  });
});

describe('the audit version is not a cache-key component (ADR-29; A15)', () => {
  it('takes exactly the four key components, so an audit change never discards cached output', () => {
    // Characterization of the 2a.7 key: nothing here can carry `AUDIT_VERSION`.
    expect(cacheKey.length).toBe(4);
  });

  it('pins the key for fixed inputs, so it cannot silently gain a component (R3)', async () => {
    expect(await cacheKey('offer text', 'anthropic/model-x', 'prompt-1', 'profile-1')).toBe(
      'a0fe4fab45dde010042627ba9a6bb948856b62eff04f3a841edbe719a28aca54',
    );
  });

  it('is unchanged when the audit tables and version change', async () => {
    const before = await cacheKey('offer text', 'anthropic/model-x', 'prompt-1', 'profile-1');
    const tables = {
      ...AUDIT_TABLES,
      version: 'audit-next',
      durationUnits: [...AUDIT_TABLES.durationUnits, 'anys'],
    };
    const audited = auditRationale('Has 3 anys.', '', { score: 50, ids: [], tables });
    expect(audited).toEqual({ count: 1, samples: ['3 anys'], auditVersion: 'audit-next' });
    expect(AUDIT_VERSION).not.toBe('audit-next');
    expect(await cacheKey('offer text', 'anthropic/model-x', 'prompt-1', 'profile-1')).toBe(before);
  });
});
