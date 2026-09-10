import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchNuuvem } from "@/lib/stores/nuuvem";

const NAME = "ACE COMBAT 8: WINGS OF THEVE";
const SLUG = "ace-combat-8-wings-of-theve";
const ITEM = `https://www.nuuvem.com/br-pt/item/${SLUG}`;

const buyBlock = (cents: number) =>
  `<div class="product-buy"><div data-price="{&quot;v&quot;:${cents}}"></div></div>`;

const editionCard = (name: string, slug: string, cents: number) =>
  `<turbo-frame><a title="${name}" href="https://www.nuuvem.com/br-pt/item/${slug}">` +
  `<article class="game-card"><div data-price="{&quot;v&quot;:${cents}}"></div></article></a></turbo-frame>`;

function mockFetch(handler: (url: string) => { status: number; body?: string }) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const { status, body = "" } = handler(url);
    return Promise.resolve(
      new Response(body, { status, headers: { "content-type": "application/json" } }),
    );
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchNuuvem request economy", () => {
  it("stops after two requests when the store refuses a URL autocomplete gave us", async () => {
    const calls = mockFetch((url) => {
      if (url.includes("autocomplete")) {
        return {
          status: 200,
          body: JSON.stringify({
            products: [{ url: ITEM, html: `<h1 title="${NAME}"></h1>` }],
          }),
        };
      }
      return { status: 403 };
    });

    expect(await fetchNuuvem(NAME)).toEqual({ price: "N/A", url: null });
    // autocomplete, info, page — then stop. No editions, no second slug guess.
    expect(calls.filter((c) => !c.includes("autocomplete"))).toEqual([
      `https://www.nuuvem.com/br-pt/item/info/${SLUG}`,
      ITEM,
    ]);
  });

  it("never requests editions for a product it could not price", async () => {
    const calls = mockFetch(() => ({ status: 403 }));
    await fetchNuuvem(NAME);
    expect(calls.some((c) => c.endsWith("/editions"))).toBe(false);
  });

  it("falls back to the slug guess only when autocomplete found nothing", async () => {
    const calls = mockFetch((url) => {
      if (url.includes("autocomplete"))
        return { status: 200, body: JSON.stringify({ products: [] }) };
      if (url.includes("/item/info/"))
        return { status: 200, body: JSON.stringify({ info: buyBlock(27800) }) };
      if (url.endsWith("/editions"))
        return {
          status: 200,
          body: editionCard(`${NAME} Deluxe Edition`, `${SLUG}-deluxe-edition`, 35700),
        };
      return { status: 200, body: "" };
    });

    expect(await fetchNuuvem(NAME)).toEqual({
      price: "R$ 278,00",
      url: ITEM,
      editions: [
        {
          name: "Deluxe Edition",
          price: "R$ 357,00",
          url: `https://www.nuuvem.com/br-pt/item/${SLUG}-deluxe-edition`,
        },
      ],
    });
    expect(calls).toHaveLength(3);
  });

  it("uses the product page when only the info endpoint is refused", async () => {
    mockFetch((url) => {
      if (url.includes("autocomplete"))
        return { status: 200, body: JSON.stringify({ products: [] }) };
      if (url.includes("/item/info/")) return { status: 403 };
      if (url.endsWith("/editions")) return { status: 403 };
      return { status: 200, body: `<html>${buyBlock(27800)}</html>` };
    });

    const result = await fetchNuuvem(NAME);
    expect(result.price).toBe("R$ 278,00");
    expect(result.editions).toBeUndefined();
  });

  it("reports N/A when the page loads but carries no product", async () => {
    mockFetch((url) => {
      if (url.includes("autocomplete"))
        return { status: 200, body: JSON.stringify({ products: [] }) };
      if (url.includes("/item/info/")) return { status: 404 };
      return { status: 200, body: "<html><body>not found</body></html>" };
    });
    expect(await fetchNuuvem(NAME)).toEqual({ price: "N/A", url: null });
  });
});
