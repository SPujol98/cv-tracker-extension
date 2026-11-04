// Incremental Server-Sent Events parser (LLM-2, LLM-3). Pure: it takes already decoded text, so
// transport and `TextDecoder` stay in the adapter layer. It follows the WHATWG field rules for
// `event` and `data`; `id` and `retry` are ignored because the providers do not use them.

export interface SseEvent {
  /** The `event:` field, or `undefined` for the default message type. */
  event: string | undefined;
  /** Multi-line `data:` fields joined with `\n`. */
  data: string;
  /** True for the `[DONE]` sentinel some providers send as the last data payload. */
  done: boolean;
}

export interface SseParser {
  /** Feeds a decoded chunk and returns the events completed by it, in order. */
  push(chunk: string): SseEvent[];
}

const DONE_SENTINEL = '[DONE]';
const BYTE_ORDER_MARK = '﻿';

export function createSseParser(): SseParser {
  let buffer = '';
  let started = false;
  let event: string | undefined;
  let dataLines: string[] = [];
  let hasData = false;

  function dispatch(out: SseEvent[]): void {
    if (hasData) {
      const data = dataLines.join('\n');
      out.push({ event, data, done: data === DONE_SENTINEL });
    }
    event = undefined;
    dataLines = [];
    hasData = false;
  }

  function line(text: string, out: SseEvent[]): void {
    if (text === '') {
      dispatch(out);
      return;
    }
    if (text.startsWith(':')) return;
    const colon = text.indexOf(':');
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? '' : text.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') {
      dataLines.push(value);
      hasData = true;
    }
  }

  return {
    push(chunk) {
      buffer += chunk;
      if (!started && buffer.length > 0) {
        started = true;
        if (buffer.startsWith(BYTE_ORDER_MARK)) buffer = buffer.slice(1);
      }
      const out: SseEvent[] = [];
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        if (char !== '\n' && char !== '\r') continue;
        // A trailing CR may be the first half of a CRLF split across chunks: wait for more input.
        if (char === '\r' && i === buffer.length - 1) break;
        line(buffer.slice(start, i), out);
        if (char === '\r' && buffer[i + 1] === '\n') i++;
        start = i + 1;
      }
      buffer = buffer.slice(start);
      return out;
    },
  };
}

/** Parses an async stream of decoded text chunks into events. */
export async function* parseSseStream(chunks: AsyncIterable<string>): AsyncGenerator<SseEvent> {
  const parser = createSseParser();
  for await (const chunk of chunks) yield* parser.push(chunk);
}
