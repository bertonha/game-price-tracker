import { NextRequest, NextResponse } from "next/server";
import { chromium, type Browser } from "playwright";
import type { StorePrice } from "@/lib/types";

// Reuse a single browser process across requests (avoids ~2s cold-start per call).
// The browser is created lazily on first use.
let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

// ── Steam ────────────────────────────────────────────────────────────────────
// Official Steam store API, no key required.
async function fetchSteam(appid: string): Promise<StorePrice> {
  if (!appid) return { price: "N/A", discount: null, url: null };
  const storeUrl = `https://store.steampowered.com/app/${appid}/?cc=BR`;
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=BR&filters=price_overview`,
      { next: { revalidate: 3600 } }
    );
    const json = (await res.json()) as Record<
      string,
      {
        data?: {
          price_overview?: {
            final_formatted: string;
            discount_percent: number;
          };
        };
      }
    >;
    const overview = json[appid]?.data?.price_overview;
    if (!overview) return { price: "N/A", discount: null, url: storeUrl };
    return {
      price: overview.final_formatted,
      discount: overview.discount_percent > 0 ? `-${overview.discount_percent}%` : null,
      url: storeUrl,
    };
  } catch {
    return { price: "N/A", discount: null, url: storeUrl };
  }
}

// ── Nuuvem ───────────────────────────────────────────────────────────────────
// Nuuvem is a JS-rendered SPA — we use a headless browser to get the real DOM.
// Selectors confirmed by inspecting live search results on nuuvem.com.
//
// data-price JSON shape on .mod-price elements:
//   { iv: <int original price>, e: <discounted cents | null>, v: <current cents> }
async function fetchNuuvem(name: string): Promise<StorePrice> {
  const q = encodeURIComponent(name);
  const searchUrl = `https://www.nuuvem.com/br-pt/catalog/drm/steam/search/${q}`;

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForSelector(".game-card", { timeout: 10000 });

    // Pick the card whose title best matches the game name, then extract price.
    const cardIndex = await page.evaluate((gameName: string) => {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const queryWords = normalize(gameName).split(/\s+/).filter(Boolean);
      const cards = Array.from(document.querySelectorAll(".game-card"));

      let bestIndex = 0;
      let bestScore = -Infinity;
      cards.forEach((card, i) => {
        // Prefer available products
        const available = card.classList.contains("product__available") ? 0.5 : 0;
        // Use the title element only, not full card text
        const titleEl = card.querySelector(".game-card__product-name");
        const title = normalize(titleEl?.textContent ?? "");
        const titleWords = title.split(/\s+/).filter(Boolean);
        const matchCount = queryWords.filter(w => titleWords.includes(w)).length;
        const matchRatio = matchCount / Math.max(queryWords.length, 1);
        const extraWords = Math.max(0, titleWords.length - queryWords.length);
        const score = matchRatio - extraWords * 0.15 + available;
        if (score > bestScore) { bestScore = score; bestIndex = i; }
      });
      return bestIndex;
    }, name);

    const cardData = await page.evaluate((idx: number) => {
      const card = document.querySelectorAll(".game-card")[idx];
      if (!card) return null;

      // data-price: { iv: original price (reais), e: discounted cents | null, v: current cents }
      const raw = card.querySelector(".mod-price")?.getAttribute("data-price");
      const priceJson = raw ? (JSON.parse(raw) as { iv: number; e: number | null; v: number }) : null;

      let price = "N/A";
      let discount: string | null = null;

      if (priceJson) {
        // Use current price (v in cents), fall back to iv * 100
        const currentCents = priceJson.v ?? (priceJson.iv * 100);
        price = "R$ " + (currentCents / 100).toFixed(2).replace(".", ",");

        if (priceJson.e != null && priceJson.iv > 0) {
          const originalCents = priceJson.iv * 100;
          const pct = Math.round(((originalCents - priceJson.e) / originalCents) * 100);
          if (pct > 0) discount = `-${pct}%`;
        }
      } else {
        // Fallback: grab only the last R$ amount from the price element text
        const text = card.querySelector(".product-price--val")?.textContent ?? "";
        const matches = text.match(/R\$\s*[\d.,]+/g);
        price = matches?.at(-1)?.replace(/\s+/g, " ").trim() ?? "N/A";
      }

      return { price, discount };
    }, cardIndex);

    if (!cardData) return { price: "N/A", discount: null, url: searchUrl };

    // Cards have no <a> tags — navigate by clicking to discover the product URL.
    const cards = page.locator(".game-card");
    await cards.nth(cardIndex).click();
    await page.waitForURL(/\/item\//, { timeout: 10000 });
    const productUrl = page.url();

    return { price: cardData.price, discount: cardData.discount, url: productUrl };
  } catch {
    return { price: "N/A", discount: null, url: searchUrl };
  } finally {
    await page.close();
  }
}

// ── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { name, appid } = (await req.json()) as { name?: string; appid?: string };
  if (!name) {
    return NextResponse.json({ error: "Missing game name" }, { status: 400 });
  }

  const [steam, nuuvem] = await Promise.all([
    fetchSteam(appid ?? ""),
    fetchNuuvem(name),
  ]);

  return NextResponse.json({ prices: { steam, nuuvem } });
}
