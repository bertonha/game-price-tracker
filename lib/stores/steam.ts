import type { Edition, StorePrice } from "@/lib/types";
import { stripGamePrefix } from "@/lib/utils";

export type SteamResult = { price: StorePrice; releaseDate?: string; comingSoon: boolean };

const STEAM_COUNTRY = process.env.STEAM_COUNTRY ?? "BR";
const STEAM_LANGUAGE = process.env.STEAM_LANGUAGE ?? "portuguese";

const EXCLUDE_KEYWORDS = /\b(upgrade|kit|dlc|pack|content|add.?on|expansion|season pass)\b/i;

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

export async function fetchSteam(appid: string, name: string): Promise<SteamResult> {
  const storeUrl = `https://store.steampowered.com/app/${appid}/?cc=${STEAM_COUNTRY}`;
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${STEAM_COUNTRY}&l=${STEAM_LANGUAGE}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return { price: { price: "N/A", url: storeUrl }, comingSoon: false };

    const json = (await res.json()) as Record<
      string,
      {
        data?: {
          is_free?: boolean;
          price_overview?: { final_formatted: string };
          package_groups?: {
            subs?: {
              packageid: number;
              option_text: string;
              percent_savings: number;
              price_in_cents_with_discount: number;
            }[];
          }[];
          release_date?: { coming_soon?: boolean; date?: string };
        };
      }
    >;

    const data = json[appid]?.data;
    if (!data) return { price: { price: "N/A", url: storeUrl }, comingSoon: false };

    const releaseDateRaw = data.release_date;
    const comingSoon = releaseDateRaw?.coming_soon ?? false;
    const releaseDate = releaseDateRaw?.date || undefined;

    if (data.is_free)
      return { price: { price: "Free to Play", url: storeUrl }, releaseDate, comingSoon };

    const overview = data.price_overview;
    const base: StorePrice = overview
      ? { price: overview.final_formatted, url: storeUrl }
      : { price: "N/A", url: storeUrl };

    // Editions from package_groups
    const allPaidSubs = (data.package_groups ?? [])
      .flatMap((g) => g.subs ?? [])
      .filter((s) => s.price_in_cents_with_discount > 0);

    const editionSubs = allPaidSubs.slice(1); // first sub is always the base game
    const editions: Edition[] = editionSubs
      .filter((s) => !EXCLUDE_KEYWORDS.test(s.option_text))
      .map((s) => ({
        name: stripGamePrefix(
          decodeHtml(
            s.option_text
              .replace(/<[^>]+>/g, "")
              .replace(/R\$[\s\d,.]+/g, "")
              .replace(/\s*-\s*$/, "")
              .trim(),
          ),
          name,
        ),
        price: `R$ ${(s.price_in_cents_with_discount / 100).toFixed(2).replace(".", ",")}`,
        url: `https://store.steampowered.com/sub/${s.packageid}/?cc=BR`,
      }));

    return {
      price: { ...base, editions: editions.length > 0 ? editions : undefined },
      releaseDate,
      comingSoon,
    };
  } catch {
    return { price: { price: "N/A", url: storeUrl }, comingSoon: false };
  }
}
