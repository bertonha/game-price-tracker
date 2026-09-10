import { describe, expect, it } from "vitest";
import { MIN_MATCH_SCORE, matchScore } from "@/lib/stores/match";

describe("matchScore", () => {
  it("returns 1 for an identical query and title", () => {
    expect(matchScore("cyberpunk 2077", "cyberpunk 2077")).toBe(1);
  });

  it("returns a positive score when query words are a subset of title words", () => {
    expect(matchScore("cyberpunk", "cyberpunk 2077")).toBeGreaterThan(0);
  });

  it("returns 0 when a query word is missing from the title", () => {
    expect(matchScore("cyberpunk 2077", "cyberpunk")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(matchScore("Cyberpunk 2077", "cyberpunk 2077")).toBeGreaterThan(0);
  });

  it("strips trademark symbols before comparison", () => {
    expect(matchScore("hades", "hades™")).toBeGreaterThan(0);
  });

  it("penalises GOTY/legacy titles when query has no such qualifier", () => {
    const normal = matchScore("witcher 3", "witcher 3");
    const goty = matchScore("witcher 3", "witcher 3 goty");
    expect(goty).toBeLessThan(normal);
  });

  it("does not penalise GOTY title when query also has the qualifier", () => {
    const withQualifier = matchScore("witcher 3 goty", "witcher 3 goty");
    const withoutQualifier = matchScore("witcher 3", "witcher 3 goty");
    expect(withQualifier).toBeGreaterThan(withoutQualifier);
  });
});

describe("matchScore — edition-suffixed titles", () => {
  const NIER = "NieR:Automata™";
  const NIER_YORHA = "NieR:Automata™ Game of the YoRHa Edition";

  it("accepts a store's edition-only listing of the queried game", () => {
    expect(matchScore(NIER, NIER_YORHA)).toBeGreaterThanOrEqual(MIN_MATCH_SCORE);
  });

  it("still ranks the plain base-game listing first", () => {
    expect(matchScore(NIER, NIER_YORHA)).toBeLessThan(matchScore(NIER, NIER));
  });

  it("prefers the least-padded edition when several match", () => {
    expect(matchScore(NIER, "NieR:Automata Deluxe Edition")).toBeGreaterThan(
      matchScore(NIER, NIER_YORHA),
    );
  });

  it.each([
    ["The Witcher 3: Wild Hunt", "The Witcher 3: Wild Hunt - Complete Edition"],
    ["DOOM Eternal", "DOOM Eternal: Deluxe Edition"],
    ["Ghost of Tsushima", "Ghost of Tsushima Director's Cut"],
    ["Dead Space", "Dead Space Remake"],
  ])("accepts %s → %s", (query, title) => {
    expect(matchScore(query, title)).toBeGreaterThanOrEqual(MIN_MATCH_SCORE);
  });

  it.each([
    ["Journey", "Journey to the Savage Planet"],
    ["Journey", "Dwarf Journey"],
    ["Hades", "Hades II"],
    ["Portal", "Portal 2"],
  ])("still rejects %s → %s", (query, title) => {
    expect(matchScore(query, title)).toBeLessThan(MIN_MATCH_SCORE);
  });

  it("does not lift a sequel whose Jaccard score already clears the bar", () => {
    // Pre-existing behaviour: a two-word query against a three-word title
    // scores 2/3, so "Half-Life" matches "Half-Life 2" with or without the
    // edition rule. Pinned here so the edition lift is not blamed for it.
    expect(matchScore("Half-Life", "Half-Life 2")).toBeCloseTo(2 / 3);
  });

  it("does not lift a title that merely contains an edition word mid-phrase", () => {
    expect(matchScore("Portal", "Portal Edition Wars 2")).toBeLessThan(MIN_MATCH_SCORE);
  });

  it("keeps a GOTY-only listing above the threshold despite the penalty", () => {
    expect(matchScore("Fallout 4", "Fallout 4 Game of the Year Edition")).toBeGreaterThanOrEqual(
      MIN_MATCH_SCORE,
    );
  });
});
