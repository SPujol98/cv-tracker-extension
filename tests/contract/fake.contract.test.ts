// The test-only fake provider run through the shared contract suite (LLM-1), without transport.
import { ProviderError } from '../../src/core/ports/llm.ts';
import { FakeClock } from '../support/fakeClock.ts';
import {
  createFakeProvider,
  FAKE_MODEL,
  fakeFinal,
  fakeProgress,
} from '../support/fakeProvider.ts';
import {
  type ContractBehavior,
  type ContractFixtures,
  type ContractSubject,
  describeLlmProviderContract,
} from './llmProvider.contract.ts';

const FINAL_JSON = { verdict: 'apply', score: 80 };

const fixtures: ContractFixtures = {
  request: {
    modelId: FAKE_MODEL.id,
    prefix: ['stable prefix'],
    variable: 'offer text',
    schemaName: 'offer_analysis_v2',
    jsonSchema: { type: 'object', properties: { verdict: { type: 'string' } } },
    maxOutputTokens: 1_000,
  },
  key: 'fake-contract-key',
  expectedFinal: { json: FINAL_JSON, model: FAKE_MODEL.id },
};

function fakeSubject(behavior: ContractBehavior): ContractSubject {
  const clock = new FakeClock();
  const ok = [fakeProgress(10), fakeProgress(40), fakeFinal(FINAL_JSON)];
  switch (behavior.kind) {
    case 'ok':
      return { provider: createFakeProvider(ok), clock, requests: [] };
    case 'stall':
      return {
        provider: createFakeProvider([
          fakeProgress(10),
          new ProviderError('timeout', 'The provider call timed out.'),
        ]),
        clock,
        requests: [],
      };
    case 'hang': {
      const base = createFakeProvider(ok);
      return {
        provider: {
          ...base,
          async *complete(_request, _key, { signal }) {
            yield fakeProgress(10);
            await new Promise<void>((resolve) => {
              if (signal.aborted) resolve();
              signal.addEventListener('abort', () => resolve(), { once: true });
            });
            throw new ProviderError('cancelled', 'The request was cancelled.');
          },
        },
        clock,
        requests: [],
      };
    }
    default:
      throw new Error(`the fake has no HTTP transport; unsupported behavior: ${behavior.kind}`);
  }
}

describeLlmProviderContract(fakeSubject, fixtures, { transport: false });
