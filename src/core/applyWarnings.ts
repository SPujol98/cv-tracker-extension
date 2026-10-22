// Apply-instruction warnings (ANALYSIS-7; amendment A16; Contract D). A category fires only for a
// sentence that holds both a directive cue (an imperative or a request addressed to the
// applicant) and a category cue, close together. A bare mention, such as a footer address, has
// no directive and never fires. Word lists are authored fresh; Spanish and English are required,
// Catalan entries land with sub-change 7.

import { WARNING_CATEGORIES } from './schemas/analysis.ts';
import { normalizeOfferText } from './text.ts';

export type WarningCategory = (typeof WARNING_CATEGORIES)[number];

export interface ApplyWarning {
  category: WarningCategory;
  excerpt: string;
}

/** Longest excerpt of a warning. */
export const APPLY_WARNING_EXCERPT_CHARS = 160;

/** The directive and the category cue must start within this many characters of each other. */
const MAX_CUE_GAP = 120;

const EMAIL_ADDRESS = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/giu;

/** A whole-word, case-insensitive alternation; accents are letters, so no ASCII-only `\b`. */
function cue(alternatives: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'iu');
}

const DIRECTIVE = cue(
  [
    // English
    'please|kindly|send|submit|forward|attach|include|provide|share|tell us|let us know',
    'indicate|state|specify|mention|describe|upload|visit|register|sign up|go to|must|should',
    "need to|needs to|required|mandatory|requested|don't forget|do not forget|be sure to",
    'e-?mail (?:your|us|the|a|an|me|to)|call (?:us|me|our|the|this|on)|call (?=[+(\\d])',
    'apply (?:at|on|via|through|online|here|by|to|now|with|using|directly|in)|fill (?:in|out)',
    // Spanish
    'por favor|env[ií]a|env[ií]anos|enviar|env[ií]e|envien|remite|remitir|adjunta|adjuntar|adjunte',
    'incluye|incluir|incluya|indica|ind[ií]canos|indicar|indique|cu[eé]ntanos|comparte|compartir',
    'facilita|facilite|aporta|aportar|aporte|proporciona|proporcione|contacta|escr[ií]benos',
    'escribe|visita|visitar|accede|reg[ií]strate|inscr[ií]bete|rellena|rellenar|solicita',
    'debes|debe|deben|deber[aá]s|es necesario|se requiere|se ruega|es imprescindible|no olvides',
    'obligatori[oa]|imprescindible|requerid[oa]|necesari[oa]',
    'llama(?:r)? (?:al|a|nuestro)|llama(?:r)? (?=[+(\\d])|ll[aá]manos|aplica (?:en|a|mediante|desde)',
  ].join('|'),
);

const NUMBER_CUE = String.raw`\+\d[\d\s().-]{6,}\d|\(?\d{2,4}\)?[\s.-]\d{3}[\s.-]\d{2,4}(?:[\s.-]\d{2,4})?`;

const CATEGORY_CUES: Record<WarningCategory, RegExp> = {
  email: cue(`${EMAIL_ADDRESS.source}|e-?mail|correo(?: electr[oó]nico)?`),
  phone: cue(`${NUMBER_CUE}|phone|telephone|mobile|whatsapp|tel[eé]fono|m[oó]vil`),
  external_site: cue(
    String.raw`(?:https?://|www\.)\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)+/\S*|[a-z0-9-]+\.(?:com|org|net|io|co|es|eu|dev|app|jobs|careers)|` +
      'career(?:s)? (?:page|site|portal)|our (?:jobs|careers) (?:page|site|portal)|portal de empleo|nuestra web|nuestro portal|p[aá]gina de empleo',
  ),
  cover_letter: cue(
    'cover letters?|motivation letters?|letter of motivation|carta de presentaci[oó]n|carta de motivaci[oó]n',
  ),
  salary_expectation: cue(
    'salary expectations?|expected salary|desired salary|salary requirements?|pretensi[oó]n(?:es)? salarial(?:es)?|expectativas? salarial(?:es)?|salario deseado|retribuci[oó]n deseada',
  ),
  start_date: cue(
    'start(?:ing)? date|earliest start|notice period|available to start|when you can start|fecha de (?:incorporaci[oó]n|inicio)|periodo de preaviso|disponibilidad (?:para )?(?:incorporaci[oó]n|empezar|incorporarte)',
  ),
  reference: cue(
    'references?|referees|referencias(?: laborales| profesionales)?|cartas? de recomendaci[oó]n',
  ),
  portfolio: cue(
    'portfolio|portafolio|github|behance|dribbble|work samples|samples of your work|muestras de (?:tu )?trabajo',
  ),
};

/** Sentences end at `.`, `!` or `?` followed by whitespace and a capital; bullet glyphs also split. */
function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡])|\s*[•●▪◦]\s*/u).filter((part) => part.length > 0);
}

function warningFor(sentence: string, category: WarningCategory): ApplyWarning | null {
  const directive = DIRECTIVE.exec(sentence);
  if (!directive) return null;
  // An email address also looks like a domain: remove it before looking for another site.
  const searchable =
    category === 'external_site'
      ? sentence.replace(EMAIL_ADDRESS, (m) => ' '.repeat(m.length))
      : sentence;
  const found = CATEGORY_CUES[category].exec(searchable);
  if (!found || Math.abs(found.index - directive.index) > MAX_CUE_GAP) return null;
  const start = Math.min(found.index, directive.index);
  return { category, excerpt: sentence.slice(start, start + APPLY_WARNING_EXCERPT_CHARS).trim() };
}

/**
 * Warnings from the full normalized offer text (never the capped request, so an instruction in
 * the tail of a long offer is found): one per category, from its first match, in order of
 * appearance.
 */
export function detectApplyWarnings(text: string): ApplyWarning[] {
  const found = new Map<WarningCategory, ApplyWarning>();
  for (const sentence of sentences(normalizeOfferText(text))) {
    for (const category of WARNING_CATEGORIES) {
      if (found.has(category)) continue;
      const warning = warningFor(sentence, category);
      if (warning) found.set(category, warning);
    }
  }
  return [...found.values()];
}
