// Chrome derives an unpacked extension's ID from its manifest `key` (SHELL-2, ADR-15):
// the first 128 bits of SHA-256 over the DER-encoded public key, each hex digit mapped 0-f to a-p.
export async function deriveExtensionId(publicKeyDer: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', publicKeyDer as BufferSource);
  const hex = Array.from(new Uint8Array(digest).slice(0, 16), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return Array.from(hex, (c) =>
    String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(c, 16)),
  ).join('');
}
