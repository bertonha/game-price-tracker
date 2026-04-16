/** Regex that matches DLC/add-on/season pass titles — used to exclude them from price results. */
export const STORE_EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;

/** Words that signal an older/special edition of a game.
 *  When present in the title but absent from the query, the result is
 *  down-ranked so a newer or more precise match is preferred instead. */
const OLD_EDITION_QUALIFIERS = /\b(goty|classic|legacy|game of the year)\b/i;

/** Score how well a candidate title matches the query name.
 *  Returns 0 if any query word is missing from the title (strict subset check),
 *  otherwise returns Jaccard overlap as a tiebreaker.
 *  Titles that carry old-edition qualifiers not present in the query are
 *  penalised so a more relevant result wins the tie. */
export function matchScore(query: string, title: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[™®©]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  const qWords = new Set(normalize(query));
  const tWords = new Set(normalize(title));
  for (const w of qWords) if (!tWords.has(w)) return 0;
  let score = qWords.size / new Set([...qWords, ...tWords]).size;
  if (OLD_EDITION_QUALIFIERS.test(title) && !OLD_EDITION_QUALIFIERS.test(query)) {
    score *= 0.8;
  }
  return score;
}
