import type { StorePrice } from "@/lib/types";

const rateCache = new Map<string, Promise<number>>();

function getExchangeRate(from: string): Promise<number> {
  if (!rateCache.has(from)) {
    rateCache.set(
      from,
      fetch(`https://api.frankfurter.app/latest?from=${from}&to=BRL`, {
        signal: AbortSignal.timeout(5_000),
      })
        .then((res) => {
          if (!res.ok)
            throw new Error(`Exchange rate fetch failed: ${res.status}`);
          return res.json() as Promise<{ rates: { BRL: number } }>;
        })
        .then((data) => data.rates.BRL),
    );
  }
  return rateCache.get(from)!;
}

const ALGOLIA_URL =
  "https://qknhp8tc3y-dsn.algolia.net/1/indexes/produits_br_spotlighted_desc/query?" +
  new URLSearchParams({
    "x-algolia-application-id": "QKNHP8TC3Y",
    "x-algolia-api-key": "4813969db52fc22897f8b84bac1299ad",
  }).toString();

const FILTERS =
  '(country_whitelist:"BR" OR country_whitelist:"worldwide" OR country_whitelist:"WW") AND (NOT country_blacklist:"BR") AND (type:"Steam")';

const EXCLUDE = /\b(dlc|add.?on|season pass|expansion|upgrade)\b/i;
const OLD_EDITION_QUALIFIERS = /\b(goty|classic|legacy|game of the year)\b/i;

interface AlgoliaHit {
  prod_id?: number;
  en_name?: string;
  seo_name?: string;
  edition?: string;
  retail_currency?: string;
  currency_prices?: Partial<Record<string, number>>;
  is_dlc?: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

function matchScore(query: string, title: string): number {
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
  if (
    OLD_EDITION_QUALIFIERS.test(title) &&
    !OLD_EDITION_QUALIFIERS.test(query)
  ) {
    score *= 0.8;
  }
  return score;
}

function formatPrice(price: number): string {
  return "R$ " + price.toFixed(2).replace(".", ",");
}

export async function fetchInstantGaming(name: string): Promise<StorePrice> {
  const query = name.split(" ").slice(0, 4).join(" ");

  const body = JSON.stringify({
    params:
      `query=${encodeURIComponent(query)}` +
      `&hitsPerPage=60` +
      `&filters=${encodeURIComponent(FILTERS)}` +
      `&page=0`,
  });

  try {
    const res = await fetch(ALGOLIA_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0",
        origin: "https://www.instant-gaming.com",
        referer: "https://www.instant-gaming.com/",
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return { price: "N/A", url: null };

    const data: AlgoliaResponse = await res.json();

    // Determine retail_currency from first hit (consistent across results)
    const retailCurrency = data.hits[0]?.retail_currency ?? "EUR";
    const eurToBrl = await getExchangeRate(retailCurrency);

    // Separate base game from editions — hits with no `edition` field are the base game
    let basePrice: string | null = null;
    let baseUrl: string | null = null;
    let bestBaseScore = 0;
    const editions: {
      name: string;
      price: string | null;
      url: string | null;
    }[] = [];

    for (const hit of data.hits) {
      const title = hit.en_name ?? "";
      if (!title) continue;
      if (hit.is_dlc === 1 || EXCLUDE.test(title)) continue;

      // currency_prices values are in retail_currency — convert to BRL
      const priceInRetailCurrency = hit.currency_prices?.["BRL"];
      if (!priceInRetailCurrency || priceInRetailCurrency <= 0) continue;
      const brlPrice = priceInRetailCurrency * eurToBrl;

      const seoName = hit.seo_name ?? "";
      if (!seoName || !hit.prod_id) continue;
      const url = `https://www.instant-gaming.com/br/${hit.prod_id}-comprar-${seoName}/?currency=BRL`;

      // Match against the base game name only (strip edition suffix for scoring)
      const baseTitle = hit.edition
        ? title.replace(hit.edition, "").trim()
        : title;
      const score = matchScore(name, baseTitle);
      if (score <= 0) continue;

      const priceStr = formatPrice(brlPrice);

      if (!hit.edition) {
        // Base game
        if (score > bestBaseScore) {
          bestBaseScore = score;
          basePrice = priceStr;
          baseUrl = url;
        }
      } else {
        // Alternate edition
        editions.push({ name: hit.edition, price: priceStr, url });
      }
    }

    if (!basePrice || !baseUrl) return { price: "N/A", url: null };
    return {
      price: basePrice,
      url: baseUrl,
      ...(editions.length > 0 ? { editions } : {}),
    };
  } catch {
    return { price: "N/A", url: null };
  }
}
