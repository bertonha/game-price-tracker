"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Game, STORES, StoreId } from "@/lib/types";
import { bestDeal } from "@/lib/utils";

function PriceCell({
  price,
  url,
  isBest,
  storeName,
  gameName,
}: {
  price: string;
  url: string | null;
  isBest: boolean;
  storeName?: string;
  gameName?: string;
}) {
  return (
    <span className="flex items-center gap-1 flex-wrap justify-end">
      <span
        className={`font-medium ${isBest ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {price}
      </span>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline text-xs"
          aria-label={`View ${gameName ?? "game"} on ${storeName ?? "store"}`}
        >
          view ↗
        </a>
      )}
    </span>
  );
}

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

          {/* Store rows */}
          <div className="flex flex-col gap-3">
            {STORES.map((store) => {
              const info = game.prices[store.id as StoreId];
              const isBest =
                best === store.id && info?.price && info.price !== "N/A";

              return (
                <div key={store.id} className="flex flex-col gap-1.5">
                  {/* Base game row */}
                  <div className="flex items-center gap-3 text-sm">
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center text-white font-semibold flex-shrink-0"
                      style={{ background: store.color, fontSize: 10 }}
                      aria-hidden="true"
                    >
                      {store.abbr}
                    </span>
                    <span className="flex-1 text-gray-500">{store.name}</span>
                    {!info ? (
                      <span className="text-gray-400 italic animate-pulse">
                        checking…
                      </span>
                    ) : !info.price || info.price === "N/A" ? (
                      <span className="text-gray-400">N/A</span>
                    ) : (
                      <PriceCell
                        price={info.price}
                        url={info.url}
                        isBest={!!isBest}
                        storeName={store.name}
                        gameName={game.name}
                      />
                    )}
                  </div>
                  {/* Edition sub-rows */}
                  {info?.editions?.map((ed) => {
                    const shortName =
                      ed.name
                        .replace(
                          new RegExp(`^${game.name}\\s*[-–]?\\s*`, "i"),
                          "",
                        )
                        .trim() || ed.name;
                    return (
                      <div
                        key={ed.name}
                        className="flex items-center gap-3 text-sm pl-9"
                      >
                        <span className="flex-1 text-gray-400 truncate italic">
                          {shortName}
                        </span>
                        {!ed.price || ed.price === "N/A" ? (
                          <span className="text-gray-400">N/A</span>
                        ) : (
                          <PriceCell
                            price={ed.price}
                            url={ed.url}
                            isBest={false}
                            storeName={store.name}
                            gameName={`${game.name} ${shortName}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Best deal banner */}
          {best && (
            <div className="text-sm bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 text-gray-500">
              Best deal:{" "}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {STORES.find((s) => s.id === best)?.name}
              </strong>
            </div>
          )}

          {/* Back link */}
          <Link
            href="/"
            className="text-blue-500 hover:underline text-sm mt-2"
          >
            ← Track prices for more games
          </Link>
        </div>
      </div>
    </main>
  );
}
