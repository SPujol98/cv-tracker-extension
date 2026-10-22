// Prompt-injection tripwire (ADR-14 item 5; amendment A12). Offer text is data; this table only
// detects instruction-like phrases addressed to a model. Phrases are authored fresh and
// precision-first: every pattern needs the instruction verb together with its object. Catalan
// entries land with sub-change 7.

import { fold } from './text.ts';

/** Longest excerpt reported for the chip. */
export const INJECTION_MATCH_MAX_CHARS = 80;

/** Most distinct excerpts reported. */
export const INJECTION_MAX_MATCHES = 5;

/** Instruction-like phrases over folded (lowercase, ASCII quotes and dashes) text. */
const PHRASES: readonly RegExp[] = [
  // EN: dismiss earlier instructions
  /\b(?:ignore|disregard|forget|override)(?: (?:all|any|the|your|my|of))*(?: (?:previous|prior|above|earlier|preceding))+ (?:instructions?|prompts?|messages|rules|directions)\b/,
  /\b(?:ignore|disregard|forget|override) (?:all |any |the )?(?:your|my|system) (?:instructions?|prompts?|rules)\b/,
  // EN: reassign the model's role
  /\byou are now (?:an? |the )?(?:(?:unrestricted|unfiltered|jailbroken|new) )*(?:ai|assistant|chatbot|language model|model|dan)\b/,
  // EN: dictate the result
  /\b(?:output|return|give|set|assign) (?:the |a |an )?(?:score|rating|verdict)(?: of| to| as)?[ :=]*\d{2,3}\b/,
  // EN: extract the prompt
  /\b(?:reveal|print|show|repeat|leak|output) (?:me )?(?:your|the) (?:system|initial|hidden|original) (?:prompt|instructions)\b/,
  // ES
  /\b(?:ignora|olvida|desestima|omite)(?: (?:todas|todo|las|los|tus|de))* (?:instrucciones|indicaciones|reglas) (?:anteriores|previas|de arriba)\b/,
  /\bahora eres (?:un |una |el |la )?(?:asistente|ia|modelo|chatbot|dan)\b/,
  /\b(?:devuelve|devolver|asigna|otorga|pon)(?: (?:una|la|un))? (?:puntuaci[oó]n|nota|valoraci[oó]n)(?: (?:de|a))?[ :=]*\d{2,3}\b/,
  // The closing delimiter of the data block, whatever the surrounding text
  /<\/?\s*offer_data/,
];

/**
 * Looks for injection phrases in the full normalized text (not the capped request, so a signal at
 * the end of a long offer is not lost). Matches are short, distinct excerpts of the folded text.
 */
export function injectionSignals(text: string): { suspected: boolean; matches: string[] } {
  const folded = fold(text);
  const matches = new Set<string>();
  for (const phrase of PHRASES) {
    const found = phrase.exec(folded);
    if (found) matches.add(found[0].slice(0, INJECTION_MATCH_MAX_CHARS));
  }
  const list = [...matches].slice(0, INJECTION_MAX_MATCHES);
  return { suspected: list.length > 0, matches: list };
}
