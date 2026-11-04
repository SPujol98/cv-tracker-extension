import { describe, expect, it } from 'vitest';
import {
  assertSchemaCompatible,
  SchemaIncompatibleError,
  toStrictSchema,
} from '../../../src/providers/schemaCompat.ts';

/** Reads a dotted path (array indexes included) out of a transformed schema. */
function at(value: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], value);
}

const compatible = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    tags: { type: 'array', items: { type: 'string' } },
    fit: { $ref: '#/$defs/fit' },
  },
  required: ['score'],
  additionalProperties: false,
  $defs: { fit: { type: 'object', properties: { label: { type: 'string' } } } },
};

function incompatibility(schema: Record<string, unknown>, provider: 'anthropic' | 'openai') {
  try {
    assertSchemaCompatible(schema, provider);
  } catch (error) {
    if (error instanceof SchemaIncompatibleError) return error;
    throw error;
  }
  return undefined;
}

describe('assertSchemaCompatible (LLM-2)', () => {
  it('accepts a schema with no bounds and no recursion', () => {
    expect(() => assertSchemaCompatible(compatible, 'anthropic')).not.toThrow();
    expect(() => assertSchemaCompatible(compatible, 'openai')).not.toThrow();
  });

  it('rejects minLength, naming the keyword and its path', () => {
    const error = incompatibility(
      { type: 'object', properties: { name: { type: 'string', minLength: 1 } } },
      'anthropic',
    );
    expect(error).toBeInstanceOf(SchemaIncompatibleError);
    expect(error?.keyword).toBe('minLength');
    expect(error?.path).toBe('/properties/name');
    expect(error?.message).toContain('minLength');
    expect(error?.message).toContain('anthropic');
  });

  it('rejects maximum and the other length and numeric bounds', () => {
    for (const keyword of [
      'maximum',
      'minimum',
      'exclusiveMaximum',
      'exclusiveMinimum',
      'multipleOf',
      'maxLength',
      'minItems',
      'maxItems',
    ]) {
      const error = incompatibility(
        { type: 'object', properties: { n: { type: 'number', [keyword]: 3 } } },
        'openai',
      );
      expect(error?.keyword).toBe(keyword);
    }
  });

  it('finds a bound nested in items, combinators and definitions', () => {
    expect(
      incompatibility({ type: 'array', items: { type: 'integer', maximum: 5 } }, 'anthropic')?.path,
    ).toBe('/items');
    expect(
      incompatibility({ anyOf: [{ type: 'string' }, { type: 'string', minLength: 2 }] }, 'openai')
        ?.path,
    ).toBe('/anyOf/1');
    expect(
      incompatibility({ $defs: { a: { type: 'string', maxLength: 2 } } }, 'openai')?.path,
    ).toBe('/$defs/a');
  });

  it('does not mistake a property named like a keyword for the keyword', () => {
    expect(() =>
      assertSchemaCompatible(
        {
          type: 'object',
          properties: { maximum: { type: 'integer' }, minLength: { type: 'string' } },
        },
        'anthropic',
      ),
    ).not.toThrow();
  });

  it('rejects a recursive $ref (self and mutual) and accepts a reused non-recursive one', () => {
    const selfRef = {
      type: 'object',
      properties: { child: { $ref: '#/$defs/node' } },
      $defs: { node: { type: 'object', properties: { next: { $ref: '#/$defs/node' } } } },
    };
    expect(incompatibility(selfRef, 'anthropic')?.keyword).toBe('$ref');

    const mutual = {
      $ref: '#/$defs/a',
      $defs: {
        a: { type: 'object', properties: { b: { $ref: '#/$defs/b' } } },
        b: { type: 'object', properties: { a: { $ref: '#/$defs/a' } } },
      },
    };
    expect(incompatibility(mutual, 'openai')?.keyword).toBe('$ref');

    const rootRef = { type: 'object', properties: { again: { $ref: '#' } } };
    expect(incompatibility(rootRef, 'openai')?.keyword).toBe('$ref');

    const reused = {
      type: 'object',
      properties: { a: { $ref: '#/$defs/x' }, b: { $ref: '#/$defs/x' } },
      $defs: { x: { type: 'string' } },
    };
    expect(() => assertSchemaCompatible(reused, 'anthropic')).not.toThrow();
  });
});

describe('toStrictSchema (LLM-3)', () => {
  it('makes every property required and forbids additional properties', () => {
    const strict = toStrictSchema({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'integer' } },
      required: ['a'],
    });
    expect(strict).toEqual({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'integer' } },
      required: ['a', 'b'],
      additionalProperties: false,
    });
  });

  it('recurses into nested objects, arrays, combinators and definitions', () => {
    const strict = toStrictSchema({
      type: 'object',
      properties: {
        list: { type: 'array', items: { type: 'object', properties: { x: { type: 'string' } } } },
        either: {
          anyOf: [{ type: 'object', properties: { y: { type: 'string' } } }, { type: 'null' }],
        },
        ref: { $ref: '#/$defs/d' },
      },
      $defs: { d: { type: 'object', properties: { z: { type: 'string' } } } },
    });
    expect(at(strict, 'properties.list.items.required')).toEqual(['x']);
    expect(at(strict, 'properties.list.items.additionalProperties')).toBe(false);
    expect(at(strict, 'properties.either.anyOf.0.required')).toEqual(['y']);
    expect(at(strict, 'properties.either.anyOf.0.additionalProperties')).toBe(false);
    expect(at(strict, '$defs.d.required')).toEqual(['z']);
    expect(at(strict, '$defs.d.additionalProperties')).toBe(false);
    expect(at(strict, 'required')).toEqual(['list', 'either', 'ref']);
  });

  it('overrides additionalProperties: true and does not mutate the input', () => {
    const input = {
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: true,
    };
    const snapshot = structuredClone(input);
    const strict = toStrictSchema(input) as Record<string, unknown>;
    expect(strict.additionalProperties).toBe(false);
    expect(input).toEqual(snapshot);
  });

  it('keeps a property that is itself named like a schema keyword', () => {
    const strict = toStrictSchema({
      type: 'object',
      properties: { items: { type: 'string' }, properties: { type: 'string' } },
    });
    expect(at(strict, 'required')).toEqual(['items', 'properties']);
    expect(at(strict, 'properties.items')).toEqual({ type: 'string' });
  });
});
