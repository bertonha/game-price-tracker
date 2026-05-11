"use client";

import { useEffect, useState } from "react";
import { loadGames, saveGames } from "@/lib/storage";
import { useSupabaseBrowserClient } from "@/lib/supabase/browser-auth";
import { loadUserGames, upsertUserGame } from "@/lib/supabase/storage";
import type { GamePrices } from "@/lib/types";
import { bestDeal } from "@/lib/utils";
import BestDealBanner from "./BestDealBanner";
import StorePriceList from "./StorePriceList";

interface Props {
  appid: string;
  name: string;
  img: string;
}

export default function ShareGamePrices({ appid, name, img }: Props) {
  const supabase = useSupabaseBrowserClient();
  const [prices, setPrices] = useState<Partial<GamePrices>>({});
  const [best, setBest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTracked, setIsTracked] = useState(false);
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/fetch-prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appid, name }),
        });
        const data = await res.json();
        if (data.prices) {
          setPrices(data.prices);
          setBest(bestDeal(data.prices));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [appid, name]);

  useEffect(() => {
    const games = loadGames();
    setIsTracked(games.some((g) => g.appid === appid));
  }, [appid]);

  async function addToTracker() {
    setTracking(true);
    try {
      const existing = loadGames();
      if (existing.some((g) => g.appid === appid)) {
        setIsTracked(true);
        return;
      }

      const newGame = {
        appid,
        name,
        img,
        prices: {},
        addedAt: Date.now(),
      };

      if (supabase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const userGames = await loadUserGames(supabase, user.id);
          await upsertUserGame(supabase, user.id, newGame, userGames.length);
          saveGames([...userGames, newGame]);
          setIsTracked(true);
          return;
        }
      }

      saveGames([...existing, newGame]);
      setIsTracked(true);
    } finally {
      setTracking(false);
    }
  }

  if (loading) {
    return <p className="text-gray-400 text-sm">Loading prices…</p>;
  }

  return (
    <>
      <StorePriceList prices={prices} gameName={name} bestStore={best} />
      {best && <BestDealBanner bestStore={best} />}

      {isTracked ? (
        <p className="text-green-600 text-sm dark:text-green-400">✓ Already in your tracker</p>
      ) : (
        <button
          type="button"
          onClick={addToTracker}
          disabled={tracking}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {tracking ? "Adding…" : "Track this game"}
        </button>
      )}
    </>
  );
}
