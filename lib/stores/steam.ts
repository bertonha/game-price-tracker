import type { Edition, StorePrice } from "@/lib/types";
import { decodeHtml, parseReleaseDate, stripGamePrefix } from "@/lib/utils";

export type SteamResult = { price: StorePrice; releaseDate?: string; comingSoon: boolean };

const STEAM_COUNTRY = process.env.STEAM_COUNTRY ?? "BR";
const STEAM_LANGUAGE = process.env.STEAM_LANGUAGE ?? "english";

const EXCLUDE_KEYWORDS = /\b(upgrade|kit|dlc|pack|content|add.?on|expansion|season pass)\b/i;

type SteamSub = {
  packageid: number;
  option_text: string;
  percent_savings: number;
  price_in_cents_with_discount: number;
};

const formatCents = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

// option_text looks like `Title - <span class="discount_original_price">R$ 209,99</span> R$ 83,99`
const subTitle = (s: SteamSub) =>
  decodeHtml(
    s.option_text
      .replace(/<[^>]+>/g, "")
      .replace(/R\$[\s\d,.]+/g, "")
      .replace(/\s*-\s*$/, "")
      .trim(),
  );

const normTitle = (s: string) =>
  s
    .replace(/[™®©]/g, "")
    .replace(/[:\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

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
          price_overview?: { final_formatted: string; initial_formatted?: string };
          name?: string;
          package_groups?: { subs?: SteamSub[] }[];
          release_date?: { coming_soon?: boolean; date?: string };
        };
      }
    >;

    // Steam sometimes keys the response by a different id than the one requested
    // (e.g. appid 1620730 comes back under "3494350"), so fall back to the only entry.
    const data = (json[appid] ?? Object.values(json)[0])?.data;
    if (!data) return { price: { price: "N/A", url: storeUrl }, comingSoon: false };

    const releaseDateRaw = data.release_date;
    const comingSoon = releaseDateRaw?.coming_soon ?? false;
    const releaseDate = releaseDateRaw?.date
      ? (parseReleaseDate(releaseDateRaw.date)?.toISOString() ?? undefined)
      : undefined;

    if (data.is_free)
      return { price: { price: "Free to Play", url: storeUrl }, releaseDate, comingSoon };

    const allPaidSubs = (data.package_groups ?? [])
      .flatMap((g) => g.subs ?? [])
      .filter((s) => s.price_in_cents_with_discount > 0);

    // The base game is usually the first package, but some stores list an edition
    // first (and `price_overview` then reflects that edition), so prefer the
    // package whose title is exactly the game name.
    const baseNames = new Set([name, data.name].filter((n): n is string => !!n).map(normTitle));
    const matchedIdx = allPaidSubs.findIndex((s) => baseNames.has(normTitle(subTitle(s))));
    const baseIdx = matchedIdx === -1 ? 0 : matchedIdx;

    const overview = data.price_overview;
    let base: StorePrice;
    if (baseIdx > 0) {
      const sub = allPaidSubs[baseIdx];
      const price = formatCents(sub.price_in_cents_with_discount);
      const original = sub.option_text.match(
        /class="discount_original_price">\s*(R\$\s*[\d.,]+)\s*</,
      )?.[1];
      base = { price, basePrice: original ?? price, url: storeUrl };
    } else if (overview) {
      // `initial_formatted` is only populated while the game is discounted;
      // otherwise the list price is the price being charged.
      base = {
        price: overview.final_formatted,
        basePrice: overview.initial_formatted || overview.final_formatted,
        url: storeUrl,
      };
    } else {
      base = { price: "N/A", url: storeUrl };
    }

    const editions: Edition[] = allPaidSubs
      .filter((_, i) => i !== baseIdx)
      .filter((s) => !EXCLUDE_KEYWORDS.test(s.option_text))
      .map((s) => ({
        name: stripGamePrefix(subTitle(s), name),
        price: formatCents(s.price_in_cents_with_discount),
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
