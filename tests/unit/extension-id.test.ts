import { describe, expect, it } from 'vitest';
import { deriveExtensionId } from '../../src/core/extensionId.ts';

// Synthetic RSA-2048 public key (SPKI DER, base64) generated for this test only. The expected ID was
// computed independently with `sha256sum` over the DER bytes: first 32 hex digits, 0-f mapped to a-p.
const SYNTHETIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5zkMrGc4P5NH7edSAZS34nqqVKFVhh5ejFunDqhl0qjm1wi44zpWrpsXXN6Gge/Nplkv90jjMpstrzMjJga5uKdvx2A52yBgP8KBgI5vi72o3NwmEIimDe2dqrLyNAdpVgCBfzVj7rh11ANzB70toBcnZsl2SfidqV0IKmXJ+YxJPGZr//2rkdf6iNvbrHHM4/yy/4beqEHr15XgTMFp5QFyWcKwYZ1iQ/hGbA3N90ArpzeDY0graH4o6YYezzaQA9mGWF5TrQ5kGOzJwI+2dneZCqYn5Otq3ivIbWplxZ442x693ar0MK2JqPHLlM1ofGudVxoUSJnb+4AiMdcVUQIDAQAB';
const SYNTHETIC_ID = 'ckpnfghkfnfnfcgapocdjiakplfmhpaf';

const der = (b64: string) => Uint8Array.from(Buffer.from(b64, 'base64'));

describe('deriveExtensionId (SHELL-2)', () => {
  it('returns the documented ID for the synthetic key vector', async () => {
    expect(await deriveExtensionId(der(SYNTHETIC_KEY))).toBe(SYNTHETIC_ID);
  });

  it('returns 32 characters from a to p', async () => {
    expect(await deriveExtensionId(der(SYNTHETIC_KEY))).toMatch(/^[a-p]{32}$/);
  });

  it('changes when the key changes', async () => {
    const other = der(SYNTHETIC_KEY);
    other[other.length - 8] = (other[other.length - 8] ?? 0) ^ 1;
    expect(await deriveExtensionId(other)).not.toBe(SYNTHETIC_ID);
  });
});
