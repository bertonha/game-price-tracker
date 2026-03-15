import { Game } from "./types";

const STORAGE_KEY = "game-price-tracker-v1";

export function loadGames(): Game[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGames(games: Game[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    console.warn("Could not save games to localStorage");
  }
}
