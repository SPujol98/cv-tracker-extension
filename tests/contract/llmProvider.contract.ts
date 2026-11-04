// Shared `LlmProvider` contract suite (LLM-1). One suite runs unchanged against the Anthropic
// adapter, the OpenAI adapter (recorded SSE through a fake fetch) and the test-only fake. The
// assertions that only make sense over HTTP are guarded by `transport: true`; the fake runs with
// `transport: false`. A factory builds a provider that behaves as one named `ContractBehavior`,
// so the suite never depends on how an adapter reaches that behavior.
import { describe, expect, it } from 'vitest';
import {
  type CompletionEvent,
  type CompletionRequest,
  type LlmProvider,
  ProviderError,
} from '../../src/core/ports/llm.ts';
import { INACTIVITY_TIMEOUT_MS, MAX_RETRIES } from '../../src/providers/http.ts';
import type { FakeClock } from '../support/fakeClock.ts';

/** What the provider under test must do for one scenario. */
export type ContractBehavior =
  /** Progress events, then one final event carrying `fixtures.expectedFinal`. */
  | { kind: 'ok' }
  /** One progress event, then silence: the call must end as `timeout` once the clock advances. */
  | { kind: 'stall' }
  /** One progress event, then waits until the signal aborts: the call must end as `cancelled`. */
  | { kind: 'hang' }
  /** HTTP only: every request answers with this status (and optional `Retry-After` and body). */
  | { kind: 'http-status'; status: number; retryAfterSeconds?: number; body?: string }
  /**
   * HTTP only: a first chunk arrives, then the connection drops. The stream must error only
   * after that chunk was read (a `ReadableStream` error discards queued chunks).
   */
  | { kind: 'drop-after-first-chunk' };

export interface ContractSubject {
  provider: LlmProvider;
  /** The clock the provider was built with. Providers without timers may ignore it. */
  clock: FakeClock;
  /** Requests the provider sent through its fake fetch. Empty for the fake provider. */
  requests: readonly { url: string; init: RequestInit }[];
}

export type ContractFactory = (behavior: ContractBehavior) => ContractSubject;

export interface ContractFixtures {
  request: CompletionRequest;
  key: string;
  /** What the `ok` behavior's final event must carry. */
  expectedFinal: { json: unknown; model: string };
}

export interface ContractOptions {
  /** True for adapters that talk HTTP: enables the transport-only assertions. */
  transport: boolean;
}

const USAGE_FIELDS = ['inputTokens', 'outputTokens', 'cachedInputTokens'] as const;

/**
 * Checks the shape of a final event and throws an error naming the first missing field
 * (LLM-1: "the contract suite fails naming the missing field").
 */
export function assertFinalShape(event: unknown): void {
  const final = event as Partial<Record<string, unknown>> | undefined;
  if (final === undefined || final === null || typeof final !== 'object') {
    throw new Error('final event is missing: the event itself');
  }
  if (!('json' in final) || final.json === undefined)
    throw new Error('final event is missing: json');
  const usage = final.usage as Record<string, unknown> | undefined;
  if (usage === undefined || usage === null || typeof usage !== 'object') {
    throw new Error('final event is missing: usage');
  }
  for (const field of USAGE_FIELDS) {
    if (typeof usage[field] !== 'number') throw new Error(`final event is missing: usage.${field}`);
  }
  if (typeof usage.estimated !== 'boolean')
    throw new Error('final event is missing: usage.estimated');
  if (typeof final.model !== 'string' || final.model === '') {
    throw new Error('final event is missing: model');
  }
}

interface Drained {
  events: CompletionEvent[];
  error: unknown;
}

async function drain(
  subject: ContractSubject,
  fixtures: ContractFixtures,
  signal: AbortSignal,
  request: CompletionRequest = fixtures.request,
): Promise<Drained> {
  const out: Drained = { events: [], error: undefined };
  try {
    for await (const event of subject.provider.complete(request, fixtures.key, { signal })) {
      out.events.push(event);
    }
  } catch (error) {
    out.error = error;
  }
  return out;
}

/** Starts a drain, lets `drive` move the clock, then waits for the call to end. */
async function drainWith(
  subject: ContractSubject,
  fixtures: ContractFixtures,
  signal: AbortSignal,
  drive: () => Promise<void>,
): Promise<Drained> {
  const running = drain(subject, fixtures, signal);
  await drive();
  return running;
}

