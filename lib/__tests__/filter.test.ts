import { describe, expect, it } from "vitest";
import { filterByFavorite, filterByQuery, filterByStore } from "@/lib/filter";
import type { Game } from "@/lib/types";

function makeGame(name: string, overrides: Partial<Game> = {}): Game {
  return { appid: name, name, img: "", prices: {}, addedAt: 0, ...overrides };
}

function names(list: Game[]) {
  return list.map((g) => g.name);
}

describe("filterByStore", () => {
  const steam = makeGame("SteamGame", {
    prices: { steam: { price: "R$ 50,00", url: "x" } },
  });
  const nuuvem = makeGame("NuuvemGame", {
    prices: { nuuvem: { price: "R$ 40,00", url: "x" } },
  });
  const noPrice = makeGame("FreeGame");

  it("returns all games when no stores are active", () => {
    expect(filterByStore([steam, nuuvem], new Set())).toHaveLength(2);
  });

  it("keeps only games whose best deal is in the active set", () => {
    expect(names(filterByStore([steam, nuuvem, noPrice], new Set(["steam"])))).toEqual([
      "SteamGame",
    ]);
  });

  it("excludes games with no price when a store filter is active", () => {
    expect(filterByStore([noPrice], new Set(["steam"]))).toHaveLength(0);
  });

  it("supports multiple active stores", () => {
    expect(names(filterByStore([steam, nuuvem, noPrice], new Set(["steam", "nuuvem"])))).toEqual([
      "SteamGame",
      "NuuvemGame",
    ]);
  });
});

describe("filterByFavorite", () => {
  const starred = makeGame("Starred", { isFavorite: true });
  const normal = makeGame("Normal");

  it("returns all games when starredOnly is false", () => {
    expect(filterByFavorite([starred, normal], false)).toHaveLength(2);
  });

  it("returns only starred games when starredOnly is true", () => {
    expect(names(filterByFavorite([starred, normal], true))).toEqual(["Starred"]);
  });

  it("returns an empty list when no games are starred", () => {
    expect(filterByFavorite([normal], true)).toHaveLength(0);
  });
});

describe("filterByQuery", () => {
  const hl2 = makeGame("Half-Life 2", { appid: "220" });
  const portal = makeGame("Portal", { appid: "400" });

  it("returns all games for an empty query", () => {
    expect(filterByQuery([hl2, portal], "")).toHaveLength(2);
  });

  it("returns all games for a whitespace-only query", () => {
    expect(filterByQuery([hl2, portal], "   ")).toHaveLength(2);
  });

  it("matches by name (case-insensitive)", () => {
    expect(names(filterByQuery([hl2, portal], "half"))).toEqual(["Half-Life 2"]);
  });

  it("matches by appid", () => {
    expect(names(filterByQuery([hl2, portal], "400"))).toEqual(["Portal"]);
  });

  it("returns empty list when nothing matches", () => {
    expect(filterByQuery([hl2, portal], "skyrim")).toHaveLength(0);
  });
});
