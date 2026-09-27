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

type EditionInfo = { name: string; price?: string | null };
type PriceInfo = { price?: string | null; basePrice?: string | null; editions?: EditionInfo[] };

/** Editions that are extras sold alongside the game rather than a way to own
 *  it — they must never be picked as the cheapest way to buy the game. */
const NON_GAME_EDITION =
  /\b(soundtrack|ost|artbook|art ?book|wallpapers?|dlc|add.?on|season pass|expansion|upgrade|pack|bundle ?pack|cosmetics?|skins?)\b/i;

export type BestOffer = {
  store: string;
  price: string;
  /** Set when an edition, not the standard game, is the cheapest way in. */
  edition?: string;
};

/** The cheapest way to buy the game across all stores, counting each store's
 *  full-game editions (a discounted Deluxe can undercut the standard game). */
export function bestOffer(prices: Partial<Record<string, PriceInfo>>): BestOffer | null {
  let best: BestOffer | null = null;
  let bestValue = Number.POSITIVE_INFINITY;
  for (const [store, info] of Object.entries(prices)) {
    if (!info) continue;
    const candidates: { price?: string | null; edition?: string }[] = [
      { price: info.price },
      ...(info.editions ?? [])
        .filter((ed) => !NON_GAME_EDITION.test(ed.name))
        .map((ed) => ({ price: ed.price, edition: ed.name })),
    ];
    for (const c of candidates) {
      const value = parsePrice(c.price);
      if (value === null || !c.price || value >= bestValue) continue;
      bestValue = value;
      best = { store, price: c.price, ...(c.edition ? { edition: c.edition } : {}) };
    }
  }
  return best;
}

export function bestDeal(prices: Partial<Record<string, PriceInfo>>): string | null {
  return bestOffer(prices)?.store ?? null;
}

/** How far below Steam's official list price the best deal sits, as a whole
 *  percentage. Returns null when there is nothing to compare, or when the best
 *  deal is not actually cheaper than the list price. */
export function bestDealSavings(prices: Partial<Record<string, PriceInfo>>): number | null {
  const best = parsePrice(bestOffer(prices)?.price);
  const steam = prices.steam;
  const list = parsePrice(steam?.basePrice) ?? parsePrice(steam?.price);
  if (best === null || list === null || list <= 0) return null;
  const percent = Math.round((1 - best / list) * 100);
  return percent > 0 ? percent : null;
}
