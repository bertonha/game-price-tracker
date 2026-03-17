import type { Edition, StorePrice } from "@/lib/types";
import { stripGamePrefix } from "@/lib/utils";

const EXCLUDE_KEYWORDS = /\b(upgrade|kit|dlc|pack|content|add.?on|expansion|season pass)\b/i;

const decodeHtml = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&reg;/gi, "®").replace(/&trade;/gi, "™")
   .replace(/&ndash;/g, "–").replace(/&mdash;/g, "—");

export async function fetchSteam(appid: string, name: string): Promise<StorePrice> {
  const storeUrl = `https://store.steampowered.com/app/${appid}/?cc=BR`;
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=BR`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return { price: "N/A", url: storeUrl };

    const json = (await res.json()) as Record<string, {
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
      };
    }>;

    const data = json[appid]?.data;
    if (!data) return { price: "N/A", url: storeUrl };

    if (data.is_free) return { price: "Free to Play", url: storeUrl };

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
        name: stripGamePrefix(decodeHtml(
          s.option_text.replace(/\s*-\s*R\$[\s\d,.]+$/, "").replace(/<[^>]+>/g, "").trim()
        ), name),
        price: "R$ " + (s.price_in_cents_with_discount / 100).toFixed(2).replace(".", ","),
        url: `https://store.steampowered.com/sub/${s.packageid}/?cc=BR`,
      }));

    return { ...base, editions: editions.length > 0 ? editions : undefined };
  } catch {
    return { price: "N/A", url: storeUrl };
  }
}
