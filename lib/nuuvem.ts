import { chromium, type Browser } from "playwright";
import type { Edition, StorePrice } from "@/lib/types";
import { stripGamePrefix } from "@/lib/utils";

// Reuse a single browser process across requests (avoids ~2s cold-start per call).
let _browser: Browser | null = null;
export async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

// data-price JSON shape on .mod-price elements:
//   { iv: <int original price in reais>, e: <discounted cents | null>, v: <current cents> }

const NUUVEM_EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;

function toNuuvemSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[:\-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}


// Try to fetch price directly from the Nuuvem item page (faster, gives editions too).
// Returns null if the page doesn't exist or can't be parsed.
async function fetchNuuvemBySlug(slug: string, name: string): Promise<StorePrice | null> {
  const itemUrl = `https://www.nuuvem.com/br-pt/item/${slug}`;
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const response = await page.goto(itemUrl, { waitUntil: "networkidle", timeout: 20000 });
    if (!response || response.status() === 404) return null;
    // Redirected away from an item page means slug didn't match
    if (!page.url().includes("/item/")) return null;

    try {
      await page.waitForSelector(".mod-price", { timeout: 10000 });
    } catch {
      return null;
    }

    const result = await page.evaluate(
      ({ url, excludePattern }: { url: string; excludePattern: string }) => {
        const EXCLUDE = new RegExp(excludePattern, "i");

        function parseModPrice(el: Element | null): { price: string } {
          if (!el) return { price: "N/A" };
          const raw = el.getAttribute("data-price");
          if (!raw) return { price: "N/A" };
          const p = JSON.parse(raw) as { iv: number; e: number | null; v: number };
          const cents = p.v ?? p.iv * 100;
          const price = "R$ " + (cents / 100).toFixed(2).replace(".", ",");
          return { price };
        }

        // Main product price: first .mod-price NOT inside a .game-card
        const mainPriceEl =
          document.querySelector(".mod-price:not(.game-card .mod-price)") ??
          document.querySelector(".mod-price");
        const { price } = parseModPrice(mainPriceEl);
        if (price === "N/A") return null;

        // Edition cards listed on the same page
        const editionCards = Array.from(document.querySelectorAll(".game-card")).filter((card) => {
          const title = card.querySelector(".game-card__product-name")?.textContent?.trim() ?? "";
          return !EXCLUDE.test(title);
        });

        const editions = editionCards
          .map((card) => {
            const name = card.querySelector(".game-card__product-name")?.textContent?.trim() ?? "";
            const { price: ePrice } = parseModPrice(card.querySelector(".mod-price"));
            const cardUrl = (card.querySelector("a") as HTMLAnchorElement | null)?.href ?? url;
            return { name, price: ePrice, url: cardUrl };
          })
          .filter((e) => e.price !== "N/A" && e.price !== price);

        return {
          price,
          url,
          editions: editions.length > 0 ? editions : undefined,
        } as StorePrice;
      },
      { url: itemUrl, excludePattern: NUUVEM_EXCLUDE.source }
    );
    if (result?.editions) {
      result.editions = result.editions.map((e: Edition) => ({ ...e, name: stripGamePrefix(e.name, name) }));
    }
    return result;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

async function fetchNuuvemBySearch(name: string): Promise<StorePrice> {
  // Strip special chars (colons, dashes, etc.) — they break Nuuvem's path-based search
  const cleanName = name.replace(/[:\-–]/g, " ").replace(/\s+/g, " ").trim();
  const q = encodeURIComponent(cleanName);
  const searchUrl = `https://www.nuuvem.com/br-pt/catalog/drm/steam/search/${q}`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForSelector(".game-card", { timeout: 10000 });

    // Score all cards; return index + extracted price data for each.
    const scoredCards = await page.evaluate((gameName: string) => {
      const STOP_WORDS = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "and", "or", "for", "de", "do", "da"]);
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const queryWords = normalize(gameName).split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));

      return Array.from(document.querySelectorAll(".game-card")).map((card, i) => {
        const available = card.classList.contains("product__available") ? 0.5 : 0;
        const titleEl = card.querySelector(".game-card__product-name");
        const titleText = titleEl?.textContent?.trim() ?? "";
        const title = normalize(titleText);
        const titleWords = title.split(/\s+/).filter(Boolean);
        const matchCount = queryWords.filter((w) => titleWords.includes(w)).length;
        const matchRatio = matchCount / Math.max(queryWords.length, 1);
        const extraWords = Math.max(0, titleWords.length - queryWords.length);
        // Available bonus only applies when base match is already decent (>= 0.5)
        const score = matchRatio - extraWords * 0.15 + (matchRatio >= 0.5 ? available : 0);

        const raw = card.querySelector(".mod-price")?.getAttribute("data-price");
        const priceJson = raw
          ? (JSON.parse(raw) as { iv: number; e: number | null; v: number })
          : null;

        let price = "N/A";
        if (priceJson) {
          const currentCents = priceJson.v ?? priceJson.iv * 100;
          price = "R$ " + (currentCents / 100).toFixed(2).replace(".", ",");
        } else {
          const text = card.querySelector(".product-price--val")?.textContent ?? "";
          const matches = text.match(/R\$\s*[\d.,]+/g);
          price = matches?.at(-1)?.replace(/\s+/g, " ").trim() ?? "N/A";
        }

        return { i, score, title: titleText, price };
      });
    }, name);

    // Keep cards with a positive match score, sort best first, cap at 4.
    const topCards = scoredCards
      .filter((c) => c.score >= 0.3 && !NUUVEM_EXCLUDE.test(c.title))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (topCards.length === 0) return { price: "N/A", url: searchUrl };

    // Resolve each card's product URL by clicking and going back.
    const resolved: { title: string; price: string; url: string }[] = [];
    for (const card of topCards) {
      try {
        await page.locator(".game-card").nth(card.i).click();
        await page.waitForURL(/\/item\//, { timeout: 10000 });
        resolved.push({ title: card.title, price: card.price, url: page.url() });
        await page.goBack({ waitUntil: "networkidle", timeout: 15000 });
      } catch {
        resolved.push({ title: card.title, price: card.price, url: searchUrl });
      }
    }

    const [base, ...rest] = resolved;
    // Drop editions with same price as base (duplicate listings)
    const editions = rest.filter((r) => r.price !== base!.price);
    return {
      price: base!.price,
      url: base!.url,
      editions: editions.length > 0
        ? editions.map((r) => ({ name: stripGamePrefix(r.title, base!.title), price: r.price, url: r.url }))
        : undefined,
    };
  } catch {
    return { price: "N/A", url: searchUrl };
  } finally {
    await page.close();
  }
}

export async function fetchNuuvem(name: string): Promise<StorePrice> {
  const slug = toNuuvemSlug(name);
  const bySlug = await fetchNuuvemBySlug(slug, name);
  if (bySlug) return bySlug;
  return fetchNuuvemBySearch(name);
}
