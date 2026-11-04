import { describe, expect, it } from 'vitest';
import { ProviderError } from '../../../src/core/ports/llm.ts';
import type { FetchLike } from '../../../src/core/ports/runtime.ts';
import {
  classifyStatus,
  INACTIVITY_TIMEOUT_MS,
  RETRY_WAIT_CAP_MS,
  streamRequest,
  TOTAL_TIMEOUT_MS,
} from '../../../src/providers/http.ts';
import { FakeClock } from '../../support/fakeClock.ts';

const encoder = new TextEncoder();
const REQUEST = { url: 'https://api.example.com/v1/complete', init: { method: 'POST' } };
// Built at runtime so the repository secret scan never sees a key-shaped literal.
const KEY = ['sk', 'ant', 'api03', 'Zx9Qw8Er7Ty6Ui5Op4'].join('-');

interface Controlled {
  response: Response;
  push(text: string | Uint8Array): void;
  end(): void;
  fail(error: Error): void;
}

/** A 200 streaming response the test drives chunk by chunk; it errors when the request aborts. */
function controlled(init: RequestInit, status = 200): Controlled {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  init.signal?.addEventListener('abort', () => {
    try {
      controller.error(new DOMException('aborted', 'AbortError'));
    } catch {
      // already closed or errored
    }
  });
  return {
    response: new Response(body, { status }),
    push: (text) => controller.enqueue(typeof text === 'string' ? encoder.encode(text) : text),
    end: () => controller.close(),
    fail: (error) => controller.error(error),
  };
}

const complete = (text: string): Response => new Response(text, { status: 200 });
const failure = (status: number, headers: Record<string, string> = {}, body = ''): Response =>
  new Response(body, { status, headers });

interface Harness {
  clock: FakeClock;
  fetch: FetchLike;
  requests: { url: string; init: RequestInit }[];
}

function harness(...handlers: ((init: RequestInit) => Response | Promise<Response>)[]): Harness {
  const clock = new FakeClock();
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    requests.push({ url, init });
    const handler = handlers[Math.min(requests.length, handlers.length) - 1];
    if (!handler) throw new Error('no handler');
    return handler(init);
  };
  return { clock, fetch, requests };
}

interface Outcome {
  chunks: string[];
  error: ProviderError | Error | undefined;
}

function run(
  h: Harness,
  signal: AbortSignal = new AbortController().signal,
  secrets: string[] = [],
) {
  const outcome: Outcome = { chunks: [], error: undefined };
  const done = (async () => {
    try {
      for await (const chunk of streamRequest(
        { fetch: h.fetch, clock: h.clock },
        { ...REQUEST, secrets },
        signal,
      )) {
        outcome.chunks.push(chunk);
      }
    } catch (error) {
      outcome.error = error as Error;
    }
  })();
  return { outcome, done };
}

function providerError(outcome: Outcome): ProviderError {
  expect(outcome.error).toBeInstanceOf(ProviderError);
  return outcome.error as ProviderError;
}

describe('classifyStatus (ADR-21)', () => {
  it('maps statuses to the closed taxonomy', () => {
    expect(classifyStatus(401)).toBe('auth');
    expect(classifyStatus(403)).toBe('auth');
    expect(classifyStatus(429)).toBe('rate_limit');
    expect(classifyStatus(500)).toBe('transient');
    expect(classifyStatus(503)).toBe('transient');
    expect(classifyStatus(529)).toBe('transient');
    expect(classifyStatus(400)).toBe('invalid_request');
    expect(classifyStatus(404)).toBe('invalid_request');
  });
});

describe('streamRequest: success path', () => {
  it('yields decoded text chunks, including a multi-byte character split across chunks', async () => {
    const bytes = encoder.encode('héllo');
    const h = harness((init) => {
      const c = controlled(init);
      c.push(bytes.slice(0, 2));
      c.push(bytes.slice(2));
      c.end();
      return c.response;
    });
    const { outcome, done } = run(h);
    await h.clock.advance(0);
    await done;
    expect(outcome.error).toBeUndefined();
    expect(outcome.chunks.join('')).toBe('héllo');
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]?.url).toBe(REQUEST.url);
    expect(h.requests[0]?.init.method).toBe('POST');
  });

  it('leaves no timer armed once the stream completes', async () => {
    const h = harness(() => complete('done'));
    const { done } = run(h);
    await h.clock.advance(0);
    await done;
    expect(h.clock.pendingTimers).toBe(0);
  });
});

