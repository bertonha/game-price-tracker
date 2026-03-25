"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Game } from "@/lib/types";
import { bestDeal } from "@/lib/utils";
import StorePriceList from "@/components/StorePriceList";
import BestDealBanner from "@/components/BestDealBanner";

export default function SharePage() {
  const { appid } = useParams<{ appid: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appid) return;

    async function load() {
      try {
        // Fetch game details
        const detailsRes = await fetch(`/api/game-details?appid=${appid}`);
        if (!detailsRes.ok) {
          setError("Game not found");
          setLoading(false);
          return;
        }
        const details = await detailsRes.json();

        const g: Game = {
          appid: details.appid,
          name: details.name,
          img: details.img,
          prices: {},
          addedAt: Date.now(),
        };
        setGame(g);
        setLoading(false);

        // Fetch prices in parallel
        const [steamRes, nuuvemRes] = await Promise.allSettled([
          fetch("/api/fetch-prices/steam", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: details.name, appid: details.appid }),
          }).then((r) => r.json()),
          fetch("/api/fetch-prices/nuuvem", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: details.name }),
          }).then((r) => r.json()),
        ]);

        setGame((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            prices: {
              steam:
                steamRes.status === "fulfilled" && steamRes.value.price
                  ? steamRes.value.price
                  : undefined,
              nuuvem:
                nuuvemRes.status === "fulfilled" && nuuvemRes.value.price
                  ? nuuvemRes.value.price
                  : undefined,
            },
            lastFetched: Date.now(),
          };
        });
      } catch {
        setError("Failed to load game information");
        setLoading(false);
      }
    }

    load();
  }, [appid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading game info…</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error ?? "Something went wrong"}</p>
        <Link href="/" className="text-blue-500 hover:underline text-sm">
          ← Back to tracker
        </Link>
      </div>
    );
  }

  const best = bestDeal(game.prices);

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header image */}
        <div className="relative h-52 bg-gray-100 dark:bg-gray-800 rounded-t-xl overflow-hidden">
          {game.img ? (
            <Image
              src={game.img}
              alt={game.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-4xl">
              🎮
            </div>
          )}
        </div>

        {/* Body */}
        <div className="bg-white dark:bg-gray-900 border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-xl p-5 flex flex-col gap-4">
          <h1 className="text-xl font-semibold leading-tight">{game.name}</h1>

          <StorePriceList
            prices={game.prices}
            gameName={game.name}
            bestStore={best}
          />

          {best && <BestDealBanner bestStore={best} />}

          {/* Back link */}
          <Link href="/" className="text-blue-500 hover:underline text-sm mt-2">
            ← Track prices for more games
          </Link>
        </div>
      </div>
    </main>
  );
}
