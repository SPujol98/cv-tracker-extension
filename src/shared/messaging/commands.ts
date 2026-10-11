import { z } from 'zod';

/**
 * Contract M. Every command is privileged: the router accepts it only from an extension page
 * (ADR-16). The union starts with `ping`, which the router tests use; real commands arrive with
 * the sub-changes that own them (analysis.*, key.*, scan.*, maintenance.*, update.*).
 */
export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ping') }),
]);

export type Command = z.infer<typeof commandSchema>;
export type CommandType = Command['type'];

export interface CommandResults {
  ping: { pong: true };
}

export const ERROR_CODES = [
  'foreign_sender',
  'web_context',
  'page_not_allowed',
  'invalid_command',
  'handler_failed',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type CommandResponse<T extends CommandType = CommandType> =
  | { ok: true; data: CommandResults[T] }
  | { ok: false; error: { code: ErrorCode } };

export const responseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data: z.unknown() }),
  z.object({ ok: z.literal(false), error: z.object({ code: z.enum(ERROR_CODES) }) }),
]);