describe('streamRequest: retry (LLM-5, ADR-21)', () => {
  it('sends 3 requests for a persistent 503, waiting 2 s then 4 s, and ends as transient', async () => {
    const h = harness(() => failure(503));
    const { outcome, done } = run(h);
    await h.clock.advance(1_999);
    expect(h.requests).toHaveLength(1);
    await h.clock.advance(1);
    expect(h.requests).toHaveLength(2);
    await h.clock.advance(3_999);
    expect(h.requests).toHaveLength(2);
    await h.clock.advance(1);
    await done;
    expect(h.requests).toHaveLength(3);
    expect(providerError(outcome).cls).toBe('transient');
    expect(
      h.clock.sleeps.filter((ms) => ms !== INACTIVITY_TIMEOUT_MS && ms !== TOTAL_TIMEOUT_MS),
    ).toEqual([2_000, 4_000]);
  });

  it('retries a network failure as transient', async () => {
    const h = harness(
      () => {
        throw new TypeError('fetch failed');
      },
      () => complete('ok'),
    );
    const { outcome, done } = run(h);
    await h.clock.advance(2_000);
    await done;
    expect(outcome.error).toBeUndefined();
    expect(outcome.chunks.join('')).toBe('ok');
    expect(h.requests).toHaveLength(2);
  });

  it('retries a 529 and a 429, and ends a persistent 429 as rate_limit', async () => {
    const h = harness(
      () => failure(529),
      () => failure(429),
      () => failure(429),
    );
    const { outcome, done } = run(h);
    await h.clock.advance(10_000);
    await done;
    expect(h.requests).toHaveLength(3);
    expect(providerError(outcome).cls).toBe('rate_limit');
  });

  it('sends exactly 1 request for a 401 and for a 403 and does not wait', async () => {
    for (const status of [401, 403]) {
      const h = harness(() => failure(status));
      const { outcome, done } = run(h);
      await h.clock.advance(0);
      await done;
      expect(h.requests).toHaveLength(1);
      expect(providerError(outcome).cls).toBe('auth');
    }
  });

  it('does not retry other 4xx statuses', async () => {
    const h = harness(() => failure(400, {}, 'bad schema'));
    const { outcome, done } = run(h);
    await h.clock.advance(0);
    await done;
    expect(h.requests).toHaveLength(1);
    const error = providerError(outcome);
    expect(error.cls).toBe('invalid_request');
    expect(error.message).toContain('bad schema');
  });

  it('waits at least Retry-After seconds when it exceeds the backoff', async () => {
    const h = harness(
      () => failure(429, { 'retry-after': '7' }),
      () => complete('ok'),
    );
    const { outcome, done } = run(h);
    await h.clock.advance(6_999);
    expect(h.requests).toHaveLength(1);
    await h.clock.advance(1);
    await done;
    expect(h.requests).toHaveLength(2);
    expect(outcome.chunks.join('')).toBe('ok');
  });

  it('uses the backoff when it exceeds Retry-After (max of both)', async () => {
    const h = harness(
      () => failure(503, { 'retry-after': '1' }),
      () => complete('ok'),
    );
    const { done } = run(h);
    await h.clock.advance(1_999);
    expect(h.requests).toHaveLength(1);
    await h.clock.advance(1);
    await done;
    expect(h.requests).toHaveLength(2);
  });

  it('honors a Retry-After HTTP date relative to the injected clock', async () => {
    const h = harness(
      () => failure(429, { 'retry-after': new Date(9_000).toUTCString() }),
      () => complete('ok'),
    );
    const { done } = run(h);
    await h.clock.advance(8_999);
    expect(h.requests).toHaveLength(1);
    await h.clock.advance(1);
    await done;
    expect(h.requests).toHaveLength(2);
  });

  it('stops retrying and throws rate_limit with retryAfterMs when the wait exceeds 20 s', async () => {
    const h = harness(() => failure(429, { 'retry-after': '25' }));
    const { outcome, done } = run(h);
    await h.clock.advance(0);
    await done;
    expect(h.requests).toHaveLength(1);
    const error = providerError(outcome);
    expect(error.cls).toBe('rate_limit');
    expect(error.retryAfterMs).toBe(25_000);
    expect(RETRY_WAIT_CAP_MS).toBe(20_000);
  });

  it('still retries when the wait is exactly 20 s', async () => {
    const h = harness(
      () => failure(429, { 'retry-after': '20' }),
      () => complete('ok'),
    );
    const { outcome, done } = run(h);
    await h.clock.advance(20_000);
    await done;
    expect(h.requests).toHaveLength(2);
    expect(outcome.error).toBeUndefined();
  });

  it('retries a stream that fails before its first chunk', async () => {
    const h = harness(
      (init) => {
        const c = controlled(init);
        c.fail(new TypeError('network error'));
        return c.response;
      },
      () => complete('ok'),
    );
    const { outcome, done } = run(h);
    await h.clock.advance(2_000);
    await done;
    expect(h.requests).toHaveLength(2);
    expect(outcome.chunks.join('')).toBe('ok');
  });

  it('never retries after the first chunk and flags afterFirstChunk', async () => {
    let c!: Controlled;
    const h = harness((init) => {
      c = controlled(init);
      c.push('partial');
      return c.response;
    });
    const { outcome, done } = run(h);
    // Let the consumer read the chunk before the connection drops (an error discards queued data).
    await h.clock.advance(0);
    c.fail(new TypeError('connection reset'));
    await h.clock.advance(10_000);
    await done;
    expect(h.requests).toHaveLength(1);
    expect(outcome.chunks).toEqual(['partial']);
    const error = providerError(outcome);
    expect(error.cls).toBe('transient');
    expect(error.afterFirstChunk).toBe(true);
  });
});

