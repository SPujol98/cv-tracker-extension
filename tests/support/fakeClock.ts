// Deterministic `Clock` for adapter tests (ADR-21). Time only moves through `advance`, which
// fires due timers in order and lets pending promise work settle between them. Not shipped.
import type { Clock } from '../../src/core/ports/runtime.ts';

interface Timer {
  at: number;
  resolve: () => void;
}

const settle = async (): Promise<void> => {
  for (let i = 0; i < 3; i++) await new Promise<void>((resolve) => setImmediate(resolve));
};

export class FakeClock implements Clock {
  private time: number;
  private timers: Timer[] = [];
  /** Every `sleep` duration requested so far, in call order. */
  readonly sleeps: number[] = [];

  constructor(start = 0) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  sleep(ms: number, signal?: AbortSignal): Promise<void> {
    this.sleeps.push(ms);
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      const timer: Timer = { at: this.time + ms, resolve };
      this.timers.push(timer);
      signal?.addEventListener(
        'abort',
        () => {
          this.timers = this.timers.filter((candidate) => candidate !== timer);
          reject(new DOMException('aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  /** Timers that are armed and not yet fired or cancelled. */
  get pendingTimers(): number {
    return this.timers.length;
  }

  /** Lets promise work settle without moving time. */
  async flush(): Promise<void> {
    await settle();
  }

  async advance(ms: number): Promise<void> {
    const target = this.time + ms;
    await settle();
    for (;;) {
      const due = this.timers.filter((timer) => timer.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.timers = this.timers.filter((timer) => timer !== due);
      this.time = due.at;
      due.resolve();
      await settle();
    }
    this.time = target;
    await settle();
  }
}
