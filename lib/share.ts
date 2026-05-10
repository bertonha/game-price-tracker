import type { Game, StoreId } from "@/lib/types";
import { STORES } from "@/lib/types";

export function parsePrice(priceStr: string | null): number | null {
  if (!priceStr || priceStr === "N/A") return null;
  const num = parseFloat(priceStr.replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isNaN(num) ? null : num;
}

export function findBestPrice(
  game: Game,
): { price: string; url: string; platform: string; id: StoreId } | null {
  let best: { price: string; url: string; platform: string; id: StoreId; parsed: number } | null =
    null;
  for (const store of STORES) {
    const info = game.prices[store.id];
    if (!info?.price || !info?.url) continue;
    const parsed = parsePrice(info.price);
    if (parsed === null) continue;
    if (!best || parsed < best.parsed) {
      best = { price: info.price, url: info.url, platform: store.name, id: store.id, parsed };
    }
  }
  if (!best) return null;
  const { parsed: _parsed, ...result } = best;
  return result;
}

export function buildWhatsAppText(
  gameName: string,
  url: string,
  price: string | null,
  platform: string,
  isBestPrice: boolean,
): string {
  if (isBestPrice && price) {
    return `We found the best price on ${platform} for ${gameName} (${price}), check it out!\n${url}`;
  }
  if (price) {
    return `Checkout ${gameName} for ${price} on ${platform}!\n${url}`;
  }
  return `Check out ${gameName} on ${platform}!\n${url}`;
}
