import { NextRequest, NextResponse } from "next/server";
import { chromium, type Browser } from "playwright";
import type { Edition, StorePrice } from "@/lib/types";

// Reuse a single browser process across requests (avoids ~2s cold-start per call).
let _browser: Browser | null = null;
async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

// ── Steam ────────────────────────────────────────────────────────────────────

const EXCLUDE_KEYWORDS = /\b(upgrade|kit|dlc|pack|content|add.?on|expansion|season pass)\b/i;

const decodeHtml = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&reg;/gi, "®").replace(/&trade;/gi, "™")
   .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—");

async function fetchSteam(appid: string): Promise<StorePrice> {
  const storeUrl = `https://store.steampowered.com/app/${appid}/?cc=BR`;
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=BR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return { price: "N/A", discount: null, url: storeUrl };

    const json = (await res.json()) as Record<string, {
      data?: {
        is_free?: boolean;
        price_overview?: { final_formatted: string; discount_percent: number };
        package_groups?: {
          subs?: {
            packageid: number;
            option_text: string;
            percent_savings: number;
            price_in_cents_with_discount: number;
          }[];
        }[];
      };
    }>;

    const data = json[appid]?.data;
    if (!data) return { price: "N/A", discount: null, url: storeUrl };

    if (data.is_free) return { price: "Free to Play", discount: null, url: storeUrl };

    const overview = data.price_overview;
    const base: StorePrice = overview
      ? {
          price: overview.final_formatted,
          discount: overview.discount_percent > 0 ? `-${overview.discount_percent}%` : null,
          url: storeUrl,
        }
      : { price: "N/A", discount: null, url: storeUrl };

    // Editions from package_groups
    const allPaidSubs = (data.package_groups ?? [])
      .flatMap((g) => g.subs ?? [])
      .filter((s) => s.price_in_cents_with_discount > 0);

    const editionSubs = allPaidSubs.slice(1); // first sub is always the base game
    const editions: Edition[] = editionSubs
      .filter((s) => !EXCLUDE_KEYWORDS.test(s.option_text))
      .map((s) => ({
        name: decodeHtml(
          s.option_text.replace(/\s*-\s*R\$[\s\d,.]+$/, "").replace(/<[^>]+>/g, "").trim()
        ),
        price: "R$ " + (s.price_in_cents_with_discount / 100).toFixed(2).replace(".", ","),
        discount: s.percent_savings > 0 ? `-${s.percent_savings}%` : null,
        url: `https://store.steampowered.com/sub/${s.packageid}/?cc=BR`,
      }));

    return { ...base, editions: editions.length > 0 ? editions : undefined };
  } catch {
    return { price: "N/A", discount: null, url: storeUrl };
  }
}

