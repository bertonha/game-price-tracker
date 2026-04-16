import { describe, expect, it } from "vitest";
import { decodePrice } from "@/lib/stores/nuuvem";

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
