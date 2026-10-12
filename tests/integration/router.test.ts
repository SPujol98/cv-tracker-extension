import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createRouter } from '../../src/background/router.ts';
import { checkSender } from '../../src/background/senderPolicy.ts';
import { sendCommand } from '../../src/shared/messaging/client.ts';
import config from '../../wxt.config.ts';

// ADR-16, SHELL-4: typed commands, Zod validation and the sender policy.
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const page = (name: string) => `chrome-extension://${ID}/${name}`;
const sender = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  url: page('popup.html'),
  ...overrides,
});

describe('checkSender', () => {
  it.each(['popup.html', 'sidepanel.html', 'options.html', 'options.html#/keys', 'popup.html?x=1'])(
    'accepts the extension page %s',
    (name) => {
      expect(checkSender(sender({ url: page(name) }), ID)).toEqual({ ok: true });
    },
  );

  it('rejects a foreign sender id', () => {
    expect(checkSender(sender({ id: 'otherextensionidotherextension' }), ID)).toEqual({
      ok: false,
      reason: 'foreign_sender',
    });
    expect(checkSender({ url: page('popup.html') }, ID)).toMatchObject({ ok: false });
  });

  it('rejects a sender whose tab url is a web URL, even with a matching id', () => {
    const result = checkSender(
      sender({ tab: { id: 3, url: 'https://www.linkedin.com/jobs/view/1' } }),
      ID,
    );
    expect(result).toEqual({ ok: false, reason: 'web_context' });
  });

  it.each([
    page('background.js'),
    page('popup.html.evil.html'),
    page('nested/popup.html'),
    `chrome-extension://${'z'.repeat(32)}/popup.html`,
    'https://example.com/popup.html',
    undefined,
  ])('rejects the page url %s', (url) => {
    expect(checkSender(sender({ url }), ID)).toEqual({ ok: false, reason: 'page_not_allowed' });
  });

  it('accepts an extension options tab', () => {
    const tab = { id: 9, url: page('options.html') };
    expect(checkSender(sender({ url: page('options.html'), tab }), ID)).toEqual({ ok: true });
  });
});

describe('router', () => {
  const router = createRouter({ runtimeId: ID });

  it('answers a valid ping from an extension page', async () => {
    expect(await router({ type: 'ping' }, sender())).toEqual({ ok: true, data: { pong: true } });
  });

  it('rejects a privileged command from a web context before running any handler', async () => {
    const ping = vi.fn(async () => ({ pong: true as const }));
    const guarded = createRouter({ runtimeId: ID, handlers: { ping } });
    const response = await guarded(
      { type: 'ping' },
      sender({ tab: { id: 1, url: 'https://www.infojobs.net/x' } }),
    );
    expect(response).toEqual({ ok: false, error: { code: 'web_context' } });
    expect(ping).not.toHaveBeenCalled();
  });

  it('rejects a foreign sender id and a disallowed page', async () => {
    expect(await router({ type: 'ping' }, sender({ id: 'x'.repeat(32) }))).toEqual({
      ok: false,
      error: { code: 'foreign_sender' },
    });
    expect(await router({ type: 'ping' }, sender({ url: page('other.html') }))).toEqual({
      ok: false,
      error: { code: 'page_not_allowed' },
    });
  });

  it('fails validation for unknown commands and malformed payloads', async () => {
    for (const message of [{ type: 'nope' }, {}, null, 'ping', { type: 'ping', extra: 1 }]) {
      const response = await router(message, sender());
      expect(response).toEqual({ ok: false, error: { code: 'invalid_command' } });
    }
  });

  it('reports a handler failure without leaking its message', async () => {
    const failing = createRouter({
      runtimeId: ID,
      handlers: {
        ping: async () => {
          throw new Error('secret detail');
        },
      },
    });
    expect(await failing({ type: 'ping' }, sender())).toEqual({
      ok: false,
      error: { code: 'handler_failed' },
    });
  });
});

describe('manifest exposure', () => {
  it('declares no externally_connectable entry', () => {
    const manifest = (config as { manifest?: Record<string, unknown> }).manifest ?? {};
    expect(manifest).not.toHaveProperty('externally_connectable');
  });
});

describe('client', () => {
  it('returns a validated reply and maps a malformed reply to invalid_command', async () => {
    const send = vi.spyOn(fakeBrowser.runtime, 'sendMessage');
    send.mockResolvedValueOnce({ ok: true, data: { pong: true } } as never);
    expect(await sendCommand({ type: 'ping' })).toEqual({ ok: true, data: { pong: true } });
    send.mockResolvedValueOnce('not a response' as never);
    expect(await sendCommand({ type: 'ping' })).toEqual({
      ok: false,
      error: { code: 'invalid_command' },
    });
    send.mockRestore();
  });
});
