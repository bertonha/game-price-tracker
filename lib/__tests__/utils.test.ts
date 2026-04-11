import { describe, expect, it, vi } from "vitest";
import { bestDeal, gameKey, parseGameInput, stripGamePrefix, timeAgo } from "@/lib/utils";

describe("gameKey", () => {
  it("returns appid when present", () => {
    expect(gameKey({ appid: "123", name: "Half-Life" })).toBe("123");
  });

  it("falls back to name when appid is absent", () => {
    expect(gameKey({ name: "Half-Life" })).toBe("Half-Life");
  });

  it("falls back to name when appid is empty string", () => {
    expect(gameKey({ appid: "", name: "Half-Life" })).toBe("Half-Life");
  });
});

describe("stripGamePrefix", () => {
  it("strips matching base name prefix from edition", () => {
    expect(stripGamePrefix("Cyberpunk 2077 Ultimate Edition", "Cyberpunk 2077")).toBe(
      "Ultimate Edition",
    );
  });

  it("is case-insensitive and ignores trademark symbols", () => {
    expect(stripGamePrefix("Hades™ II Founder's Edition", "Hades™ II")).toBe("Founder's Edition");
  });

  it("returns full title when edition does not start with base name", () => {
    expect(stripGamePrefix("Some Other Game", "Cyberpunk 2077")).toBe("Some Other Game");
  });

  it("returns full title when edition equals base name exactly", () => {
    expect(stripGamePrefix("Cyberpunk 2077", "Cyberpunk 2077")).toBe("Cyberpunk 2077");
  });

  it("handles dashes and colons in normalization", () => {
    expect(stripGamePrefix("Dark Souls III: The Ringed City", "Dark Souls III")).toBe(
      "The Ringed City",
    );
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for timestamps within the last minute", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(timeAgo(1_000_000 - 30_000)).toBe("just now");
    vi.restoreAllMocks();
  });

  it("returns minutes ago", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(timeAgo(1_000_000 - 5 * 60_000)).toBe("5m ago");
    vi.restoreAllMocks();
  });

  it("returns hours ago", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(timeAgo(1_000_000 - 3 * 3_600_000)).toBe("3h ago");
    vi.restoreAllMocks();
  });

  it("returns days ago", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    expect(timeAgo(1_000_000 - 2 * 86_400_000)).toBe("2d ago");
    vi.restoreAllMocks();
  });
});

describe("parseGameInput", () => {
  it("extracts appid from a Steam store URL", () => {
    expect(parseGameInput("https://store.steampowered.com/app/1091500/Cyberpunk_2077/")).toEqual({
      type: "appid",
      appid: "1091500",
    });
  });

  it("recognises a bare numeric appid", () => {
    expect(parseGameInput("1091500")).toEqual({ type: "appid", appid: "1091500" });
  });

  it("treats a plain name as a name query", () => {
    expect(parseGameInput("Cyberpunk 2077")).toEqual({ type: "name", name: "Cyberpunk 2077" });
  });

  it("returns null for a single character", () => {
    expect(parseGameInput("x")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseGameInput("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(parseGameInput("   ")).toBeNull();
  });
});

describe("bestDeal", () => {
  it("returns the store with the lowest price", () => {
    expect(
      bestDeal({
        steam: { price: "R$ 150,00" },
        nuuvem: { price: "R$ 120,00" },
        "instant-gaming": { price: "R$ 90,00" },
      }),
    ).toBe("instant-gaming");
  });

  it("ignores N/A prices", () => {
    expect(
      bestDeal({
        steam: { price: "N/A" },
        nuuvem: { price: "R$ 120,00" },
      }),
    ).toBe("nuuvem");
  });

  it("ignores missing prices", () => {
    expect(
      bestDeal({
        steam: { price: null },
        nuuvem: { price: "R$ 120,00" },
      }),
    ).toBe("nuuvem");
  });

  it("returns null when all prices are N/A", () => {
    expect(bestDeal({ steam: { price: "N/A" }, nuuvem: { price: "N/A" } })).toBeNull();
  });

  it("returns null for empty prices object", () => {
    expect(bestDeal({})).toBeNull();
  });
});
