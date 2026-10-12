import type { ErrorCode } from '../shared/messaging/commands.ts';

/** The subset of `runtime.MessageSender` the policy reads. */
export interface SenderLike {
  id?: string | undefined;
  url?: string | undefined;
  tab?: { url?: string | undefined } | undefined;
}

export type SenderCheck = { ok: true } | { ok: false; reason: ErrorCode };

const ALLOWED_PAGES = new Set(['/popup.html', '/sidepanel.html', '/options.html']);

function isOwnExtensionUrl(url: string, runtimeId: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'chrome-extension:' && parsed.host === runtimeId ? parsed : null;
  } catch {
    return null;
  }
}

/** ADR-16: privileged commands come only from this extension's own pages, never from a web tab. */
export function checkSender(sender: SenderLike, runtimeId: string): SenderCheck {
  if (sender.id !== runtimeId) return { ok: false, reason: 'foreign_sender' };
  // A tab on a web URL is an injected reader context, even though the extension id matches.
  if (sender.tab?.url !== undefined && !isOwnExtensionUrl(sender.tab.url, runtimeId)) {
    return { ok: false, reason: 'web_context' };
  }
  const page = sender.url === undefined ? null : isOwnExtensionUrl(sender.url, runtimeId);
  if (!page || !ALLOWED_PAGES.has(page.pathname)) return { ok: false, reason: 'page_not_allowed' };
  return { ok: true };
}
