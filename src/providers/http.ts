// Shared HTTP helper for the provider adapters (ADR-21; LLM-4, LLM-5). One place owns retry,
// timeouts, cancellation and error redaction so the Anthropic and OpenAI adapters cannot drift.
// Time and transport are injected, which makes every rule testable with a fake clock and fetch.
import { type LlmErrorClass, ProviderError } from '../core/ports/llm.ts';
import type { Clock, FetchLike } from '../core/ports/runtime.ts';
import { redact } from '../shared/redact.ts';

/** At most this many retries after the first request (LLM-5). */
export const MAX_RETRIES = 2;
/** First retry waits this long; each later one doubles it. */
export const BASE_BACKOFF_MS = 2_000;
/** A required wait above this ends the call as `rate_limit`; the caller reschedules. */
export const RETRY_WAIT_CAP_MS = 20_000;
/** No chunk for this long ends the call as `timeout`. Reset by every chunk. */
export const INACTIVITY_TIMEOUT_MS = 60_000;
/** Total duration of one call, retries and waits included. */
export const TOTAL_TIMEOUT_MS = 240_000;
/** Longest slice of an error body kept in a message. */
const ERROR_BODY_LIMIT = 300;

export interface HttpDeps {
  fetch: FetchLike;
  clock: Clock;
}

export interface StreamRequest {
  url: string;
  /** Method, headers and body. `signal` is owned by the helper and overwritten. */
  init: RequestInit;
  /** Values to mask in every error message, normally the user's key. */
  secrets?: readonly string[];
}

/** Completion status mapping of ADR-21 (key validation has its own mapping, ADR-13). */
export function classifyStatus(status: number): LlmErrorClass {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'transient';
  return 'invalid_request';
}

const isRetryable = (cls: LlmErrorClass): boolean => cls === 'transient' || cls === 'rate_limit';

/** `Retry-After` as milliseconds: delta-seconds or an HTTP date measured on the injected clock. */
function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Number(text) * 1_000;
  const date = Date.parse(text);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/** Per-call abort state: one controller for the fetch, plus the timers that can fire it. */
class CallGuard {
  readonly controller = new AbortController();
  private reason: 'timeout' | 'cancelled' | undefined;
  private inactivity: AbortController | undefined;
  private readonly total = new AbortController();
  private readonly aborted: Promise<never>;
  private readonly onUserAbort = (): void => this.abort('cancelled');

  constructor(
    private readonly clock: Clock,
    private readonly userSignal: AbortSignal,
    private readonly secrets: readonly string[],
  ) {
    this.aborted = new Promise<never>((_, reject) => {
      this.controller.signal.addEventListener('abort', () => reject(this.abortError(false)), {
        once: true,
      });
    });
    this.aborted.catch(() => {});
    if (userSignal.aborted) {
      this.abort('cancelled');
      return;
    }
    userSignal.addEventListener('abort', this.onUserAbort, { once: true });
    this.timer(TOTAL_TIMEOUT_MS, this.total.signal, () => this.abort('timeout'));
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get wasAborted(): boolean {
    return this.reason !== undefined;
  }

  private abort(reason: 'timeout' | 'cancelled'): void {
    this.reason ??= reason;
    this.controller.abort();
  }

  private timer(ms: number, signal: AbortSignal, onFire: () => void): void {
    this.clock.sleep(ms, signal).then(
      () => {
        if (!signal.aborted) onFire();
      },
      () => {},
    );
  }

  /** (Re)starts the 60 s inactivity timer. */
  armInactivity(): void {
    this.inactivity?.abort();
    if (this.controller.signal.aborted) return;
    const timer = new AbortController();
    this.inactivity = timer;
    this.timer(INACTIVITY_TIMEOUT_MS, timer.signal, () => this.abort('timeout'));
  }

  disarmInactivity(): void {
    this.inactivity?.abort();
    this.inactivity = undefined;
  }

  abortError(afterFirstChunk: boolean): ProviderError {
    return this.reason === 'timeout'
      ? new ProviderError('timeout', 'The provider call timed out.', undefined, afterFirstChunk)
      : new ProviderError('cancelled', 'The request was cancelled.', undefined, afterFirstChunk);
  }

  /** Settles with `promise`, or rejects as soon as the call is aborted for any reason. */
  race<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([promise, this.aborted]);
  }

  /** Converts any failure of an attempt into the closed taxonomy, redacted. */
  normalize(error: unknown, afterFirstChunk: boolean): ProviderError {
    if (this.reason !== undefined) return this.abortError(afterFirstChunk);
    if (error instanceof ProviderError) return error;
    const text = error instanceof Error ? error.message : String(error);
    return new ProviderError(
      'transient',
      redact(`Network error: ${text}`, this.secrets),
      undefined,
      afterFirstChunk,
    );
  }

  dispose(): void {
    this.userSignal.removeEventListener('abort', this.onUserAbort);
    this.disarmInactivity();
    this.total.abort();
    this.controller.abort();
  }
}

async function statusError(
  response: Response,
  call: CallGuard,
  clock: Clock,
  secrets: readonly string[],
): Promise<ProviderError> {
  const cls = classifyStatus(response.status);
  let snippet = '';
  try {
    snippet = (await call.race(response.text())).slice(0, ERROR_BODY_LIMIT).trim();
  } catch {
    // An unreadable body only loses detail; the status already classifies the failure.
  }
  const message = redact(
    `Provider responded with HTTP ${response.status}${snippet ? `: ${snippet}` : ''}`,
    secrets,
  );
  const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'), clock.now());
  return new ProviderError(cls, message, retryAfterMs);
}

/**
 * Sends one request and yields its body as decoded text chunks. Only `transient` and
 * `rate_limit` failures that happen before the first chunk are retried (at most 2 times, waiting
 * `max(Retry-After, 2 s * 2^(n-1))`); a required wait above 20 s ends the call as `rate_limit`
 * carrying `retryAfterMs`. Every failure is a `ProviderError` whose message is redacted.
 */
export async function* streamRequest(
  deps: HttpDeps,
  request: StreamRequest,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const secrets = request.secrets ?? [];
  const call = new CallGuard(deps.clock, signal, secrets);
  try {
    for (let attempt = 0; ; attempt++) {
      let started = false;
      try {
        if (call.wasAborted) throw call.abortError(false);
        call.armInactivity();
        const response = await call.race(
          deps.fetch(request.url, { ...request.init, signal: call.signal }),
        );
        if (!response.ok) throw await statusError(response, call, deps.clock, secrets);
        if (!response.body) throw new ProviderError('transient', 'The provider sent no body.');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await call.race(reader.read());
          if (done) break;
          started = true;
          call.armInactivity();
          const text = decoder.decode(value, { stream: true });
          if (text) yield text;
        }
        const tail = decoder.decode();
        if (tail) yield tail;
        return;
      } catch (error) {
        const failure = call.normalize(error, started);
        if (started || !isRetryable(failure.cls) || attempt >= MAX_RETRIES) throw failure;
        const wait = Math.max(failure.retryAfterMs ?? 0, BASE_BACKOFF_MS * 2 ** attempt);
        if (wait > RETRY_WAIT_CAP_MS) {
          throw new ProviderError(
            'rate_limit',
            redact(`The provider asked to wait ${Math.ceil(wait / 1_000)} s.`, secrets),
            wait,
          );
        }
        call.disarmInactivity();
        try {
          await call.race(deps.clock.sleep(wait, call.signal));
        } catch {
          throw call.abortError(false);
        }
      }
    }
  } finally {
    call.dispose();
  }
}
