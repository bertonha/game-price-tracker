import { describe, expect, it } from "vitest";
import { matchScore } from "@/lib/stores/match";

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
