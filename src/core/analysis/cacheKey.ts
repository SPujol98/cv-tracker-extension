// Content-hash cache key (ANALYSIS-9, interpretation (a)). `AUDIT_VERSION` is deliberately not a
// component: the rationale audit is re-run on every result, so an audit change must not discard
// cached model output (ADR-29).
import { sha256Hex } from '../hash.ts';

/**
 * `sha256(requestText \0 qualifiedModelId \0 promptVersion \0 profileVersion)`. The model id is
 * provider-qualified (`<provider>/<model>`) and `requestText` is the capped, normalized text.
 */
export function cacheKey(
  requestText: string,
  qualifiedModelId: string,
  promptVersion: string,
  profileVersion: string,
): Promise<string> {
  return sha256Hex([requestText, qualifiedModelId, promptVersion, profileVersion].join('\0'));
}
