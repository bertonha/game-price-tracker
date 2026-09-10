import { MIN_MATCH_SCORE, matchScore, STORE_EXCLUDE } from "@/lib/stores/match";
import type { Edition, StorePrice } from "@/lib/types";
import { decodeHtml, stripGamePrefix } from "@/lib/utils";

/** Convert a game name to a Nuuvem URL slug. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

const HEADERS: Record<string, string> = {
  "accept-language": "en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
};

const XHR_HEADERS: Record<string, string> = {
  ...HEADERS,
  accept: "application/json, text/javascript, */*; q=0.01",
  "x-requested-with": "XMLHttpRequest",
};

/** Decode an HTML-encoded data-price attribute and format as "R$ X,XX". */
export function decodePrice(encoded: string): string | null {
  try {
    const json = JSON.parse(encoded.replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
    const cents: number = json.v ?? json.iv * 100;
    return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
  } catch {
    return null;
  }
}

/** Nuuvem sells the same game on several storefronts and lists them side by
 *  side under near-identical names — "METAL GEAR SOLID Δ: SNAKE EATER Digital
 *  Deluxe Edition" exists for both Steam and Xbox, and only the DRM badge
 *  tells them apart. A card declaring no DRM at all is kept, so a markup
 *  change degrades to the previous behaviour rather than emptying the list. */
function isSteamCard(cardHtml: string): boolean {
  const drm = cardHtml.match(/drm-activation--[a-z]+/g);
  return !drm || drm.includes("drm-activation--steam");
}

/** Extract the base game's price from a `product-buy` block — the markup the
 *  `/item/info/` endpoint returns on its own and the product page embeds.
 *  Scoping to that block keeps a DLC or edition card further down the product
 *  page from being read as the base price. */
export function extractPrice(html: string): string | null {
  const start = html.indexOf('"product-buy"');
  const scoped = start === -1 ? html : html.slice(start);
  const m = scoped.match(/data-price="([^"]+)"/);
  return m ? decodePrice(m[1]) : null;
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

async function autocomplete(name: string): Promise<string | null> {
  const query = name.split(" ").slice(0, 4).join(" ");
  const url = `https://www.nuuvem.com/br-pt/products_searches/autocomplete?query=${encodeURIComponent(query)}&platform=pc`;
  try {
    const res = await fetch(url, {
      headers: { ...XHR_HEADERS, accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      products?: { url: string; html: string }[];
    };
    if (!data.products?.length) return null;

    let bestUrl: string | null = null;
    let bestScore = 0;

    for (const p of data.products) {
      const titleMatch = p.html.match(/<h1[^>]*title="([^"]+)"/);
      if (!titleMatch || STORE_EXCLUDE.test(p.html)) continue;
      if (!isSteamCard(p.html)) continue;

      const score = matchScore(name, titleMatch[1]);
      if (score > bestScore) {
        bestScore = score;
        bestUrl = p.url;
      }
    }

    return bestScore >= MIN_MATCH_SCORE ? bestUrl : null;
  } catch {
    return null;
  }
}

// ── Edition parsing ──────────────────────────────────────────────────────────

/** Editions are not part of the product page HTML. The page ships an empty
 *  `<turbo-frame loading="lazy" src="/br-pt/item/<slug>/editions">` that the
 *  browser fills in afterwards, so they have to be fetched from that URL. */
function editionsUrl(itemUrl: string): string {
  return `${itemUrl.replace(/\/+$/, "")}/editions`;
}

/** Parse the edition cards served by the `/editions` Turbo Frame. Each card is
 *  an anchor carrying the product title and href, wrapping a price element. */
export function parseEditionCards(html: string, baseName: string): Edition[] | undefined {
  const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;

  const editions: Edition[] = [];
  const seen = new Set<string>();
  for (let match = anchorRegex.exec(html); match !== null; match = anchorRegex.exec(html)) {
    const [, attrs, body] = match;

    const url = attrs.match(/href="([^"]+)"/)?.[1];
    if (!url?.includes("/item/") || seen.has(url)) continue;
    if (!isSteamCard(body)) continue;

    // The anchor's title attribute is the cleanest source; the card heading is
    // a fallback in case the markup drops it.
    const rawName =
      attrs.match(/title="([^"]+)"/)?.[1] ??
      body.match(/game-card__product-name[^>]*>([^<]*)</)?.[1];
    const cardName = decodeHtml(rawName ?? "").trim();
    if (!cardName || STORE_EXCLUDE.test(cardName)) continue;

    const priceMatch = body.match(/data-price="([^"]+)"/);
    if (!priceMatch) continue;
    const cardPrice = decodePrice(priceMatch[1]);
    if (!cardPrice) continue;

    seen.add(url);
    editions.push({
      name: stripGamePrefix(cardName, baseName),
      price: cardPrice,
      url,
    });
  }

  return editions.length > 0 ? editions : undefined;
}

// ── Fetch by URL ─────────────────────────────────────────────────────────────

/** Outcome of a single product lookup.
 *  `blocked` is kept distinct from `missing` because Nuuvem's bot protection
 *  rate-limits by IP: once it starts refusing us, every further request digs
 *  the hole deeper, so the caller must stop rather than try another URL. */
type Lookup = { kind: "ok"; price: StorePrice } | { kind: "missing" } | { kind: "blocked" };

async function fetchNuuvemByUrl(itemUrl: string, name: string): Promise<Lookup> {
  const slug = itemUrl.split("/item/")[1];

  try {
    const infoRes = await fetch(`https://www.nuuvem.com/br-pt/item/info/${slug}`, {
      headers: { ...XHR_HEADERS, referer: itemUrl },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);

    let price = infoRes?.ok
      ? extractPrice(((await infoRes.json()) as { info: string }).info)
      : null;

    // Bot protection sometimes rejects the XHR endpoint while still serving the
    // product page, which embeds the same product-buy block. The page is a much
    // larger response, so only reach for it when the cheap endpoint failed.
    if (!price) {
      const pageRes = await fetch(itemUrl, {
        headers: { ...HEADERS, accept: "text/html" },
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      if (!pageRes?.ok) return { kind: "blocked" };
      price = extractPrice(await pageRes.text());
    }
    if (!price) return { kind: "missing" };

    // Only now that the product is known to exist is an editions request worth
    // spending — it is nice-to-have, and never worth burning on a bad guess.
    const editionsRes = await fetch(editionsUrl(itemUrl), {
      headers: { ...HEADERS, accept: "text/html", referer: itemUrl },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    const editions = editionsRes?.ok
      ? parseEditionCards(await editionsRes.text(), name)
      : undefined;

    return { kind: "ok", price: { price, url: itemUrl, editions } };
  } catch {
    return { kind: "blocked" };
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

const NOT_FOUND: StorePrice = { price: "N/A", url: null };

export async function fetchNuuvem(name: string): Promise<StorePrice> {
  const bestUrl = await autocomplete(name);
  if (bestUrl) {
    const found = await fetchNuuvemByUrl(bestUrl, name);
    if (found.kind === "ok") return found.price;
    // Autocomplete handed us a URL that should exist. If Nuuvem refused it,
    // guessing a second URL will be refused too — stop asking.
    if (found.kind === "blocked") return NOT_FOUND;
  }

  // Fallback: try a direct slug-based URL when autocomplete finds no good match.
  const directUrl = `https://www.nuuvem.com/br-pt/item/${toSlug(name)}`;
  const direct = await fetchNuuvemByUrl(directUrl, name);
  return direct.kind === "ok" ? direct.price : NOT_FOUND;
}
