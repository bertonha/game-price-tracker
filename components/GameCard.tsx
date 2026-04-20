"use client";

import Image from "next/image";
import Link from "next/link";
import { type Game, STORES } from "@/lib/types";
import { bestDeal, gameKey, timeAgo } from "@/lib/utils";
import BestDealBanner from "./BestDealBanner";
import StorePriceList from "./StorePriceList";

interface Props {
  game: Game;
  onRemove: (key: string) => void;
  onRefresh: (key: string) => void;
  refreshing?: boolean;
  prioritizeImage?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export default function GameCard({
  game,
  onRemove,
  onRefresh,
  refreshing,
  prioritizeImage = false,
  dragHandleProps,
}: Props) {
  const key = gameKey(game);
  const best = bestDeal(game.prices);

  const visibleStores = STORES;

  return (
    <article
      aria-label={game.name}
      className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    >
      {/* Header image — also the drag handle */}
      <div
        {...dragHandleProps}
        className={`relative h-36 flex-shrink-0 bg-gray-100 dark:bg-gray-800 ${dragHandleProps ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {game.img ? (
          <Image
            src={game.img}
            alt={game.name}
            fill
            loading={prioritizeImage ? "eager" : "lazy"}
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-gray-400">🎮</div>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 font-medium text-sm leading-tight">
            {game.appid ? (
              <a
                href={`https://store.steampowered.com/app/${game.appid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {game.name}
              </a>
            ) : (
              game.name
            )}
          </h3>
          <div className="flex flex-shrink-0 gap-1">
            {game.appid && (
              <Link
                href={`/share/${game.appid}`}
                target="_blank"
                aria-label={`Share ${game.name}`}
                title="Share"
                className="rounded p-1 text-gray-400 text-xs transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
              >
                <span aria-hidden="true">↗</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => onRefresh(key)}
              disabled={refreshing}
              aria-label={`Refresh prices for ${game.name}`}
              title="Refresh prices"
              className="rounded p-1 text-gray-400 text-xs transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
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
              type="button"
              onClick={() => onRemove(key)}
              aria-label={`Remove ${game.name}`}
              title="Remove game"
              className="rounded p-1 text-gray-400 text-xs transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
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
          <p className="mt-auto text-[10px] text-gray-400">
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
