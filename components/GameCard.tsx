"use client";

import Image from "next/image";
import Link from "next/link";
import { Game, STORES } from "@/lib/types";
import { timeAgo, bestDeal, gameKey } from "@/lib/utils";
import StorePriceList from "./StorePriceList";
import BestDealBanner from "./BestDealBanner";

interface Props {
  game: Game;
  activeStores: Set<string>;
  onRemove: (key: string) => void;
  onRefresh: (key: string) => void;
  refreshing?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
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
    <article
      aria-label={game.name}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden flex flex-col"
    >
      {/* Header image — also the drag handle */}
      <div
        {...dragHandleProps}
        className={`relative h-36 bg-gray-100 dark:bg-gray-800 flex-shrink-0 ${dragHandleProps ? "cursor-grab active:cursor-grabbing" : ""}`}
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
            {game.appid && (
              <Link
                href={`/share/${game.appid}`}
                target="_blank"
                aria-label={`Share ${game.name}`}
                title="Share"
                className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-xs"
              >
                <span aria-hidden="true">↗</span>
              </Link>
            )}
            <button
              onClick={() => onRefresh(key)}
              disabled={refreshing}
              aria-label={`Refresh prices for ${game.name}`}
              title="Refresh prices"
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors text-xs"
            >
              {refreshing ? (
                <span className="inline-block animate-spin" aria-hidden="true">
                  ↻
                </span>
              ) : (
                <span aria-hidden="true">↻</span>
              )}
            </button>
            <button
              onClick={() => onRemove(key)}
              aria-label={`Remove ${game.name}`}
              title="Remove game"
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        </div>

        <StorePriceList
          prices={game.prices}
          gameName={game.name}
          bestStore={best}
          stores={visibleStores}
        />

        {best && <BestDealBanner bestStore={best} />}

        {/* Last updated */}
        {game.lastFetched && (
          <p className="text-[10px] text-gray-400 mt-auto">
            Updated{" "}
            <time dateTime={new Date(game.lastFetched).toISOString()}>
              {timeAgo(game.lastFetched)}
            </time>
          </p>
        )}
      </div>
    </article>
  );
}
