// Runtime ports (ADR-01): time, randomness and transport are injected as plain parameters so the
// functional core never touches `fetch`, timers or `Math.random` directly.
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

/** Returns a number in [0, 1). */
export type Rng = () => number;
