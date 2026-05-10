"use client";

import { ExternalLink, RefreshCw, Share2, Star, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { type Game, STORES } from "@/lib/types";
import { bestDeal, formatReleaseDate, gameKey, timeAgo } from "@/lib/utils";
import BestDealBanner from "./BestDealBanner";
import ShareModal from "./ShareModal";
import StorePriceList from "./StorePriceList";

interface Props {
  game: Game;
  onRemove: (key: string) => void;
  onRefresh: (key: string) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (appid: string) => void;
  refreshing?: boolean;
  prioritizeImage?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export default function GameCard({
  game,
  onRemove,
  onRefresh,
  isFavorite,
  onToggleFavorite,
  refreshing,
  prioritizeImage = false,
  dragHandleProps,
}: Props) {
  const [showShareModal, setShowShareModal] = useState(false);
  const key = gameKey(game);
  const best = bestDeal(game.prices);
  const releaseDate = game.releaseDate ? new Date(game.releaseDate) : null;

  const visibleStores = STORES;

  return (
    <article
      aria-label={game.name}
      className="flex min-h-115 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
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

      <div className="flex flex-col items-end px-3 pt-3">
        <div className="flex flex-shrink-0 gap-1.5">
          {onToggleFavorite && game.appid && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(game.appid);
              }}
              aria-label={`${isFavorite ? "Unstar" : "Star"} ${game.name}`}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className={`rounded p-1 transition-colors hover:bg-yellow-50 dark:hover:bg-yellow-900/30 ${
                isFavorite
                  ? "text-yellow-500 hover:text-yellow-600"
                  : "text-gray-400 hover:text-yellow-500"
              }`}
            >
              <Star className="size-3.5" fill={isFavorite ? "currentColor" : "none"} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowShareModal(true)}
            aria-label={`Share ${game.name}`}
            title="Share"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30"
          >
            <Share2 className="size-3.5" />
          </button>
          {game.appid && (
            <Link
              href={`/share/${game.appid}`}
              target="_blank"
              aria-label={`View share page for ${game.name}`}
              title="View share page"
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <ExternalLink className="size-3.5" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => onRefresh(key)}
            disabled={refreshing}
            aria-label={`Refresh prices for ${game.name}`}
            title="Refresh prices"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(key)}
            aria-label={`Remove ${game.name}`}
            title="Remove game"
            className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 overflow-auto p-3 pt-0">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm leading-tight">
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
            {(releaseDate || game.comingSoon) && (
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                {game.comingSoon && (
                  <Star className="mr-1 inline size-3 text-yellow-400" fill="currentColor" />
                )}
                {releaseDate ? formatReleaseDate(releaseDate) : "Coming soon"}
              </p>
            )}
          </div>
        </div>

        {<BestDealBanner bestStore={best} />}

        <StorePriceList
          prices={game.prices}
          gameName={game.name}
          bestStore={best}
          stores={visibleStores}
        />

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

      <ShareModal game={game} isOpen={showShareModal} onClose={() => setShowShareModal(false)} />
    </article>
  );
}
