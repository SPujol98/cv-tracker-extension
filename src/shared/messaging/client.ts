import { browser } from 'wxt/browser';
import {
  type Command,
  type CommandResponse,
  type CommandType,
  responseSchema,
} from './commands.ts';

/** Sends a typed command to the service worker and validates the shape of the reply. */
export async function sendCommand<T extends CommandType>(
  command: Extract<Command, { type: T }>,
): Promise<CommandResponse<T>> {
  const reply: unknown = await browser.runtime.sendMessage(command);
  const parsed = responseSchema.safeParse(reply);
  if (!parsed.success) return { ok: false, error: { code: 'invalid_command' } };
  return parsed.data as CommandResponse<T>;
}