// ── Nuuvem ───────────────────────────────────────────────────────────────────
// Nuuvem is a JS-rendered SPA — we use a headless browser to get the real DOM.
//
// data-price JSON shape on .mod-price elements:
//   { iv: <int original price in reais>, e: <discounted cents | null>, v: <current cents> }

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
async function fetchNuuvemBySlug(slug: string): Promise<StorePrice | null> {
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

    const NUUVEM_EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;

    return await page.evaluate(
      ({ url, excludePattern }: { url: string; excludePattern: string }) => {
        const EXCLUDE = new RegExp(excludePattern, "i");

        function parseModPrice(el: Element | null): { price: string; discount: string | null } {
          if (!el) return { price: "N/A", discount: null };
          const raw = el.getAttribute("data-price");
          if (!raw) return { price: "N/A", discount: null };
          const p = JSON.parse(raw) as { iv: number; e: number | null; v: number };
          const cents = p.v ?? p.iv * 100;
          const price = "R$ " + (cents / 100).toFixed(2).replace(".", ",");
          let discount: string | null = null;
          if (p.e != null && p.iv > 0) {
            const origCents = p.iv * 100;
            const pct = Math.round(((origCents - p.e) / origCents) * 100);
            if (pct > 0) discount = `-${pct}%`;
          }
          return { price, discount };
        }

        // Main product price: first .mod-price NOT inside a .game-card
        const mainPriceEl =
          document.querySelector(".mod-price:not(.game-card .mod-price)") ??
          document.querySelector(".mod-price");
        const { price, discount } = parseModPrice(mainPriceEl);
        if (price === "N/A") return null;

        // Edition cards listed on the same page
        const editionCards = Array.from(document.querySelectorAll(".game-card")).filter((card) => {
          const title = card.querySelector(".game-card__product-name")?.textContent?.trim() ?? "";
          return !EXCLUDE.test(title);
        });

        const editions = editionCards
          .map((card) => {
            const name = card.querySelector(".game-card__product-name")?.textContent?.trim() ?? "";
            const { price: ePrice, discount: eDiscount } = parseModPrice(card.querySelector(".mod-price"));
            const cardUrl = (card.querySelector("a") as HTMLAnchorElement | null)?.href ?? url;
            return { name, price: ePrice, discount: eDiscount, url: cardUrl };
          })
          .filter((e) => e.price !== "N/A" && e.price !== price);

        return {
          price,
          discount,
          url,
          editions: editions.length > 0 ? editions : undefined,
        } as StorePrice;
      },
      { url: itemUrl, excludePattern: NUUVEM_EXCLUDE.source }
    );
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
        let discount: string | null = null;
        if (priceJson) {
          const currentCents = priceJson.v ?? priceJson.iv * 100;
          price = "R$ " + (currentCents / 100).toFixed(2).replace(".", ",");
          if (priceJson.e != null && priceJson.iv > 0) {
            const originalCents = priceJson.iv * 100;
            const pct = Math.round(((originalCents - priceJson.e) / originalCents) * 100);
            if (pct > 0) discount = `-${pct}%`;
          }
        } else {
          const text = card.querySelector(".product-price--val")?.textContent ?? "";
          const matches = text.match(/R\$\s*[\d.,]+/g);
          price = matches?.at(-1)?.replace(/\s+/g, " ").trim() ?? "N/A";
        }

        return { i, score, title: titleText, price, discount };
      });
    }, name);

    const NUUVEM_EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;

    // Keep cards with a positive match score, sort best first, cap at 4.
    const topCards = scoredCards
      .filter((c) => c.score >= 0.3 && !NUUVEM_EXCLUDE.test(c.title))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);

    if (topCards.length === 0) return { price: "N/A", discount: null, url: searchUrl };

    // Resolve each card's product URL by clicking and going back.
    const resolved: { title: string; price: string; discount: string | null; url: string }[] = [];
    for (const card of topCards) {
      try {
        await page.locator(".game-card").nth(card.i).click();
        await page.waitForURL(/\/item\//, { timeout: 10000 });
        resolved.push({ title: card.title, price: card.price, discount: card.discount, url: page.url() });
        await page.goBack({ waitUntil: "networkidle", timeout: 15000 });
      } catch {
        resolved.push({ title: card.title, price: card.price, discount: card.discount, url: searchUrl });
      }
    }

    const [base, ...rest] = resolved;
    // Drop editions with same price as base (duplicate listings)
    const editions = rest.filter((r) => r.price !== base!.price);
    return {
      price: base!.price,
      discount: base!.discount,
      url: base!.url,
      editions: editions.length > 0
        ? editions.map((r) => ({ name: r.title, price: r.price, discount: r.discount, url: r.url }))
        : undefined,
    };
  } catch {
    return { price: "N/A", discount: null, url: searchUrl };
  } finally {
    await page.close();
  }
}

async function fetchNuuvem(name: string): Promise<StorePrice> {
  const slug = toNuuvemSlug(name);
  const bySlug = await fetchNuuvemBySlug(slug);
  if (bySlug) return bySlug;
  return fetchNuuvemBySearch(name);
}

// ── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { name, appid } = (await req.json()) as { name?: string; appid?: string };
  if (!appid) return NextResponse.json({ error: "Missing game appid" }, { status: 400 });
  if (!name)  return NextResponse.json({ error: "Missing game name" },  { status: 400 });

  const [steam, nuuvem] = await Promise.all([
    fetchSteam(appid),
    fetchNuuvem(name),
  ]);

  return NextResponse.json({ prices: { steam, nuuvem } });
}
