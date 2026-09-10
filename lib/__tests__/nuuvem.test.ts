import { describe, expect, it } from "vitest";
import { decodePrice, extractPrice } from "@/lib/stores/nuuvem";

describe("decodePrice", () => {
  it("decodes a price from the 'v' field (cents)", () => {
    const encoded = JSON.stringify({ v: 4999 }).replace(/"/g, "&quot;");
    expect(decodePrice(encoded)).toBe("R$ 49,99");
  });

  it("decodes a price from the 'iv' field (units)", () => {
    const encoded = JSON.stringify({ iv: 50 }).replace(/"/g, "&quot;");
    expect(decodePrice(encoded)).toBe("R$ 50,00");
  });

  it("returns null for invalid JSON", () => {
    expect(decodePrice("not-json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodePrice("")).toBeNull();
  });
});

describe("extractPrice", () => {
  const buyBlock = (cents: number) =>
    `<div class="product-buy"><div class="mod-price product-price " data-price="{&quot;v&quot;:${cents}}" data-base-price="{&quot;v&quot;:30950}"></div></div>`;

  it("reads the price from an /item/info/ payload", () => {
    expect(extractPrice(buyBlock(27800))).toBe("R$ 278,00");
  });

  it("reads the price from the full product page", () => {
    const page = `<html><body><div class="product-headline"></div>${buyBlock(27800)}</body></html>`;
    expect(extractPrice(page)).toBe("R$ 278,00");
  });

  it("ignores a card's price that appears before the buy block", () => {
    const page = `<article class="game-card" data-price="{&quot;v&quot;:9900}"></article>${buyBlock(27800)}`;
    expect(extractPrice(page)).toBe("R$ 278,00");
  });

  it("ignores DLC cards further down the page", () => {
    const page = `${buyBlock(27800)}<article class="game-card" data-price="{&quot;v&quot;:1500}"></article>`;
    expect(extractPrice(page)).toBe("R$ 278,00");
  });

  it("falls back to the first data-price when there is no buy block", () => {
    expect(extractPrice('<div data-price="{&quot;v&quot;:1234}"></div>')).toBe("R$ 12,34");
  });

  it("returns null when the markup carries no price", () => {
    expect(extractPrice('<div class="product-buy"></div>')).toBeNull();
  });
});
