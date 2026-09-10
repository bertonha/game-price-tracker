export const gameKey = (g: { appid?: string; name: string }): string => g.appid || g.name;

/** Decode the handful of HTML entities that show up in store product titles. */
export const decodeHtml = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&reg;/gi, "®")
    .replace(/&trade;/gi, "™")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");

export function stripGamePrefix(editionTitle: string, baseName: string): string {
  const norm = (s: string) =>
    s
      .replace(/[™®©]/g, "")
      .replace(/[:\-–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  const normBase = norm(baseName);
  const normEdition = norm(editionTitle);
  if (!normEdition.startsWith(normBase)) return editionTitle;
  const remaining = normEdition.slice(normBase.length).trim();
  if (!remaining) return editionTitle;
  const remainingWordCount = remaining.split(/\s+/).length;
  const origWords = editionTitle.trim().split(/\s+/);
  return origWords.slice(origWords.length - remainingWordCount).join(" ");
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function parseGameInput(
  val: string,
): { type: "appid"; appid: string } | { type: "name"; name: string } | null {
  val = val.trim();
  const appUrlMatch = val.match(/store\.steampowered\.com\/app\/(\d+)/);
  if (appUrlMatch?.[1]) return { type: "appid", appid: appUrlMatch[1] };
  if (/^\d{4,8}$/.test(val)) return { type: "appid", appid: val };
  if (val.length > 1) return { type: "name", name: val };
  return null;
}

export function parseReleaseDate(dateStr: string): Date | null {
  // Reject vague strings like "2026", "Q3 2026", "TBA" — require a month name
  if (!/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\b/i.test(dateStr)) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatReleaseDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

export function parsePrice(priceStr: string | null | undefined): number | null {
  if (!priceStr || priceStr === "N/A") return null;
  const num = parseFloat(priceStr.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isNaN(num) ? null : num;
}

type PriceInfo = { price?: string | null; basePrice?: string | null };

export function bestDeal(prices: Partial<Record<string, PriceInfo>>): string | null {
  let bestVal: number | null = null;
  let bestStore: string | null = null;
  for (const [store, info] of Object.entries(prices)) {
    const n = parsePrice(info?.price);
    if (n !== null && (bestVal === null || n < bestVal)) {
      bestVal = n;
      bestStore = store;
    }
  }
  return bestStore;
}

/** How far below Steam's official list price the best deal sits, as a whole
 *  percentage. Returns null when there is nothing to compare, or when the best
 *  deal is not actually cheaper than the list price. */
export function bestDealSavings(prices: Partial<Record<string, PriceInfo>>): number | null {
  const store = bestDeal(prices);
  if (!store) return null;
  const best = parsePrice(prices[store]?.price);
  const steam = prices.steam;
  const list = parsePrice(steam?.basePrice) ?? parsePrice(steam?.price);
  if (best === null || list === null || list <= 0) return null;
  const percent = Math.round((1 - best / list) * 100);
  return percent > 0 ? percent : null;
}