describe('streamRequest: timeouts (LLM-4)', () => {
  it('ends as timeout after 60 s without a chunk', async () => {
    const h = harness((init) => controlled(init).response);
    const { outcome, done } = run(h);
    await h.clock.advance(INACTIVITY_TIMEOUT_MS - 1);
    expect(outcome.error).toBeUndefined();
    await h.clock.advance(1);
    await done;
    expect(providerError(outcome).cls).toBe('timeout');
    expect(h.requests[0]?.init.signal?.aborted).toBe(true);
    expect(h.clock.pendingTimers).toBe(0);
  });

  it('times out after the first chunk when the stream then stalls', async () => {
    const h = harness((init) => {
      const c = controlled(init);
      c.push('first');
      return c.response;
    });
    const { outcome, done } = run(h);
    await h.clock.advance(INACTIVITY_TIMEOUT_MS);
    await done;
    expect(outcome.chunks).toEqual(['first']);
    const error = providerError(outcome);
    expect(error.cls).toBe('timeout');
    expect(error.afterFirstChunk).toBe(true);
  });

  it('resets the inactivity timer on every chunk', async () => {
    let c!: Controlled;
    const h = harness((init) => {
      c = controlled(init);
      return c.response;
    });
    const { outcome, done } = run(h);
    await h.clock.advance(0);
    for (let i = 0; i < 3; i++) {
      await h.clock.advance(50_000);
      c.push(`chunk${i}`);
      await h.clock.flush();
    }
    expect(outcome.error).toBeUndefined();
    c.end();
    await done;
    expect(outcome.chunks).toEqual(['chunk0', 'chunk1', 'chunk2']);
  });

  it('ends as timeout after 240 s in total even while chunks keep arriving', async () => {
    let c!: Controlled;
    const h = harness((init) => {
      c = controlled(init);
      return c.response;
    });
    const { outcome, done } = run(h);
    await h.clock.advance(0);
    for (let elapsed = 0; elapsed < TOTAL_TIMEOUT_MS; elapsed += 30_000) {
      c.push('x');
      await h.clock.advance(30_000);
    }
    await done;
    expect(providerError(outcome).cls).toBe('timeout');
    expect(h.clock.now()).toBe(TOTAL_TIMEOUT_MS);
  });
});

describe('streamRequest: cancel (LLM-4)', () => {
  it('aborts the request and ends as cancelled', async () => {
    const abort = new AbortController();
    const h = harness((init) => {
      const c = controlled(init);
      c.push('first');
      return c.response;
    });
    const { outcome, done } = run(h, abort.signal);
    await h.clock.advance(0);
    abort.abort();
    await h.clock.flush();
    await done;
    expect(providerError(outcome).cls).toBe('cancelled');
    expect(h.requests[0]?.init.signal?.aborted).toBe(true);
    expect(h.clock.pendingTimers).toBe(0);
  });

  it('sends no request when the signal is already aborted', async () => {
    const abort = new AbortController();
    abort.abort();
    const h = harness(() => complete('never'));
    const { outcome, done } = run(h, abort.signal);
    await h.clock.advance(0);
    await done;
    expect(h.requests).toHaveLength(0);
    expect(providerError(outcome).cls).toBe('cancelled');
  });

  it('ends as cancelled when aborted during the retry wait, without another request', async () => {
    const abort = new AbortController();
    const h = harness(
      () => failure(503),
      () => complete('never'),
    );
    const { outcome, done } = run(h, abort.signal);
    await h.clock.advance(1_000);
    abort.abort();
    await h.clock.flush();
    await done;
    expect(h.requests).toHaveLength(1);
    expect(providerError(outcome).cls).toBe('cancelled');
  });

  it('ends as cancelled when the fetch itself is pending', async () => {
    const abort = new AbortController();
    const h = harness(() => new Promise<Response>(() => {}));
    const { outcome, done } = run(h, abort.signal);
    await h.clock.advance(1_000);
    abort.abort();
    await h.clock.flush();
    await done;
    expect(providerError(outcome).cls).toBe('cancelled');
  });
});

describe('streamRequest: redaction (PRIV-3)', () => {
  it('masks the key and provider key patterns in error messages', async () => {
    const h = harness(() =>
      failure(401, {}, `invalid x-api-key ${KEY} and token user-secret-value`),
    );
    const { outcome, done } = run(h, new AbortController().signal, ['user-secret-value']);
    await h.clock.advance(0);
    await done;
    const error = providerError(outcome);
    expect(error.message).not.toContain(KEY);
    expect(error.message).not.toContain('user-secret-value');
    expect(error.message).toContain('401');
  });

  it('masks the key in a network failure message', async () => {
    const h = harness(() => {
      throw new TypeError(`connect failed for ${KEY}`);
    });
    const { outcome, done } = run(h);
    await h.clock.advance(10_000);
    await done;
    expect(providerError(outcome).message).not.toContain(KEY);
  });
});
