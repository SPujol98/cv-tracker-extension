import { describe, expect, it } from 'vitest';
import { createSseParser, parseSseStream, type SseEvent } from '../../../src/core/sse.ts';

function collect(chunks: string[]): SseEvent[] {
  const parser = createSseParser();
  return chunks.flatMap((chunk) => parser.push(chunk));
}

describe('createSseParser', () => {
  it('parses one event with a named type', () => {
    expect(collect(['event: delta\ndata: {"a":1}\n\n'])).toEqual([
      { event: 'delta', data: '{"a":1}', done: false },
    ]);
  });

  it('reassembles an event split across chunk boundaries at every offset', () => {
    const raw = 'event: delta\ndata: hello world\n\ndata: second\n\n';
    const expected = [
      { event: 'delta', data: 'hello world', done: false },
      { event: undefined, data: 'second', done: false },
    ];
    for (let cut = 1; cut < raw.length; cut++) {
      expect(collect([raw.slice(0, cut), raw.slice(cut)])).toEqual(expected);
    }
  });

  it('joins multi-line data with a newline', () => {
    expect(collect(['data: one\ndata: two\ndata:three\n\n'])).toEqual([
      { event: undefined, data: 'one\ntwo\nthree', done: false },
    ]);
  });

  it('ignores comment lines and unknown fields, and keeps an empty data line', () => {
    expect(collect([': keep-alive\nid: 7\nretry: 100\ndata: x\n\n'])).toEqual([
      { event: undefined, data: 'x', done: false },
    ]);
    expect(collect([': only a comment\n\n'])).toEqual([]);
    expect(collect(['data:\n\n'])).toEqual([{ event: undefined, data: '', done: false }]);
  });

  it('handles CRLF and lone CR line endings, including a CRLF split between chunks', () => {
    // A trailing CR is held back until the next chunk shows whether an LF follows.
    expect(collect(['data: a\r\n\r\ndata: b\r\r', 'data: c\n\n'])).toEqual([
      { event: undefined, data: 'a', done: false },
      { event: undefined, data: 'b', done: false },
      { event: undefined, data: 'c', done: false },
    ]);
    expect(collect(['data: a\r', '\n\r', '\ndata: b\n\n'])).toEqual([
      { event: undefined, data: 'a', done: false },
      { event: undefined, data: 'b', done: false },
    ]);
  });

  it('flags the [DONE] sentinel', () => {
    expect(collect(['data: {"x":1}\n\ndata: [DONE]\n\n'])).toEqual([
      { event: undefined, data: '{"x":1}', done: false },
      { event: undefined, data: '[DONE]', done: true },
    ]);
  });

  it('drops an event that never got its terminating blank line', () => {
    expect(collect(['data: complete\n\ndata: cut off'])).toEqual([
      { event: undefined, data: 'complete', done: false },
    ]);
  });

  it('strips a leading byte order mark', () => {
    expect(collect(['﻿data: x\n\n'])).toEqual([{ event: undefined, data: 'x', done: false }]);
  });
});

describe('parseSseStream', () => {
  it('yields events from an async stream of text chunks', async () => {
    async function* chunks() {
      yield 'data: a\n';
      yield '\ndata: b\n\n';
    }
    const out: SseEvent[] = [];
    for await (const event of parseSseStream(chunks())) out.push(event);
    expect(out.map((event) => event.data)).toEqual(['a', 'b']);
  });
});
