export interface StorePrice {
  price: string | null;
  discount: string | null;
  url: string | null;
}

export interface GamePrices {
  steam: StorePrice;
  nuuvem: StorePrice;
}

export interface Game {
  appid: string;
  name: string;
  img: string;
  prices: Partial<GamePrices>;
  lastFetched?: number;
  addedAt: number;
}

export interface SteamSuggestion {
  appid: string;
  name: string;
  img: string;
}

export const STORES = [
  { id: "steam",  name: "Steam BR", color: "#1b2838", abbr: "ST" },
  { id: "nuuvem", name: "Nuuvem",   color: "#e8392b", abbr: "NU" },
] as const;

export type StoreId = typeof STORES[number]["id"];
