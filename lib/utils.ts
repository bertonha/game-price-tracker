export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function parseGameInput(val: string):
  | { type: "appid"; appid: string }
  | { type: "name"; name: string }
  | null {
  val = val.trim();
  const appUrlMatch = val.match(/store\.steampowered\.com\/app\/(\d+)/);
  if (appUrlMatch) return { type: "appid", appid: appUrlMatch[1]! };
  if (/^\d{4,8}$/.test(val)) return { type: "appid", appid: val };
  if (val.length > 1) return { type: "name", name: val };
  return null;
}

export function bestDeal(
  prices: Record<string, { price?: string | null }>
): string | null {
  let bestVal: number | null = null;
  let bestStore: string | null = null;
  for (const [store, info] of Object.entries(prices)) {
    if (!info?.price || info.price === "N/A") continue;
    const n = parseFloat(info.price.replace(/[^0-9.,]/g, "").replace(",", "."));
    if (!isNaN(n) && (bestVal === null || n < bestVal)) {
      bestVal = n;
      bestStore = store;
    }
  }
  return bestStore;
}
