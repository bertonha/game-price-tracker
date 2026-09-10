import { describe, expect, it } from "vitest";
import { extractAlgoliaKey } from "@/lib/stores/instant-gaming";

describe("extractAlgoliaKey", () => {
  it("extracts the key from the algoliaConfig block", () => {
    const html = `
      window.algoliaConfig = {
          algolia_appid: 'QKNHP8TC3Y',
          algolia_key: '93946b91c013211f842ddf1819ea880b',
          algolia_index: 'produits_',
      };`;
    expect(extractAlgoliaKey(html)).toBe("93946b91c013211f842ddf1819ea880b");
  });

  it("accepts double quotes", () => {
    expect(extractAlgoliaKey('algolia_key: "4813969db52fc22897f8b84bac1299ad"')).toBe(
      "4813969db52fc22897f8b84bac1299ad",
    );
  });

  it("ignores values that are not 32-char keys", () => {
    expect(extractAlgoliaKey("algolia_key: 'nope'")).toBeNull();
  });

  it("returns null when the page has no key", () => {
    expect(extractAlgoliaKey("<html><body>maintenance</body></html>")).toBeNull();
  });
});
