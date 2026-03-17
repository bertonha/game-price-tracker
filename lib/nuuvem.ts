import type { Edition, StorePrice } from "@/lib/types";
import { stripGamePrefix } from "@/lib/utils";

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

const HEADERS: Record<string, string> = {
  "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
};

/** Parse a data-price JSON attribute: { iv, e, v } → "R$ X,XX" */
function parsePriceCents(json: { iv: number; e: number | null; v: number }): string {
  const cents = json.v ?? json.iv * 100;
  return "R$ " + (cents / 100).toFixed(2).replace(".", ",");
}

/** Extract first data-price value from an HTML snippet. */
function extractPrice(html: string): string | null {
  const m = html.match(/data-price="([^"]+)"/);
  if (!m) return null;
  try {
    const decoded = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    return parsePriceCents(JSON.parse(decoded));
  } catch {
    return null;
  }
}

// ── Slug-based fetch (info API) ──────────────────────────────────────────────

async function fetchNuuvemBySlug(slug: string, name: string): Promise<StorePrice | null> {
  const itemUrl = `https://www.nuuvem.com/br-pt/item/${slug}`;
  const infoUrl = `https://www.nuuvem.com/br-pt/item/info/${slug}`;

  try {
    // Get main price from the lightweight info endpoint
    const infoRes = await fetch(infoUrl, {
      headers: {
        ...HEADERS,
        accept: "application/json, text/javascript, */*; q=0.01",
        "x-requested-with": "XMLHttpRequest",
        referer: itemUrl,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!infoRes.ok) return null;

    const { info } = (await infoRes.json()) as { info: string };
    const price = extractPrice(info);
    if (!price) return null;

    // Fetch the full item page to get edition cards
    let editions: Edition[] | undefined;
    try {
      const pageRes = await fetch(itemUrl, {
        headers: { ...HEADERS, accept: "text/html" },
        signal: AbortSignal.timeout(15_000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        editions = parseEditionCards(html, name, price);
      }
    } catch {
      // Editions are nice-to-have; don't fail the whole lookup
    }

    return { price, url: itemUrl, editions };
  } catch {
    return null;
  }
}

// ── Edition parsing from full page HTML ──────────────────────────────────────

function parseEditionCards(html: string, baseName: string, basePrice: string): Edition[] | undefined {
  const cardRegex = /<div[^>]*class="[^"]*game-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  const editions: Edition[] = [];

  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const card = match[0];
    const nameMatch = card.match(/game-card__product-name[^>]*>([^<]+)</);
    const cardName = nameMatch?.[1]?.trim() ?? "";
    if (!cardName || NUUVEM_EXCLUDE.test(cardName)) continue;

    const priceMatch = card.match(/data-price="([^"]+)"/);
    if (!priceMatch) continue;
    let cardPrice: string;
    try {
      const decoded = priceMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
      cardPrice = parsePriceCents(JSON.parse(decoded));
    } catch {
      continue;
    }
    if (cardPrice === basePrice) continue;

    const url = `https://www.nuuvem.com/br-pt/item/${toNuuvemSlug(cardName)}`;

    editions.push({ name: stripGamePrefix(cardName, baseName), price: cardPrice, url });
  }

  return editions.length > 0 ? editions : undefined;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchNuuvem(name: string): Promise<StorePrice> {
  const slug = toNuuvemSlug(name);
  return (await fetchNuuvemBySlug(slug, name)) ?? { price: "N/A", url: `https://www.nuuvem.com/br-pt/catalog/drm/steam/search/${encodeURIComponent(name)}` };
}
