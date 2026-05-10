import { describe, expect, it } from "vitest";
import { buildWhatsAppText, findBestPrice, parsePrice } from "@/lib/share";
import type { Game } from "@/lib/types";

const BASE_GAME: Game = {
  appid: "1234",
  name: "Test Game",
  img: "",
  prices: {},
  addedAt: 0,
};

describe("parsePrice", () => {
  it("parses Brazilian Real format", () => {
    expect(parsePrice("R$ 150,00")).toBe(150);
  });

  it("parses dot-decimal format", () => {
    expect(parsePrice("R$ 12.99")).toBe(12.99);
  });

  it("parses Euro format", () => {
    expect(parsePrice("€ 29,99")).toBe(29.99);
  });

  it("returns null for N/A", () => {
    expect(parsePrice("N/A")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parsePrice(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parsePrice("")).toBeNull();
  });
});

describe("findBestPrice", () => {
  it("returns the store with the lowest price", () => {
    const game: Game = {
      ...BASE_GAME,
      prices: {
        steam: { price: "R$ 150,00", url: "https://store.steampowered.com/app/1234" },
        nuuvem: { price: "R$ 120,00", url: "https://nuuvem.com/game" },
        "instant-gaming": { price: "R$ 90,00", url: "https://instant-gaming.com/game" },
      },
    };
    const result = findBestPrice(game);
    expect(result?.id).toBe("instant-gaming");
    expect(result?.price).toBe("R$ 90,00");
  });

  it("skips stores with null price", () => {
    const game: Game = {
      ...BASE_GAME,
      prices: {
        steam: { price: null, url: "https://store.steampowered.com/app/1234" },
        nuuvem: { price: "R$ 120,00", url: "https://nuuvem.com/game" },
      },
    };
    expect(findBestPrice(game)?.id).toBe("nuuvem");
  });

  it("skips stores with N/A price", () => {
    const game: Game = {
      ...BASE_GAME,
      prices: {
        steam: { price: "N/A", url: "https://store.steampowered.com/app/1234" },
        nuuvem: { price: "R$ 120,00", url: "https://nuuvem.com/game" },
      },
    };
    expect(findBestPrice(game)?.id).toBe("nuuvem");
  });

  it("skips stores with no URL", () => {
    const game: Game = {
      ...BASE_GAME,
      prices: {
        steam: { price: "R$ 50,00", url: null },
        nuuvem: { price: "R$ 120,00", url: "https://nuuvem.com/game" },
      },
    };
    expect(findBestPrice(game)?.id).toBe("nuuvem");
  });

  it("returns null when no prices are available", () => {
    expect(findBestPrice(BASE_GAME)).toBeNull();
  });

  it("returns the only available store", () => {
    const game: Game = {
      ...BASE_GAME,
      prices: {
        nuuvem: { price: "R$ 80,00", url: "https://nuuvem.com/game" },
      },
    };
    expect(findBestPrice(game)?.id).toBe("nuuvem");
  });
});

describe("buildWhatsAppText", () => {
  const url = "https://store.steampowered.com/app/1234";

  it("uses best-price format when isBestPrice and price are set", () => {
    const text = buildWhatsAppText("Half-Life 2", url, "R$ 9,99", "Steam BR", true);
    expect(text).toBe(
      `We found the best price on Steam BR for Half-Life 2 (R$ 9,99), check it out!\n${url}`,
    );
  });

  it("uses regular format when not best price but price is set", () => {
    const text = buildWhatsAppText("Half-Life 2", url, "R$ 9,99", "Nuuvem", false);
    expect(text).toBe(`Checkout Half-Life 2 for R$ 9,99 on Nuuvem!\n${url}`);
  });

  it("uses no-price format when price is null", () => {
    const text = buildWhatsAppText("Half-Life 2", url, null, "Steam BR", false);
    expect(text).toBe(`Check out Half-Life 2 on Steam BR!\n${url}`);
  });

  it("falls back to no-price format when isBestPrice but price is null", () => {
    const text = buildWhatsAppText("Half-Life 2", url, null, "Steam BR", true);
    expect(text).toBe(`Check out Half-Life 2 on Steam BR!\n${url}`);
  });
});
