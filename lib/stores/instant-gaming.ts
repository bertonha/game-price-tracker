import { MIN_MATCH_SCORE, matchScore, STORE_EXCLUDE } from "@/lib/stores/match";
import type { StorePrice } from "@/lib/types";

const rateCache = new Map<string, Promise<number>>();

function getExchangeRate(from: string): Promise<number> {
  let rate = rateCache.get(from);
  if (!rate) {
    rate = fetch(`https://api.frankfurter.app/latest?from=${from}&to=BRL`, {
      signal: AbortSignal.timeout(5_000),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Exchange rate fetch failed: ${res.status}`);
        return res.json() as Promise<{ rates: { BRL: number } }>;
      })
      .then((data) => data.rates.BRL);
    // Don't cache a failure — a single bad response would otherwise wipe out
    // Instant Gaming prices for the rest of the process lifetime.
    rate.catch(() => rateCache.delete(from));
    rateCache.set(from, rate);
  }
  return rate;
}

const ALGOLIA_APP_ID = "QKNHP8TC3Y";
const ALGOLIA_INDEX = "produits_br_spotlighted_desc";

/** Public Algolia search key, as published in Instant Gaming's page HTML.
 *  It is rotated every so often, which makes every lookup 403 — `refreshApiKey`
 *  re-scrapes the current one so a rotation heals itself. */
const DEFAULT_API_KEY = "93946b91c013211f842ddf1819ea880b";
const KEY_SOURCE_URL = "https://www.instant-gaming.com/br/";

let apiKey = DEFAULT_API_KEY;
let pendingKeyRefresh: Promise<void> | null = null;

const BROWSER_HEADERS = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0",
  origin: "https://www.instant-gaming.com",
  referer: "https://www.instant-gaming.com/",
};

function algoliaUrl(key: string): string {
  return (
    `https://qknhp8tc3y-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX}/query?` +
    new URLSearchParams({
      "x-algolia-application-id": ALGOLIA_APP_ID,
      "x-algolia-api-key": key,
    }).toString()
  );
}

/** Pull the current Algolia search key out of an Instant Gaming page. */
export function extractAlgoliaKey(html: string): string | null {
  return html.match(/algolia_key:\s*["']([a-z0-9]{32})["']/i)?.[1] ?? null;
}

/** Re-scrape the Algolia key, de-duplicating concurrent refreshes. */
function refreshApiKey(): Promise<void> {
  pendingKeyRefresh ??= (async () => {
    try {
      const res = await fetch(KEY_SOURCE_URL, {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return;
      const key = extractAlgoliaKey(await res.text());
      if (key) apiKey = key;
    } catch {
      // Keep the current key; the next lookup retries.
    } finally {
      pendingKeyRefresh = null;
    }
  })();
  return pendingKeyRefresh;
}

const FILTERS =
  '(country_whitelist:"BR" OR country_whitelist:"worldwide" OR country_whitelist:"WW") AND (NOT country_blacklist:"BR") AND (type:"Steam")';

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

function formatPrice(price: number): string {
  return `R$ ${price.toFixed(2).replace(".", ",")}`;
}

function search(body: string): Promise<Response> {
  return fetch(algoliaUrl(apiKey), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      ...BROWSER_HEADERS,
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
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
    let res = await search(body);

    // A rotated key rejects every query with 403 — refresh it and retry once.
    if (res.status === 403) {
      await refreshApiKey();
      res = await search(body);
    }

    if (!res.ok) return { price: "N/A", url: null };

    const data: AlgoliaResponse = await res.json();
    if (data.hits.length === 0) return { price: "N/A", url: null };

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
      if (hit.is_dlc === 1 || STORE_EXCLUDE.test(title)) continue;

      // currency_prices values are in retail_currency — convert to BRL
      const priceInRetailCurrency = hit.currency_prices?.BRL;
      if (!priceInRetailCurrency || priceInRetailCurrency <= 0) continue;
      const brlPrice = priceInRetailCurrency * eurToBrl;

      const seoName = hit.seo_name ?? "";
      if (!seoName || !hit.prod_id) continue;
      const url = `https://www.instant-gaming.com/br/${hit.prod_id}-comprar-${seoName}/?currency=BRL`;

      const score = matchScore(name, title);
      if (score <= 0) continue;

      const priceStr = formatPrice(brlPrice);

      if (!hit.edition) {
        if (score >= MIN_MATCH_SCORE && score > bestBaseScore) {
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
