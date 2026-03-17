"use client";

import Image from "next/image";
import { Game, STORES, StoreId } from "@/lib/types";
import { timeAgo, bestDeal, gameKey } from "@/lib/utils";

interface Props {
  game: Game;
  activeStores: Set<string>;
  onRemove: (key: string) => void;
  onRefresh: (key: string) => void;
  refreshing?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function PriceCell({
  price,
  url,
  isBest,
}: {
  price: string;
  url: string | null;
  isBest: boolean;
}) {
  return (
    <span className="flex items-center gap-1 flex-wrap justify-end">
      <span className={`font-medium ${isBest ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
        {price}
      </span>
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-[10px]">
          view ↗
        </a>
      )}
    </span>
  );
}

export default function GameCard({
  game,
  activeStores,
  onRemove,
  onRefresh,
  refreshing,
  dragHandleProps,
}: Props) {
  const key = gameKey(game);
  const best = bestDeal(game.prices);

  const visibleStores = STORES.filter((s) => activeStores.has(s.id));

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col">
      {/* Header image — also the drag handle */}
      <div
        {...dragHandleProps}
        className={`relative h-20 bg-gray-100 dark:bg-gray-800 flex-shrink-0 ${dragHandleProps ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {game.img ? (
          <Image
            src={game.img}
            alt={game.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-2xl">
            🎮
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-tight flex-1 min-w-0">
            {game.name}
          </h3>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => onRefresh(key)}
              disabled={refreshing}
              title="Refresh prices"
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors text-xs"
            >
              {refreshing ? (
                <span className="inline-block animate-spin">↻</span>
              ) : (
                "↻"
              )}
            </button>
            <button
              onClick={() => onRemove(key)}
              title="Remove game"
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Store rows */}
        <div className="flex flex-col gap-1.5">
          {visibleStores.map((store) => {
            const info = game.prices[store.id as StoreId];
            const isBest = best === store.id && info?.price && info.price !== "N/A";

            return (
              <div key={store.id} className="flex flex-col gap-1">
                {/* Base game row */}
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-white font-semibold flex-shrink-0"
                    style={{ background: store.color, fontSize: 9 }}
                  >
                    {store.abbr}
                  </span>
                  <span className="flex-1 text-gray-500 truncate">{store.name}</span>
                  {!info ? (
                    <span className="text-gray-400 italic">checking…</span>
                  ) : !info.price || info.price === "N/A" ? (
                    <span className="text-gray-400">N/A</span>
                  ) : (
                    <PriceCell price={info.price} url={info.url} isBest={!!isBest} />
                  )}
                </div>
                {/* Edition sub-rows */}
                {info?.editions?.map((ed) => {
                  const shortName = ed.name
                    .replace(new RegExp(`^${game.name}\\s*[-–]?\\s*`, "i"), "")
                    .trim() || ed.name;
                  return (
                  <div key={ed.name} className="flex items-center gap-2 text-xs pl-7">
                    <span className="flex-1 text-gray-400 truncate italic">{shortName}</span>
                    {!ed.price || ed.price === "N/A" ? (
                      <span className="text-gray-400">N/A</span>
                    ) : (
                      <PriceCell price={ed.price} url={ed.url} isBest={false} />
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
          <div className="text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1 text-gray-500">
            Best deal:{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {STORES.find((s) => s.id === best)?.name}
            </strong>
          </div>
        )}

        {/* Last updated */}
        {game.lastFetched && (
          <p className="text-[10px] text-gray-400 mt-auto">
            Updated {timeAgo(game.lastFetched)}
          </p>
        )}
      </div>
    </div>
  );
}
