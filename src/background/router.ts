import {
  type Command,
  type CommandResponse,
  type CommandResults,
  type CommandType,
  commandSchema,
} from '../shared/messaging/commands.ts';
import { checkSender, type SenderLike } from './senderPolicy.ts';

export type Handlers = {
  [T in CommandType]: (command: Extract<Command, { type: T }>) => Promise<CommandResults[T]>;
};

const defaultHandlers: Handlers = {
  ping: async () => ({ pong: true }),
};

export interface RouterOptions {
  runtimeId: string;
  handlers?: Partial<Handlers>;
}

/**
 * Builds the message router: sender policy first, then Zod validation, then the handler.
 * Failures return a stable error code and never echo handler or payload details.
 */
export function createRouter({ runtimeId, handlers }: RouterOptions) {
  const table: Handlers = { ...defaultHandlers, ...handlers };
  return async (message: unknown, sender: SenderLike): Promise<CommandResponse> => {
    const verdict = checkSender(sender, runtimeId);
    if (!verdict.ok) return { ok: false, error: { code: verdict.reason } };
    const parsed = commandSchema.safeParse(message);
    if (!parsed.success) return { ok: false, error: { code: 'invalid_command' } };
    const command = parsed.data;
    try {
      const handler = table[command.type] as (c: Command) => Promise<CommandResults[CommandType]>;
      return { ok: true, data: await handler(command) };
    } catch {
      return { ok: false, error: { code: 'handler_failed' } };
    }
  };
}
