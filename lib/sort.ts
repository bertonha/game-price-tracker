import type { Game } from "@/lib/types";
import { bestDealSavings, parsePrice } from "@/lib/utils";

export function prioritizeStarred(list: Game[]): Game[] {
  const starred = list.filter((g) => g.isFavorite);
  const others = list.filter((g) => !g.isFavorite);
  return [...starred, ...others];
}

function sortWithinStarGroups(
  list: Game[],
  compare: (a: Game, b: Game) => number,
  ignoreStarred: boolean,
): Game[] {
  if (ignoreStarred) return [...list].sort(compare);
  const starred = list.filter((g) => g.isFavorite).sort(compare);
  const others = list.filter((g) => !g.isFavorite).sort(compare);
  return [...starred, ...others];
}

function minPrice(game: Game): number {
  let min = Number.POSITIVE_INFINITY;
  for (const info of Object.values(game.prices)) {
    const n = parsePrice(info?.price);
    if (n !== null && n < min) min = n;
  }
  return min;
}

export function sortByPriceWithinStarGroups(
  list: Game[],
  direction: "asc" | "desc",
  ignoreStarred = false,
): Game[] {
  function byPrice(a: Game, b: Game): number {
    const pa = minPrice(a);
    const pb = minPrice(b);
    if (pa === Number.POSITIVE_INFINITY && pb === Number.POSITIVE_INFINITY) return 0;
    if (pa === Number.POSITIVE_INFINITY) return 1;
    if (pb === Number.POSITIVE_INFINITY) return -1;
    return direction === "asc" ? pa - pb : pb - pa;
  }
  return sortWithinStarGroups(list, byPrice, ignoreStarred);
}

export function sortByReleaseDateWithinStarGroups(
  list: Game[],
  direction: "asc" | "desc",
  ignoreStarred = false,
): Game[] {
  function byDate(a: Game, b: Game): number {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    const diff = new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
    return direction === "asc" ? diff : -diff;
  }
  return sortWithinStarGroups(list, byDate, ignoreStarred);
}

/** Orders by how far each game's best deal sits below Steam's list price,
 *  deepest discount first. Games with nothing to compare go last. */
export function sortByDiscountWithinStarGroups(list: Game[], ignoreStarred = false): Game[] {
  function byDiscount(a: Game, b: Game): number {
    const da = bestDealSavings(a.prices);
    const db = bestDealSavings(b.prices);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return db - da;
  }
  return sortWithinStarGroups(list, byDiscount, ignoreStarred);
}

export type SortOrder =
  | "priority"
  | "cheapest"
  | "expensive"
  | "best-discount"
  | "release-newest"
  | "release-oldest";

export function sortGames(list: Game[], sortOrder: SortOrder, ignoreStarred = false): Game[] {
  if (sortOrder === "cheapest") return sortByPriceWithinStarGroups(list, "asc", ignoreStarred);
  if (sortOrder === "best-discount") return sortByDiscountWithinStarGroups(list, ignoreStarred);
  if (sortOrder === "expensive") return sortByPriceWithinStarGroups(list, "desc", ignoreStarred);
  if (sortOrder === "release-newest")
    return sortByReleaseDateWithinStarGroups(list, "desc", ignoreStarred);
  if (sortOrder === "release-oldest")
    return sortByReleaseDateWithinStarGroups(list, "asc", ignoreStarred);
  return ignoreStarred ? list : prioritizeStarred(list);
}
