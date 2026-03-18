export const gameKey = (g: { appid?: string; name: string }): string =>
  g.appid || g.name;

export function stripGamePrefix(
  editionTitle: string,
  baseName: string,
): string {
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
  if (appUrlMatch) return { type: "appid", appid: appUrlMatch[1]! };
  if (/^\d{4,8}$/.test(val)) return { type: "appid", appid: val };
  if (val.length > 1) return { type: "name", name: val };
  return null;
}

export function bestDeal(
  prices: Partial<Record<string, { price?: string | null }>>,
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
