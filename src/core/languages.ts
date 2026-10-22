// The language table (PROFILE-5, ANALYSIS-6; amendment A16). Word lists are authored fresh and
// kept to lowercase folded words so they match `fold`ed text. Shared function words (for example
// "de", "la", "que" in Spanish and Catalan) sit in both lists so they cancel out, and the
// distinguishing words carry the decision as markers.

export type LanguageCode = string;

export interface LanguageEntry {
  code: LanguageCode;
  /** English name, used where a language is written for the model (output language). */
  name: string;
  /** Common function words: one point per occurrence. */
  stopwords: readonly string[];
  /** Words distinctive of the language: two points per occurrence. */
  markers: readonly string[];
}

/** Word lists are written as space-separated text; every word is lowercase and folded. */
const list = (text: string): string[] => text.split(/\s+/).filter(Boolean);

export const LANGUAGES: readonly LanguageEntry[] = [
  {
    code: 'es',
    name: 'Spanish',
    stopwords: list(
      'el la los las de del y en que un una con para por es se al su como más pero sobre o no lo le sus',
    ),
    markers: list(
      'años experiencia trabajo buscamos ofrecemos puesto equipo requisitos incorporación también nuestro nuestra contrato formación personas además jornada salario candidatura',
    ),
  },
  {
    code: 'en',
    name: 'English',
    stopwords: list(
      'the and of to in is for with you we are will on as be our have that this or an at from by your not all who us',
    ),
    markers: list(
      'experience years team work working looking position requirements company offer skills customers people join training building salary candidate responsibilities benefits also',
    ),
  },
  {
    code: 'ca',
    name: 'Catalan',
    stopwords: list(
      'el la els les de del dels i en que un una amb per es al com més però sobre o no són és molt a',
    ),
    markers: list(
      'anys experiència treball busquem oferim lloc equip requisits incorporació també nostre nostra contracte formació persones això jornada salari candidatura requereix',
    ),
  },
];

/** The English name of a language for prompts; a code the table does not name is written as is. */
export function languageName(
  code: LanguageCode,
  table: readonly LanguageEntry[] = LANGUAGES,
): string {
  return table.find((entry) => entry.code === code)?.name ?? code;
}
