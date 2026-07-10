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
import { useMemo, useState } from "react";
import CollectionToolbar from "@/components/CollectionToolbar";
import FiltersPanel from "@/components/FiltersPanel";
import GuestBanner from "@/components/GuestBanner";
import PageHeader from "@/components/PageHeader";
import SearchBar from "@/components/SearchBar";
import ShareModal from "@/components/ShareModal";
import SortableGameCard from "@/components/SortableGameCard";
import { useCollection } from "@/hooks/useCollection";
import { filterByFavorite, filterByQuery, filterByStore } from "@/lib/filter";
import { type SortOrder, sortGames } from "@/lib/sort";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Game } from "@/lib/types";
import { gameKey } from "@/lib/utils";

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [starredFirst, setStarredFirst] = useState(() => {
    try {
      return localStorage.getItem("starredFirst") !== "false";
    } catch {
      return true;
    }
  });

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
  } = useCollection(supabase, { starredFirst });

  const [shareGame, setShareGame] = useState<Game | null>(null);
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

  const displayedGames = sortGames(
    filterByQuery(
      filterByFavorite(filterByStore(games, activeStores), showStarredOnly),
      savedGamesQuery,
    ),
    sortOrder,
    !starredFirst,
  );

  const hasActiveFilters =
    activeStores.size > 0 || showStarredOnly || savedGamesQuery.trim().length > 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader isLoggedIn={isLoggedIn} onSignOut={signOut} />

      {!isLoggedIn && <GuestBanner />}

      {/* Search */}
      <div className="mb-3">
        <SearchBar onAdd={addGame} />
      </div>
      <p className="mb-5 text-gray-400 text-xs">
        Accepts game names, Steam URLs (store.steampowered.com/app/…), or AppIDs
      </p>

      <FiltersPanel
        activeStores={activeStores}
        onToggleStore={toggleStore}
        showStarredOnly={showStarredOnly}
        onShowStarredOnlyChange={setShowStarredOnly}
        starredFirst={starredFirst}
        onStarredFirstChange={setStarredFirst}
        savedGamesQuery={savedGamesQuery}
        onSavedGamesQueryChange={setSavedGamesQuery}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
      />

      <CollectionToolbar
        gamesCount={games.length}
        displayedCount={displayedGames.length}
        hasActiveFilters={hasActiveFilters}
        refreshing={refreshingKeys.size > 0}
        onRefreshAll={refreshAll}
        onClearAll={clearAll}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
      />

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
                    onShare={setShareGame}
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

      <ShareModal game={shareGame} isOpen={shareGame !== null} onClose={() => setShareGame(null)} />
    </main>
  );
}
