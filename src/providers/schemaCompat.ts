// JSON-schema helpers shared by the adapters (LLM-2, LLM-3). Structured-output decoders accept
// only a subset of JSON Schema, so an unsupported schema is a programming error caught before any
// request is built, not a runtime provider failure.
import type { ProviderId } from '../core/ports/llm.ts';

type Schema = Record<string, unknown>;

/** Length and numeric bounds the structured-output decoders reject (LLM-2). */
const UNSUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minItems',
  'maxItems',
]);

/** Keywords whose value is a map of name to subschema. */
const SCHEMA_MAPS = ['properties', 'patternProperties', '$defs', 'definitions'] as const;
/** Keywords whose value is a list of subschemas. */
const SCHEMA_LISTS = ['anyOf', 'oneOf', 'allOf', 'prefixItems'] as const;
/** Keywords whose value is one subschema (or, for `items`, possibly a list). */
const SCHEMA_SINGLES = ['items', 'additionalProperties', 'not', 'if', 'then', 'else'] as const;

export class SchemaIncompatibleError extends Error {
  readonly keyword: string;
  readonly path: string;
  readonly provider: ProviderId;

  constructor(provider: ProviderId, keyword: string, path: string, detail: string) {
    super(`Schema is not compatible with ${provider} structured output: ${detail} at "${path}".`);
    this.name = 'SchemaIncompatibleError';
    this.keyword = keyword;
    this.path = path;
    this.provider = provider;
  }
}

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function resolveLocalRef(root: Schema, ref: string): unknown {
  if (ref === '#') return root;
  let node: unknown = root;
  for (const raw of ref.slice(2).split('/')) {
    if (!isSchema(node)) return undefined;
    node = node[raw.replace(/~1/g, '/').replace(/~0/g, '~')];
  }
  return node;
}

/**
 * Throws `SchemaIncompatibleError` when `schema` holds a length or numeric bound, or a `$ref`
 * that leads back to itself (directly or through other definitions).
 */
export function assertSchemaCompatible(schema: Schema, provider: ProviderId): void {
  const refStack: string[] = [];

  function walkAll(nodes: unknown[], path: string): void {
    for (const [i, child] of nodes.entries()) walk(child, `${path}/${i}`);
  }

  function walk(node: unknown, path: string): void {
    if (!isSchema(node)) return;
    for (const keyword of Object.keys(node)) {
      if (UNSUPPORTED_KEYWORDS.has(keyword)) {
        throw new SchemaIncompatibleError(
          provider,
          keyword,
          path || '/',
          `"${keyword}" is unsupported`,
        );
      }
    }
    const ref = node.$ref;
    if (typeof ref === 'string' && ref.startsWith('#')) {
      if (refStack.includes(ref)) {
        throw new SchemaIncompatibleError(provider, '$ref', path || '/', `recursive $ref "${ref}"`);
      }
      refStack.push(ref);
      walk(resolveLocalRef(schema, ref), ref);
      refStack.pop();
    }
    for (const key of SCHEMA_MAPS) {
      const map = node[key];
      if (!isSchema(map)) continue;
      for (const [name, child] of Object.entries(map)) walk(child, `${path}/${key}/${name}`);
    }
    for (const key of SCHEMA_LISTS) {
      const list = node[key];
      if (Array.isArray(list)) walkAll(list, `${path}/${key}`);
    }
    for (const key of SCHEMA_SINGLES) {
      const child = node[key];
      if (Array.isArray(child)) walkAll(child, `${path}/${key}`);
      else walk(child, `${path}/${key}`);
    }
  }

  walk(schema, '');
}

/**
 * Returns a copy of `schema` for OpenAI strict mode (LLM-3): every object lists all of its
 * properties as required and forbids additional properties. The input is never mutated.
 */
export function toStrictSchema(schema: Schema): Schema {
  function strict(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(strict);
    if (!isSchema(node)) return node;
    const out: Schema = { ...node };
    for (const key of SCHEMA_MAPS) {
      const map = node[key];
      if (!isSchema(map)) continue;
      out[key] = Object.fromEntries(
        Object.entries(map).map(([name, child]) => [name, strict(child)]),
      );
    }
    for (const key of [...SCHEMA_LISTS, ...SCHEMA_SINGLES]) {
      if (key in node) out[key] = strict(node[key]);
    }
    if (isSchema(node.properties)) {
      out.required = Object.keys(node.properties);
      out.additionalProperties = false;
    }
    return out;
  }
  return strict(schema) as Schema;
}
