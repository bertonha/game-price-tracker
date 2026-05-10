import type { Game } from "@/lib/types";
import { bestDeal } from "@/lib/utils";

export function filterByStore(games: Game[], activeStores: Set<string>): Game[] {
  if (activeStores.size === 0) return games;
  return games.filter((g) => activeStores.has(bestDeal(g.prices) ?? ""));
}

export function filterByFavorite(games: Game[], starredOnly: boolean): Game[] {
  if (!starredOnly) return games;
  return games.filter((g) => g.isFavorite);
}

export function filterByQuery(games: Game[], query: string): Game[] {
  const q = query.trim().toLowerCase();
  if (!q) return games;
  return games.filter((g) => g.name.toLowerCase().includes(q) || g.appid.includes(q));
}
