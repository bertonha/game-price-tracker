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

    // Extract price and discount from the first card before navigating away.
    const cardData = await page.evaluate(() => {
      const card = document.querySelector(".game-card");
      if (!card) return null;

      const priceEl = card.querySelector(".product-price--val");
      const price = priceEl?.textContent?.replace(/\s+/g, " ").trim() ?? "N/A";

      // data-price carries both original and event prices as integer cents
      const raw = card.querySelector(".mod-price")?.getAttribute("data-price");
      const priceJson = raw ? (JSON.parse(raw) as { iv: number; e: number | null; v: number }) : null;

      let discount: string | null = null;
      if (priceJson?.e != null && priceJson.iv > 0) {
        const originalCents = priceJson.iv * 100;
        const pct = Math.round(((originalCents - priceJson.e) / originalCents) * 100);
        if (pct > 0) discount = `-${pct}%`;
      }

      return { price, discount };
    });

    if (!cardData) return { price: "N/A", discount: null, url: searchUrl };

    // Cards have no <a> tags — navigate by clicking to discover the product URL.
    await page.click(".game-card");
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
