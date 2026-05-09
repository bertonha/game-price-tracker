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
      .select("prices, last_fetched")
      .eq("appid", appid)
      .single();

    if (data?.last_fetched && Date.now() - data.last_fetched < ONE_HOUR) {
      return NextResponse.json({ prices: data.prices, lastFetched: data.last_fetched });
    }
  }

  const [steam, nuuvem, instantGaming] = await Promise.all([
    fetchSteam(appid, name).catch(() => null),
    fetchNuuvem(name).catch(() => null),
    fetchInstantGaming(name).catch(() => null),
  ]);

  const prices: Partial<GamePrices> = {};
  if (steam !== null) prices.steam = steam;
  if (nuuvem !== null) prices.nuuvem = nuuvem;
  if (instantGaming !== null) prices["instant-gaming"] = instantGaming;

  const lastFetched = Date.now();

  if (supabase) {
    supabase
      .from("games")
      .update({ prices, last_fetched: lastFetched, updated_at: new Date().toISOString() })
      .eq("appid", appid)
      .then(() => {});
  }

  return NextResponse.json({ prices, lastFetched });
}