function expectProviderError(error: unknown, cls: ProviderError['cls']): ProviderError {
  expect(error).toBeInstanceOf(ProviderError);
  expect((error as ProviderError).cls).toBe(cls);
  return error as ProviderError;
}

export function describeLlmProviderContract(
  factory: ContractFactory,
  fixtures: ContractFixtures,
  options: ContractOptions,
): void {
  const label = factory({ kind: 'ok' }).provider.id;

  describe(`LlmProvider contract: ${label}`, () => {
    describe('identity (LLM-1)', () => {
      it('exposes id, display name, origin and priced models', () => {
        const { provider } = factory({ kind: 'ok' });
        expect(provider.id).not.toBe('');
        expect(provider.displayName).not.toBe('');
        expect(provider.origin).toMatch(/^https:\/\//);
        expect(provider.models.length).toBeGreaterThan(0);
        for (const model of provider.models) {
          expect(model.qualifiedId).toContain('/');
          expect(model.price.inputPerMTok).toBeGreaterThanOrEqual(0);
          expect(model.price.outputPerMTok).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe('event order and final shape (LLM-1)', () => {
      it('yields progress events and then exactly one final event, last', async () => {
        const subject = factory({ kind: 'ok' });
        const { events, error } = await drainWith(
          subject,
          fixtures,
          new AbortController().signal,
          () => subject.clock.advance(0),
        );
        expect(error).toBeUndefined();
        expect(events.length).toBeGreaterThan(0);
        const finals = events.filter((event) => event.type === 'final');
        expect(finals).toHaveLength(1);
        expect(events.at(-1)?.type).toBe('final');
        for (const event of events.slice(0, -1)) {
          expect(event.type).toBe('progress');
          expect(event.type === 'progress' && event.outputChars).toBeGreaterThanOrEqual(0);
        }
      });

      it('carries json, usage and model in the final event', async () => {
        const subject = factory({ kind: 'ok' });
        const { events } = await drainWith(subject, fixtures, new AbortController().signal, () =>
          subject.clock.advance(0),
        );
        const final = events.at(-1);
        assertFinalShape(final);
        expect(final?.type === 'final' && final.json).toEqual(fixtures.expectedFinal.json);
        expect(final?.type === 'final' && final.model).toBe(fixtures.expectedFinal.model);
      });

      it('rejects a non-conforming final event naming the missing field', () => {
        const complete = {
          type: 'final',
          json: {},
          usage: { inputTokens: 1, outputTokens: 1, cachedInputTokens: 0, estimated: false },
          model: 'm',
        };
        expect(() => assertFinalShape(complete)).not.toThrow();
        const { usage: _usage, ...noUsage } = complete;
        expect(() => assertFinalShape(noUsage)).toThrow(/usage/);
        const { model: _model, ...noModel } = complete;
        expect(() => assertFinalShape(noModel)).toThrow(/model/);
        const { json: _json, ...noJson } = complete;
        expect(() => assertFinalShape(noJson)).toThrow(/json/);
        expect(() =>
          assertFinalShape({ ...complete, usage: { inputTokens: 1, outputTokens: 1 } }),
        ).toThrow(/usage\.cachedInputTokens/);
      });
    });

    describe('timeout and cancel (LLM-4)', () => {
      it('ends a stalled call as timeout', async () => {
        const subject = factory({ kind: 'stall' });
        const { error } = await drainWith(subject, fixtures, new AbortController().signal, () =>
          subject.clock.advance(INACTIVITY_TIMEOUT_MS),
        );
        expectProviderError(error, 'timeout');
      });

      it('ends as cancelled when the signal aborts mid-stream', async () => {
        const subject = factory({ kind: 'hang' });
        const abort = new AbortController();
        const { events, error } = await drainWith(subject, fixtures, abort.signal, async () => {
          await subject.clock.advance(1_000);
          abort.abort();
          await subject.clock.flush();
        });
        expectProviderError(error, 'cancelled');
        expect(events.some((event) => event.type === 'final')).toBe(false);
      });

      it('ends as cancelled when the signal is already aborted, yielding no final', async () => {
        const subject = factory({ kind: 'ok' });
        const abort = new AbortController();
        abort.abort();
        const { events, error } = await drainWith(subject, fixtures, abort.signal, () =>
          subject.clock.advance(0),
        );
        expectProviderError(error, 'cancelled');
        expect(events.some((event) => event.type === 'final')).toBe(false);
      });
    });

    describe.runIf(options.transport)('HTTP transport (LLM-2, LLM-3, LLM-4, LLM-5)', () => {
      const idle = () => new AbortController().signal;

      it('declares no tools in the request', async () => {
        const subject = factory({ kind: 'ok' });
        await drainWith(subject, fixtures, idle(), () => subject.clock.advance(0));
        expect(subject.requests.length).toBeGreaterThan(0);
        for (const { init } of subject.requests) {
          expect(typeof init.body).toBe('string');
          const body = JSON.parse(init.body as string) as Record<string, unknown>;
          expect(body.tools).toBeUndefined();
          expect(body.tool_choice).toBeUndefined();
        }
      });

      it('sends the request only to the provider origin', async () => {
        const subject = factory({ kind: 'ok' });
        await drainWith(subject, fixtures, idle(), () => subject.clock.advance(0));
        for (const { url } of subject.requests) {
          expect(new URL(url).origin).toBe(subject.provider.origin);
        }
      });

      it('rejects a schema with an unsupported keyword before any request', async () => {
        const subject = factory({ kind: 'ok' });
        const request: CompletionRequest = {
          ...fixtures.request,
          jsonSchema: {
            type: 'object',
            properties: { name: { type: 'string', minLength: 1 } },
          },
        };
        const rejected = await drain(subject, fixtures, idle(), request);
        expect(rejected.error).toBeInstanceOf(Error);
        expect(rejected.events).toEqual([]);
        expect(subject.requests).toHaveLength(0);
      });

      it('maps 401 to auth with exactly one request', async () => {
        const subject = factory({ kind: 'http-status', status: 401 });
        const { error } = await drainWith(subject, fixtures, idle(), () =>
          subject.clock.advance(60_000),
        );
        expectProviderError(error, 'auth');
        expect(subject.requests).toHaveLength(1);
      });

      it('maps 503 to transient after exactly 3 requests', async () => {
        const subject = factory({ kind: 'http-status', status: 503 });
        const { error } = await drainWith(subject, fixtures, idle(), () =>
          subject.clock.advance(60_000),
        );
        expectProviderError(error, 'transient');
        expect(subject.requests).toHaveLength(1 + MAX_RETRIES);
      });

      it('maps 429 to rate_limit', async () => {
        const subject = factory({ kind: 'http-status', status: 429 });
        const { error } = await drainWith(subject, fixtures, idle(), () =>
          subject.clock.advance(60_000),
        );
        expectProviderError(error, 'rate_limit');
      });

      it('waits at least Retry-After before the next request', async () => {
        const subject = factory({ kind: 'http-status', status: 429, retryAfterSeconds: 7 });
        const running = drain(subject, fixtures, idle());
        await subject.clock.advance(6_999);
        expect(subject.requests).toHaveLength(1);
        await subject.clock.advance(1);
        expect(subject.requests).toHaveLength(2);
        await subject.clock.advance(60_000);
        await running;
      });

      it('stops retrying when Retry-After exceeds 20 s and reports retryAfterMs', async () => {
        const subject = factory({ kind: 'http-status', status: 429, retryAfterSeconds: 25 });
        const { error } = await drainWith(subject, fixtures, idle(), () =>
          subject.clock.advance(1_000),
        );
        const failure = expectProviderError(error, 'rate_limit');
        expect(failure.retryAfterMs).toBe(25_000);
        expect(subject.requests).toHaveLength(1);
      });

      it('never retries after the first chunk', async () => {
        const subject = factory({ kind: 'drop-after-first-chunk' });
        const { error } = await drainWith(subject, fixtures, idle(), () =>
          subject.clock.advance(60_000),
        );
        const failure = expectProviderError(error, 'transient');
        expect(failure.afterFirstChunk).toBe(true);
        expect(subject.requests).toHaveLength(1);
      });

      it('never puts the key in an error message', async () => {
        const subject = factory({
          kind: 'http-status',
          status: 401,
          body: `invalid x-api-key ${fixtures.key}`,
        });
        const { error } = await drainWith(subject, fixtures, idle(), () =>
          subject.clock.advance(60_000),
        );
        const failure = expectProviderError(error, 'auth');
        expect(failure.message).not.toContain(fixtures.key);
      });
    });
  });
}
