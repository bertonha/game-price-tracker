/** Regex that matches DLC/add-on/season pass titles — used to exclude them from price results. */
export const STORE_EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;

/** Minimum matchScore required to accept a result.
 *  A score of 0.5 lets "Dwarf Journey" match the query "Journey"; 0.6 blocks it. */
export const MIN_MATCH_SCORE = 0.6;

/** Words that signal an older/special edition of a game.
 *  When present in the title but absent from the query, the result is
 *  down-ranked so a newer or more precise match is preferred instead. */
const OLD_EDITION_QUALIFIERS = /\b(goty|classic|legacy|game of the year|anniversary)\b/i;

/** Nouns that close out a phrase describing a repackaging of the same game —
 *  "Game of the YoRHa Edition", "Director's Cut", "Deluxe".
 *  A trailing phrase that does NOT end in one of these marks a different game
 *  ("Portal 2", "Journey to the Savage Planet"), so the distinction is what
 *  keeps `editionOfQuery` from swallowing sequels and unrelated titles.
 *
 *  Deliberately excluded: remaster, remake, collection, bundle, anniversary.
 *  Those name a separate product with its own Steam appid — "Fable Anniversary"
 *  is a re-release of the 2004 game, not packaging around the 2026 "Fable". */
const EDITION_SUFFIX = /\b(edition|cut|goty|complete|deluxe|ultimate|premium)$/i;

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Whether `tWords` is the whole query followed only by an edition qualifier —
 *  the same game in different packaging, not a different game.
 *
 *  A one-word query is never enough to conclude that: "Fable" is a prefix of
 *  every game in the series, so anything trailing it could just as easily be a
 *  different entry. Only a query specific enough to span two words earns the
 *  benefit of the doubt. */
function editionOfQuery(qWords: string[], tWords: string[]): boolean {
  if (qWords.length < 2) return false;
  if (tWords.length <= qWords.length) return false;
  for (let i = 0; i < qWords.length; i++) if (tWords[i] !== qWords[i]) return false;
  return EDITION_SUFFIX.test(tWords.slice(qWords.length).join(" "));
}

/** Score how well a candidate title matches the query name.
 *  Returns 0 if any query word is missing from the title (strict subset check),
 *  otherwise returns Jaccard overlap as a tiebreaker.
 *  Titles that carry old-edition qualifiers not present in the query are
 *  penalised so a more relevant result wins the tie.
 *
 *  A title that is the query plus an edition qualifier is lifted into the
 *  accepted band: Jaccard alone sinks "NieR:Automata Game of the YoRHa Edition"
 *  to 0.29 against the query "NieR:Automata", even though it is the only
 *  listing some stores carry. It always stays below an exact match, so a plain
 *  base-game listing still wins when one exists. */
export function matchScore(query: string, title: string): number {
  const qWords = normalize(query);
  const tWords = normalize(title);
  const qSet = new Set(qWords);
  const tSet = new Set(tWords);
  for (const w of qSet) if (!tSet.has(w)) return 0;

  let score = qSet.size / new Set([...qSet, ...tSet]).size;
  if (OLD_EDITION_QUALIFIERS.test(title) && !OLD_EDITION_QUALIFIERS.test(query)) {
    score *= 0.8;
  }
  if (editionOfQuery(qWords, tWords)) {
    score = MIN_MATCH_SCORE + (1 - MIN_MATCH_SCORE) * score;
  }
  return score;
}
