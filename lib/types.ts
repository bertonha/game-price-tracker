export interface Edition {
  name: string;
  price: string | null;
  url: string | null;
}

export interface StorePrice {
  price: string | null;
  url: string | null;
  editions?: Edition[];
}

export interface GamePrices {
  steam: StorePrice;
  nuuvem: StorePrice;
  "instant-gaming": StorePrice;
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
  { id: "steam", name: "Steam BR", color: "#1b2838", abbr: "ST" },
  { id: "nuuvem", name: "Nuuvem", color: "#e8392b", abbr: "NU" },
  { id: "instant-gaming", name: "Instant Gaming", color: "#e8a000", abbr: "IG" },
] as const;

export type StoreId = (typeof STORES)[number]["id"];
