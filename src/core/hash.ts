// One SHA-256 helper for the pure core. `crypto.subtle` exists in the service worker, pages and
// Node, and is not one of the globals the core lint rules ban.

/** Lowercase hex SHA-256 of the UTF-8 encoding of `text`. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
