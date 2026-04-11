import type { Edition, StorePrice } from "@/lib/types";
import { stripGamePrefix } from "@/lib/utils";

const NUUVEM_EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;

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

/** Extract first data-price value from an HTML snippet. */
function extractPrice(html: string): string | null {
  const m = html.match(/data-price="([^"]+)"/);
  return m ? decodePrice(m[1]) : null;
}

/** Extract the asset ID from a Nuuvem banner image src. */
function extractImageId(html: string): string | null {
  const m = html.match(/\/products\/([a-f0-9]+)\/banners\//);
  return m ? m[1] : null;
}

/** Words that signal an older/special edition of a game.
 *  When present in the title but absent from the query, the result is
 *  down-ranked so a newer or more precise match is preferred instead. */
const OLD_EDITION_QUALIFIERS = /\b(goty|classic|legacy|game of the year)\b/i;

/** Score how well a candidate title matches the query name.
 *  Returns 0 if any query word is missing from the title (strict subset check),
 *  otherwise returns Jaccard overlap as a tiebreaker.
 *  Titles that carry old-edition qualifiers not present in the query are
 *  penalised so a more relevant result wins the tie. */
export function matchScore(query: string, title: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[™®©]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
  const qWords = new Set(normalize(query));
  const tWords = new Set(normalize(title));
  for (const w of qWords) if (!tWords.has(w)) return 0;
  let score = qWords.size / new Set([...qWords, ...tWords]).size;
  if (OLD_EDITION_QUALIFIERS.test(title) && !OLD_EDITION_QUALIFIERS.test(query)) {
    score *= 0.8;
  }
  return score;
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

type AutocompleteResult = {
  bestUrl: string;
  imageIdToUrl: Map<string, string>;
};

async function autocomplete(name: string): Promise<AutocompleteResult | null> {
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

    const imageIdToUrl = new Map<string, string>();
    let bestUrl: string | null = null;
    let bestScore = 0;

    for (const p of data.products) {
      const titleMatch = p.html.match(/<h1[^>]*title="([^"]+)"/);
      if (!titleMatch || NUUVEM_EXCLUDE.test(p.html)) continue;

      const imageId = extractImageId(p.html);
      if (imageId) imageIdToUrl.set(imageId, p.url);
      const score = matchScore(name, titleMatch[1]);
      if (score > bestScore) {
        bestScore = score;
        bestUrl = p.url;
      }
    }

    return bestScore > 0 && bestUrl ? { bestUrl, imageIdToUrl } : null;
  } catch {
    return null;
  }
}

// ── Edition parsing from full page HTML ──────────────────────────────────────

function parseEditionCards(
  html: string,
  baseName: string,
  basePrice: string,
  imageIdToUrl: Map<string, string>,
): Edition[] | undefined {
  const cardRegex =
    /<div[^>]*class="[^"]*game-card[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;

  const editions: Edition[] = [];
  for (let match = cardRegex.exec(html); match !== null; match = cardRegex.exec(html)) {
    const card = match[0];
    const nameMatch = card.match(/game-card__product-name[^>]*>([^<]+)</);
    const cardName = nameMatch?.[1]?.trim() ?? "";
    if (!cardName || NUUVEM_EXCLUDE.test(cardName)) continue;

    const priceMatch = card.match(/data-price="([^"]+)"/);
    if (!priceMatch) continue;
    const cardPrice = decodePrice(priceMatch[1]);
    if (!cardPrice || cardPrice === basePrice) continue;

    const imageId = extractImageId(card);
    const cardUrl = imageId ? imageIdToUrl.get(imageId) : undefined;
    if (!cardUrl) continue;

    editions.push({
      name: stripGamePrefix(cardName, baseName),
      price: cardPrice,
      url: cardUrl,
    });
  }

  return editions.length > 0 ? editions : undefined;
}

// ── Fetch by URL ─────────────────────────────────────────────────────────────

async function fetchNuuvemByUrl(
  itemUrl: string,
  name: string,
  imageIdToUrl: Map<string, string>,
): Promise<StorePrice | null> {
  const slug = itemUrl.split("/item/")[1];

  try {
    // Fire both requests in parallel — editions are nice-to-have
    const [infoRes, pageRes] = await Promise.all([
      fetch(`https://www.nuuvem.com/br-pt/item/info/${slug}`, {
        headers: { ...XHR_HEADERS, referer: itemUrl },
        signal: AbortSignal.timeout(15_000),
      }),
      fetch(itemUrl, {
        headers: { ...HEADERS, accept: "text/html" },
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null),
    ]);
    if (!infoRes.ok) return null;

    const { info } = (await infoRes.json()) as { info: string };
    const price = extractPrice(info);
    if (!price) return null;

    let editions: Edition[] | undefined;
    if (pageRes?.ok) {
      editions = parseEditionCards(await pageRes.text(), name, price, imageIdToUrl);
    }

    return { price, url: itemUrl, editions };
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchNuuvem(name: string): Promise<StorePrice> {
  const ac = await autocomplete(name);
  if (ac) {
    const result = await fetchNuuvemByUrl(ac.bestUrl, name, ac.imageIdToUrl);
    if (result) return result;
  }
  return { price: "N/A", url: null };
}
