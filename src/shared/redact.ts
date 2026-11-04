// Central redaction utility (PRIV-3, ADR-21). Every message produced from a provider interaction
// passes through here before it is shown or logged, so the user's key never reaches an error
// string, a log line or a notification.
export const REDACTED = '[REDACTED]';

const KEY_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{10,}/g,
  /sk-proj-[A-Za-z0-9_-]{10,}/g,
  /sk-[A-Za-z0-9]{20,}/g,
];

// `x-api-key` and `authorization` header values, in header form (`name: value`), query-like form
// (`name=value`) and JSON form (`"name":"value"`). The scheme word (`Bearer`) goes with the value.
const HEADER_VALUE =
  /(\b(?:x-api-key|authorization)(?:["']?\s*[:=]\s*["']?))(?:bearer\s+)?[^\s"',;}]+/gi;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Masks supplied secrets, provider key patterns and credential header values in `text`. */
export function redact(text: string, secrets: readonly string[] = []): string {
  let out = text;
  // Longest first, so a secret that contains another one is masked whole.
  const known = secrets.filter((secret) => secret.length > 0).sort((a, b) => b.length - a.length);
  for (const secret of known) {
    out = out.replace(new RegExp(escapeRegExp(secret), 'g'), REDACTED);
  }
  out = out.replace(HEADER_VALUE, `$1${REDACTED}`);
  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

/** Redacted message of an error value, followed by the messages of its `cause` chain. */
export function redactError(error: unknown, secrets: readonly string[] = []): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return redact(parts.join(': '), secrets);
}
