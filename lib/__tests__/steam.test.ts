import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSteam } from "@/lib/stores/steam";
import { decodeHtml } from "@/lib/utils";

function mockAppDetails(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
}

describe("fetchSteam", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the response when Steam keys it by a different id and picks the base package by name", async () => {
    // Real shape returned for Hell is Us (1620730): keyed by "3494350", Deluxe listed first.
    mockAppDetails({
      "3494350": {
        success: true,
        data: {
          name: "Hell is Us",
          is_free: false,
          price_overview: {
            initial_formatted: "R$ 209,99",
            final_formatted: "R$ 83,99",
          },
          package_groups: [
            {
              subs: [
                {
                  packageid: 1237358,
                  option_text:
                    'Hell is Us – Deluxe Edition - <span class="discount_original_price">R$ 209,99</span> R$ 83,99',
                  percent_savings: 0,
                  price_in_cents_with_discount: 8399,
                },
                {
                  packageid: 575230,
                  option_text: "Hell is Us - R$ 179,99",
                  percent_savings: 0,
                  price_in_cents_with_discount: 17999,
                },
              ],
            },
          ],
          release_date: { coming_soon: false, date: "4 Sep, 2025" },
        },
      },
    });

    const { price } = await fetchSteam("1620730", "Hell is Us");

    expect(price.price).toBe("R$ 179,99");
    expect(price.basePrice).toBe("R$ 179,99");
    expect(price.editions).toEqual([
      {
        name: "Deluxe Edition",
        price: "R$ 83,99",
        url: "https://store.steampowered.com/sub/1237358/?cc=BR",
      },
    ]);
  });

  it("uses price_overview when the base game is the first package", async () => {
    mockAppDetails({
      "220": {
        success: true,
        data: {
          name: "Half-Life 2",
          price_overview: { initial_formatted: "R$ 20,00", final_formatted: "R$ 5,00" },
          package_groups: [
            {
              subs: [
                {
                  packageid: 1,
                  option_text: "Half-Life 2 - R$ 5,00",
                  percent_savings: 75,
                  price_in_cents_with_discount: 500,
                },
              ],
            },
          ],
        },
      },
    });

    const { price } = await fetchSteam("220", "Half-Life 2");

    expect(price.price).toBe("R$ 5,00");
    expect(price.basePrice).toBe("R$ 20,00");
    expect(price.editions).toBeUndefined();
  });
});

describe("decodeHtml", () => {
  it("decodes &amp;", () => {
    expect(decodeHtml("Tom &amp; Jerry")).toBe("Tom & Jerry");
  });

  it("decodes &lt; and &gt;", () => {
    expect(decodeHtml("&lt;div&gt;")).toBe("<div>");
  });

  it("decodes &quot;", () => {
    expect(decodeHtml("say &quot;hello&quot;")).toBe('say "hello"');
  });

  it("decodes &#39;", () => {
    expect(decodeHtml("it&#39;s")).toBe("it's");
  });

  it("decodes &reg; and &trade;", () => {
    expect(decodeHtml("Hades&reg; II&trade;")).toBe("Hades® II™");
  });

  it("decodes &ndash; and &mdash;", () => {
    expect(decodeHtml("a&ndash;b&mdash;c")).toBe("a–b—c");
  });

  it("leaves plain text unchanged", () => {
    expect(decodeHtml("Half-Life 2")).toBe("Half-Life 2");
  });
});
