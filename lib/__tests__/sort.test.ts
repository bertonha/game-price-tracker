import { describe, expect, it } from "vitest";
import {
  prioritizeStarred,
  sortByPriceWithinStarGroups,
  sortByReleaseDateWithinStarGroups,
  sortGames,
} from "@/lib/sort";
import type { Game } from "@/lib/types";

function makeGame(name: string, overrides: Partial<Game> = {}): Game {
  return { appid: name, name, img: "", prices: {}, addedAt: 0, ...overrides };
}

function names(list: Game[]) {
  return list.map((g) => g.name);
}

describe("prioritizeStarred", () => {
  it("moves starred games to the front", () => {
    const list = [
      makeGame("A"),
      makeGame("B", { isFavorite: true }),
      makeGame("C"),
      makeGame("D", { isFavorite: true }),
    ];
    expect(names(prioritizeStarred(list))).toEqual(["B", "D", "A", "C"]);
  });

  it("preserves order within each group", () => {
    const list = [makeGame("X"), makeGame("Y", { isFavorite: true }), makeGame("Z")];
    expect(names(prioritizeStarred(list))).toEqual(["Y", "X", "Z"]);
  });

  it("returns the list unchanged when nothing is starred", () => {
    const list = [makeGame("A"), makeGame("B")];
    expect(names(prioritizeStarred(list))).toEqual(["A", "B"]);
  });

  it("returns the list unchanged when everything is starred", () => {
    const list = [makeGame("A", { isFavorite: true }), makeGame("B", { isFavorite: true })];
    expect(names(prioritizeStarred(list))).toEqual(["A", "B"]);
  });
});

describe("sortByPriceWithinStarGroups", () => {
  const cheap = makeGame("Cheap", { prices: { steam: { price: "R$ 10,00", url: "x" } } });
  const mid = makeGame("Mid", { prices: { steam: { price: "R$ 50,00", url: "x" } } });
  const expensive = makeGame("Expensive", { prices: { steam: { price: "R$ 200,00", url: "x" } } });
  const noPrice = makeGame("NoPrice");

  it("sorts cheapest first (asc)", () => {
    expect(names(sortByPriceWithinStarGroups([expensive, cheap, mid], "asc"))).toEqual([
      "Cheap",
      "Mid",
      "Expensive",
    ]);
  });

  it("sorts most expensive first (desc)", () => {
    expect(names(sortByPriceWithinStarGroups([cheap, expensive, mid], "desc"))).toEqual([
      "Expensive",
      "Mid",
      "Cheap",
    ]);
  });

  it("pushes games with no price to the end", () => {
    expect(names(sortByPriceWithinStarGroups([noPrice, cheap, mid], "asc"))).toEqual([
      "Cheap",
      "Mid",
      "NoPrice",
    ]);
  });

  it("keeps starred games ahead of non-starred even if cheaper", () => {
    const starredExpensive = makeGame("StarExpensive", {
      isFavorite: true,
      prices: { steam: { price: "R$ 200,00", url: "x" } },
    });
    const cheapNonStarred = makeGame("CheapNormal", {
      prices: { steam: { price: "R$ 10,00", url: "x" } },
    });
    const result = names(sortByPriceWithinStarGroups([cheapNonStarred, starredExpensive], "asc"));
    expect(result).toEqual(["StarExpensive", "CheapNormal"]);
  });
});

describe("sortByReleaseDateWithinStarGroups", () => {
  const early = makeGame("Early", { releaseDate: "2020-01-01" });
  const late = makeGame("Late", { releaseDate: "2024-06-15" });
  const noDate = makeGame("NoDate");

  it("sorts oldest first (asc)", () => {
    expect(names(sortByReleaseDateWithinStarGroups([late, noDate, early], "asc"))).toEqual([
      "Early",
      "Late",
      "NoDate",
    ]);
  });

  it("sorts newest first (desc)", () => {
    expect(names(sortByReleaseDateWithinStarGroups([early, noDate, late], "desc"))).toEqual([
      "Late",
      "Early",
      "NoDate",
    ]);
  });

  it("pushes games with no release date to the end in both directions", () => {
    expect(names(sortByReleaseDateWithinStarGroups([noDate, early], "asc"))).toEqual([
      "Early",
      "NoDate",
    ]);
    expect(names(sortByReleaseDateWithinStarGroups([noDate, early], "desc"))).toEqual([
      "Early",
      "NoDate",
    ]);
  });

  it("keeps starred games ahead of non-starred", () => {
    const starredLate = makeGame("StarLate", {
      isFavorite: true,
      releaseDate: "2024-01-01",
    });
    const earlyNormal = makeGame("EarlyNormal", { releaseDate: "2015-01-01" });
    expect(names(sortByReleaseDateWithinStarGroups([earlyNormal, starredLate], "asc"))).toEqual([
      "StarLate",
      "EarlyNormal",
    ]);
  });
});

describe("sortGames", () => {
  const a = makeGame("A", { prices: { steam: { price: "R$ 30,00", url: "x" } } });
  const b = makeGame("B", {
    isFavorite: true,
    prices: { steam: { price: "R$ 10,00", url: "x" } },
  });
  const c = makeGame("C", { prices: { steam: { price: "R$ 50,00", url: "x" } } });

  it("priority keeps starred first without sorting by price", () => {
    expect(names(sortGames([a, b, c], "priority"))).toEqual(["B", "A", "C"]);
  });

  it("cheapest sorts by ascending price within star groups", () => {
    expect(names(sortGames([c, a, b], "cheapest"))).toEqual(["B", "A", "C"]);
  });

  it("expensive sorts by descending price within star groups", () => {
    expect(names(sortGames([a, b, c], "expensive"))).toEqual(["B", "C", "A"]);
  });

  describe("with ignoreStarred", () => {
    it("priority keeps the original order", () => {
      expect(names(sortGames([a, b, c], "priority", true))).toEqual(["A", "B", "C"]);
    });

    it("cheapest sorts by price across all games", () => {
      expect(names(sortGames([c, a, b], "cheapest", true))).toEqual(["B", "A", "C"]);
    });

    it("expensive sorts by price across all games", () => {
      expect(names(sortGames([a, b, c], "expensive", true))).toEqual(["C", "A", "B"]);
    });

    it("release-oldest sorts by date across all games", () => {
      const starredLate = makeGame("StarLate", { isFavorite: true, releaseDate: "2024-01-01" });
      const earlyNormal = makeGame("EarlyNormal", { releaseDate: "2015-01-01" });
      expect(names(sortGames([starredLate, earlyNormal], "release-oldest", true))).toEqual([
        "EarlyNormal",
        "StarLate",
      ]);
    });

    it("release-newest sorts by descending date across all games", () => {
      const starredEarly = makeGame("StarEarly", { isFavorite: true, releaseDate: "2015-01-01" });
      const lateNormal = makeGame("LateNormal", { releaseDate: "2024-01-01" });
      expect(names(sortGames([starredEarly, lateNormal], "release-newest", true))).toEqual([
        "LateNormal",
        "StarEarly",
      ]);
    });
  });
});
