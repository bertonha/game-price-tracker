import type { Game } from "@/lib/types";

export function prioritizeStarred(list: Game[]): Game[] {
  const starred = list.filter((g) => g.isFavorite);
  const others = list.filter((g) => !g.isFavorite);
  return [...starred, ...others];
}

function minPrice(game: Game): number {
  let min = Number.POSITIVE_INFINITY;
  for (const info of Object.values(game.prices)) {
    if (!info?.price || info.price === "N/A") continue;
    const n = parseFloat(info.price.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!Number.isNaN(n) && n < min) min = n;
  }
  return min;
}

export function sortByPriceWithinStarGroups(list: Game[], direction: "asc" | "desc"): Game[] {
  function byPrice(a: Game, b: Game): number {
    const pa = minPrice(a);
    const pb = minPrice(b);
    if (pa === Number.POSITIVE_INFINITY && pb === Number.POSITIVE_INFINITY) return 0;
    if (pa === Number.POSITIVE_INFINITY) return 1;
    if (pb === Number.POSITIVE_INFINITY) return -1;
    return direction === "asc" ? pa - pb : pb - pa;
  }
  const starred = list.filter((g) => g.isFavorite).sort(byPrice);
  const others = list.filter((g) => !g.isFavorite).sort(byPrice);
  return [...starred, ...others];
}

export function sortByReleaseDateWithinStarGroups(list: Game[]): Game[] {
  function byDate(a: Game, b: Game): number {
    if (!a.releaseDate && !b.releaseDate) return 0;
    if (!a.releaseDate) return 1;
    if (!b.releaseDate) return -1;
    return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
  }
  const starred = list.filter((g) => g.isFavorite).sort(byDate);
  const others = list.filter((g) => !g.isFavorite).sort(byDate);
  return [...starred, ...others];
}

export type SortOrder = "priority" | "cheapest" | "expensive" | "release-date";

export function sortGames(list: Game[], sortOrder: SortOrder): Game[] {
  if (sortOrder === "cheapest") return sortByPriceWithinStarGroups(list, "asc");
  if (sortOrder === "expensive") return sortByPriceWithinStarGroups(list, "desc");
  if (sortOrder === "release-date") return sortByReleaseDateWithinStarGroups(list);
  return prioritizeStarred(list);
}
