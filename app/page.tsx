"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import Link from "next/link";
import { useMemo, useState } from "react";
import SearchBar from "@/components/SearchBar";
import SortableGameCard from "@/components/SortableGameCard";
import StoreFilter from "@/components/StoreFilter";
import { useCollection } from "@/hooks/useCollection";
import { type SortOrder, sortGames } from "@/lib/sort";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { bestDeal, gameKey } from "@/lib/utils";

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const {
    games,
    persistGames,
    isLoggedIn,
    hydrated,
    status,
    progress,
    refreshingKeys,
    addGame,
    removeGame,
    refreshOne,
    refreshAll,
    toggleFavorite,
    clearAll,
    signOut,
  } = useCollection(supabase);

  const [activeStores, setActiveStores] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<SortOrder>("priority");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [savedGamesQuery, setSavedGamesQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(() => {
    try {
      return localStorage.getItem("filtersOpen") !== "false";
    } catch {
      return false;
    }
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = games.findIndex((g) => gameKey(g) === active.id);
    const newIndex = games.findIndex((g) => gameKey(g) === over.id);
    persistGames(arrayMove(games, oldIndex, newIndex));
  }

  function toggleStore(id: string) {
    setActiveStores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!hydrated) return null;

  const storeFilteredGames =
    activeStores.size === 0
      ? games
      : games.filter((g) => activeStores.has(bestDeal(g.prices) ?? ""));

  const searchFilteredGames = (
    showStarredOnly ? storeFilteredGames.filter((g) => g.isFavorite) : storeFilteredGames
  ).filter((g) => {
    const query = savedGamesQuery.trim().toLowerCase();
    if (!query) return true;
    return g.name.toLowerCase().includes(query) || g.appid.includes(query);
  });

  const displayedGames = sortGames(searchFilteredGames, sortOrder);

  const hasActiveFilters =
    activeStores.size > 0 || showStarredOnly || savedGamesQuery.trim().length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-1 flex items-center justify-between gap-4">
          <h1 className="font-medium text-2xl">Game Price Tracker</h1>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Link
                  href="/profile"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
        <p className="text-gray-500 text-sm">
          Compare prices across Steam BR, Nuuvem &amp; Instant Gaming
        </p>
      </div>

      {/* Guest sync banner */}
      {!isLoggedIn && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-950/30">
          <p className="text-blue-800 text-sm dark:text-blue-300">
            Want your games synced across devices?{" "}
            <Link href="/auth/signup" className="font-medium underline underline-offset-2">
              Sign up for free
            </Link>
          </p>
          <Link
            href="/auth/signup"
            className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-white text-xs transition-colors hover:bg-blue-700"
          >
            Sign up
          </Link>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <SearchBar onAdd={addGame} />
      </div>
      <p className="mb-5 text-gray-400 text-xs">
        Accepts game names, Steam URLs (store.steampowered.com/app/…), or AppIDs
      </p>

      {/* Store filter */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200 bg-linear-to-br from-gray-50 via-white to-gray-100/70 shadow-sm dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900">
        <button
          type="button"
          onClick={() =>
            setFiltersOpen((o) => {
              const next = !o;
              try {
                localStorage.setItem("filtersOpen", String(next));
              } catch {}
              return next;
            })
          }
          className="flex w-full items-center justify-between p-4 text-left"
          aria-expanded={filtersOpen}
        >
          <div>
            <p className="font-semibold text-gray-900 text-sm dark:text-gray-100">
              Refine your collection
            </p>
            <p className="text-gray-500 text-xs dark:text-gray-400">
              Filter by best-deal store, favorites, or search inside your saved games.
            </p>
          </div>
          <svg
            aria-hidden="true"
            className={`ml-3 size-4 shrink-0 text-gray-400 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {filtersOpen && (
          <div className="border-gray-200 border-t p-4 pt-3 dark:border-gray-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-3">
                <StoreFilter activeStores={activeStores} onToggle={toggleStore} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 font-medium text-[11px] text-gray-400 uppercase tracking-[0.24em] dark:text-gray-500">
                    Favorites
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowStarredOnly(false)}
                    aria-pressed={!showStarredOnly}
                    className={`rounded-full border px-3 py-1.5 font-medium text-xs transition-all ${
                      !showStarredOnly
                        ? "border-gray-900 bg-gray-900 text-white shadow-gray-900/15 shadow-sm dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                    }`}
                  >
                    All games
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStarredOnly(true)}
                    aria-pressed={showStarredOnly}
                    className={`rounded-full border px-3 py-1.5 font-medium text-xs transition-all ${
                      showStarredOnly
                        ? "border-gray-900 bg-gray-900 text-white shadow-gray-900/15 shadow-sm dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:bg-gray-800"
                    }`}
                  >
                    Starred only
                  </button>
                </div>
              </div>

              <div className="w-full lg:max-w-md">
                <label
                  htmlFor="saved-games-filter"
                  className="mb-2 block font-medium text-[11px] text-gray-400 uppercase tracking-[0.24em] dark:text-gray-500"
                >
                  Search saved games
                </label>
                <div className="relative">
                  <input
                    id="saved-games-filter"
                    type="text"
                    value={savedGamesQuery}
                    onChange={(e) => setSavedGamesQuery(e.target.value)}
                    placeholder="Find by title or AppID"
                    className="w-full rounded-xl border border-gray-200 bg-white/95 px-4 py-2.5 pr-10 text-gray-900 text-sm shadow-sm outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-100 dark:focus:border-gray-500 dark:focus:ring-gray-800"
                  />
                  {savedGamesQuery && (
                    <button
                      type="button"
                      onClick={() => setSavedGamesQuery("")}
                      className="absolute inset-y-0 right-3 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                      aria-label="Clear saved games search"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => refreshAll()}
          disabled={!games.length || refreshingKeys.size > 0}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Refresh all prices
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={!games.length}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600 text-sm transition-colors hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          Clear list
        </button>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <option value="priority">Sort: Priority</option>
          <option value="cheapest">Sort: Cheapest first</option>
          <option value="expensive">Sort: Most expensive first</option>
          <option value="release-date">Sort: Release date</option>
        </select>
        {games.length > 0 && (
          <span className="ml-auto text-gray-400 text-xs">
            {hasActiveFilters
              ? `${displayedGames.length} of ${games.length} game${games.length !== 1 ? "s" : ""}`
              : `${games.length} game${games.length !== 1 ? "s" : ""} saved`}
          </span>
        )}
      </div>

      {/* Status + progress */}
      {status && <p className="mb-3 text-gray-500 text-sm">{status}</p>}
      {progress !== null && (
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-full rounded-full bg-gray-900 transition-all duration-300 dark:bg-white"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Game grid */}
      {games.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <div className="mb-4 text-4xl">🎮</div>
          <p className="text-sm">No games added yet — search for a game above to get started.</p>
        </div>
      ) : displayedGames.length === 0 ? (
        <div className="rounded-2xl border border-gray-300 border-dashed bg-gray-50/70 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900/40">
          <p className="font-medium text-gray-700 text-sm dark:text-gray-200">
            No saved games match the current filters.
          </p>
          <p className="mt-2 text-gray-500 text-xs dark:text-gray-400">
            Adjust the store chips, favorites filter, or your search term to see more games.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={sortOrder === "priority" ? handleDragEnd : undefined}
        >
          <SortableContext items={games.map(gameKey)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayedGames.map((game, idx) => {
                const key = gameKey(game);
                return (
                  <SortableGameCard
                    key={key}
                    game={game}
                    onRemove={removeGame}
                    onRefresh={refreshOne}
                    isFavorite={game.isFavorite}
                    onToggleFavorite={toggleFavorite}
                    refreshing={refreshingKeys.has(key)}
                    prioritizeImage={idx === 0}
                    disabled={sortOrder !== "priority"}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </main>
  );
}
