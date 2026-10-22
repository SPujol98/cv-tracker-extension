// Provider-facing JSON Schema for the model output (`offer_analysis_v2`, Contract B). Derived from
// the Zod schema so the two cannot drift; the schema carries no length or numeric bounds and no
// recursion (LLM-2), which is why score range and integrality are post-validation checks.
import { z } from 'zod';
import { offerAnalysisOutputSchema } from '../schemas/analysis.ts';

export const OFFER_ANALYSIS_SCHEMA_NAME = 'offer_analysis_v2';

const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(offerAnalysisOutputSchema);

export const offerAnalysisJsonSchema: Record<string, unknown> = jsonSchema;
