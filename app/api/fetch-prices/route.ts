import { createClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { fetchInstantGaming } from "@/lib/stores/instant-gaming";
import { fetchNuuvem } from "@/lib/stores/nuuvem";
import { fetchSteam } from "@/lib/stores/steam";
import type { GamePrices } from "@/lib/types";

const ONE_HOUR = 60 * 60 * 1000;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const { appid, name, force } = (await req.json()) as {
    appid?: string;
    name?: string;
    force?: boolean;
  };

  if (!appid) return NextResponse.json({ error: "Missing appid" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const supabase = getAdminClient();

  if (!force && supabase) {
    const { data } = await supabase
      .from("games")
      .select("prices, last_fetched, release_date, coming_soon")
      .eq("appid", appid)
      .single();

    if (data?.last_fetched && Date.now() - data.last_fetched < ONE_HOUR) {
      return NextResponse.json({
        prices: data.prices,
        lastFetched: data.last_fetched,
        releaseDate: data.release_date ?? undefined,
        comingSoon: data.coming_soon ?? false,
      });
    }
  }

  const [steamResult, nuuvem, instantGaming] = await Promise.all([
    fetchSteam(appid, name).catch(() => null),
    fetchNuuvem(name).catch(() => null),
    fetchInstantGaming(name).catch(() => null),
  ]);

  const prices: Partial<GamePrices> = {};
  if (steamResult !== null) prices.steam = steamResult.price;
  if (nuuvem !== null) prices.nuuvem = nuuvem;
  if (instantGaming !== null) prices["instant-gaming"] = instantGaming;

  const releaseDate = steamResult?.releaseDate;
  const comingSoon = steamResult?.comingSoon ?? false;
  const lastFetched = Date.now();

  if (supabase) {
    supabase
      .from("games")
      .update({
        prices,
        last_fetched: lastFetched,
        release_date: releaseDate ?? null,
        coming_soon: comingSoon,
        updated_at: new Date().toISOString(),
      })
      .eq("appid", appid)
      .then(() => {});
  }

  return NextResponse.json({ prices, lastFetched, releaseDate, comingSoon });
}
