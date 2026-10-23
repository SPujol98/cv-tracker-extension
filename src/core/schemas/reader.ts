// Strict reader result schemas (PRIV-11, PORTAL-3, PORTAL-4; ADR-14 item 7; amendment A19).
// Everything a page-side reader returns is data from an untrusted page: it is parsed with strict
// Zod objects and caps before any other code sees it, and a result that does not parse is
// `unreadable` as a whole. A failure is described by a count and field names only, never by page
// text, so logging it cannot leak the page (Zod's own messages quote values and key names).
// Zod runs with `jitless`, configured once at startup.

import { z } from 'zod';
import type {
  GenericPreview,
  OfferDetail,
  PageMarkers,
  RawSearchItem,
  ReadResult,
} from '../ports/portal.ts';

/** Every cap in one place (design Contract E; the 50,000 text cap is the transfer cap). */
export const READER_CAPS = {
  id: 64,
  title: 300,
  company: 200,
  location: 200,
  text: 50_000,
  items: 100,
  attempted: 10,
  strategyName: 40,
} as const;

const markersSchema = z.strictObject({
  loginForm: z.boolean(),
  authwall: z.boolean(),
  challenge: z.boolean(),
  contentRoot: z.boolean(),
  noResults: z.boolean(),
});

const strategyName = z.string().min(1).max(READER_CAPS.strategyName);

const searchItemSchema = z.strictObject({
  id: z.string().min(1).max(READER_CAPS.id),
  title: z.string().max(READER_CAPS.title),
  company: z.string().max(READER_CAPS.company),
  location: z.string().max(READER_CAPS.location).optional(),
});

const detailSchema = z.strictObject({
  title: z.string().max(READER_CAPS.title),
  company: z.string().max(READER_CAPS.company),
  location: z.string().max(READER_CAPS.location).optional(),
  text: z.string().max(READER_CAPS.text),
});

const genericPreviewSchema = z.strictObject({
  title: z.string().max(READER_CAPS.title),
  text: z.string().max(READER_CAPS.text),
});

const unreadableSchema = z.strictObject({
  ok: z.literal(false),
  failure: z.literal('unreadable'),
  attempted: z.array(strategyName).max(READER_CAPS.attempted),
});

const permissionMissingSchema = z.strictObject({
  ok: z.literal(false),
  failure: z.literal('permission_missing'),
});

const searchOkSchema = z.strictObject({
  ok: z.literal(true),
  strategy: strategyName,
  /** The page's own "no results" marker: the only thing that makes an empty list a real answer. */
  noResults: z.boolean(),
  data: z.array(searchItemSchema).max(READER_CAPS.items),
});

const detailOkSchema = z.strictObject({
  ok: z.literal(true),
  strategy: strategyName,
  data: detailSchema,
});

const genericOkSchema = z.strictObject({
  ok: z.literal(true),
  strategy: strategyName,
  data: genericPreviewSchema,
});

/** Why a result was rejected: a count and field names, never page text. */
export interface ReaderParseDetail {
  count: number;
  /** Schema field paths with array indexes collapsed to `[]`; `$` is the result itself. */
  fields: string[];
  message: string;
}

export interface ReaderParse<T> {
  result: ReadResult<T>;
  detail: ReaderParseDetail | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function fieldOf(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '$';
  return path.reduce<string>(
    (text, part, index) =>
      typeof part === 'number' ? `${text}[]` : `${text}${index === 0 ? '' : '.'}${String(part)}`,
    '',
  );
}

/**
 * Built from issue paths, which come from the schema (an unknown key reports its parent), and
 * from the issue count. Zod's `message` and `input` are never read.
 */
function describeFailure(error: z.ZodError): ReaderParseDetail {
  const fields = [...new Set(error.issues.map((issue) => fieldOf(issue.path)))].sort();
  const count = error.issues.length;
  return {
    count,
    fields,
    message: `Reader result rejected: ${count} ${count === 1 ? 'issue' : 'issues'} in ${fields.join(', ')}.`,
  };
}

function rejected<T>(error: z.ZodError): ReaderParse<T> {
  return {
    result: { ok: false, failure: 'unreadable', attempted: [] },
    detail: describeFailure(error),
  };
}

/** The failure variants are shared; the success variant is chosen by the result's own `ok`. */
function schemaFor<S extends z.ZodType>(raw: unknown, success: S) {
  if (isRecord(raw) && raw.ok === true) return success;
  if (isRecord(raw) && raw.failure === 'permission_missing') return permissionMissingSchema;
  return unreadableSchema;
}

function parseFailureVariant(
  parsed: z.infer<typeof unreadableSchema> | z.infer<typeof permissionMissingSchema>,
): ReadResult<never> {
  return parsed.failure === 'unreadable'
    ? { ok: false, failure: 'unreadable', attempted: parsed.attempted }
    : { ok: false, failure: 'permission_missing' };
}

/** Whether `idPattern` accepts the id; `search` ignores the `lastIndex` state of a `g` flag. */
const matchesId = (id: string, idPattern: RegExp): boolean => id.search(idPattern) !== -1;

/**
 * A search reader result. An item whose id fails `idPattern` is dropped; a result left with no
 * valid item is `unreadable` unless the page said `noResults`, which alone makes `[]` an answer.
 */
export function parseSearchResult(raw: unknown, idPattern: RegExp): ReaderParse<RawSearchItem[]> {
  const schema = schemaFor(raw, searchOkSchema);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return rejected(parsed.error);
  const value = parsed.data;
  if (!value.ok) return { result: parseFailureVariant(value), detail: null };
  const items = value.data.filter((entry) => matchesId(entry.id, idPattern));
  if (items.length === 0 && !value.noResults) {
    return {
      result: { ok: false, failure: 'unreadable', attempted: [value.strategy] },
      detail: null,
    };
  }
  return { result: { ok: true, strategy: value.strategy, data: items }, detail: null };
}

export function parseDetailResult(raw: unknown): ReaderParse<OfferDetail> {
  const parsed = schemaFor(raw, detailOkSchema).safeParse(raw);
  if (!parsed.success) return rejected(parsed.error);
  const value = parsed.data;
  return {
    result: value.ok
      ? { ok: true, strategy: value.strategy, data: value.data }
      : parseFailureVariant(value),
    detail: null,
  };
}

/** The generic reader returns title and text only; its URL comes from `tabs.get` (A19). */
export function parseGenericResult(raw: unknown): ReaderParse<GenericPreview> {
  const parsed = schemaFor(raw, genericOkSchema).safeParse(raw);
  if (!parsed.success) return rejected(parsed.error);
  const value = parsed.data;
  return {
    result: value.ok
      ? { ok: true, strategy: value.strategy, data: value.data }
      : parseFailureVariant(value),
    detail: null,
  };
}

/** The page markers: exactly five booleans, or `null` with the reason. */
export function parseMarkers(raw: unknown): {
  markers: PageMarkers | null;
  detail: ReaderParseDetail | null;
} {
  const parsed = markersSchema.safeParse(raw);
  return parsed.success
    ? { markers: parsed.data, detail: null }
    : { markers: null, detail: describeFailure(parsed.error) };
}
