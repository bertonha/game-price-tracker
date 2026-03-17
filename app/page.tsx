"use client";

import { useState, useEffect, useCallback } from "react";
import { Game, GamePrices, StorePrice, SteamSuggestion, STORES } from "@/lib/types";
import { loadGames, saveGames } from "@/lib/storage";
import SearchBar from "@/components/SearchBar";
import StoreFilter from "@/components/StoreFilter";
import GameCard from "@/components/GameCard";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableGameCard(props: React.ComponentProps<typeof GameCard>) {
  const key = props.game.appid || props.game.name;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-50 z-10" : ""}
    >
      <GameCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export default function HomePage() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [games, setGames] = useState<Game[]>([]);
  const [activeStores, setActiveStores] = useState<Set<string>>(
    new Set(STORES.map((s) => s.id))
  );
  const [refreshingKeys, setRefreshingKeys] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setGames(loadGames());
    setHydrated(true);
  }, []);

  const persistGames = useCallback((updated: Game[]) => {
    setGames(updated);
    saveGames(updated);
  }, []);

  function fetchPrices(game: Game, matchFn: (g: Game) => boolean): Promise<void> {
    const update = (storeId: keyof GamePrices, price: StorePrice) =>
      setGames((prev) => {
        const next = prev.map((g) =>
          matchFn(g) ? { ...g, prices: { ...g.prices, [storeId]: price }, lastFetched: Date.now() } : g
        );
        saveGames(next);
        return next;
      });

    const steam = fetch("/api/fetch-prices/steam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: game.name, appid: game.appid }),
    }).then((r) => r.json()).then((d) => { if (d.price) update("steam", d.price); }).catch(() => {});

    const nuuvem = fetch("/api/fetch-prices/nuuvem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: game.name }),
    }).then((r) => r.json()).then((d) => { if (d.price) update("nuuvem", d.price); }).catch(() => {});

    return Promise.all([steam, nuuvem]).then(() => {});
  }

  async function addGame(input: SteamSuggestion | { name: string; appid: string; img: string }) {
    const existing = games.find((g) => (g.appid && g.appid === input.appid) || g.name === input.name);
    if (existing) {
      setStatus(`"${input.name}" is already in your list.`);
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    if (!input.appid) {
      setStatus("Could not find a Steam game for that search.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    let resolved = { ...input };
    if (input.appid) {
      try {
        const res = await fetch(`/api/game-details?appid=${input.appid}`);
        const data = await res.json();
        if (data.name) resolved = { ...resolved, name: data.name, img: data.img };
      } catch { /* fall back to suggestion data */ }
    }

    const key = resolved.appid || resolved.name;
    const newGame: Game = {
      ...resolved,
      prices: {},
      addedAt: Date.now(),
    };

    const updated = [newGame, ...games];
    persistGames(updated);
    setStatus(`Added "${input.name}". Fetching prices…`);
    setRefreshingKeys((prev) => new Set(prev).add(key));

    try {
      await fetchPrices(newGame, (g) => (g.appid && g.appid === input.appid) || g.name === input.name);
      setStatus("");
    } catch {
      setStatus(`Could not fetch prices for "${input.name}".`);
      setTimeout(() => setStatus(""), 5000);
    } finally {
      setRefreshingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  async function refreshOne(key: string) {
    const game = games.find((g) => (g.appid || g.name) === key);
    if (!game) return;
    setRefreshingKeys((prev) => new Set(prev).add(key));
    setGames((prev) => prev.map((g) => (g.appid || g.name) === key ? { ...g, prices: {} } : g));
    setStatus(`Refreshing "${game.name}"…`);
    try {
      await fetchPrices(game, (g) => (g.appid || g.name) === key);
      setStatus("");
    } catch {
      setStatus(`Failed to refresh "${game.name}".`);
      setTimeout(() => setStatus(""), 4000);
    } finally {
      setRefreshingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  async function refreshAll() {
    if (!games.length) return;
    setProgress(0);
    setStatus(`Refreshing all ${games.length} games…`);
    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      if (!game) continue;
      const key = game.appid || game.name;
      setRefreshingKeys((prev) => new Set(prev).add(key));
      setGames((prev) => prev.map((g) => (g.appid || g.name) === key ? { ...g, prices: {} } : g));
      setStatus(`Fetching prices: ${game.name} (${i + 1}/${games.length})`);
      setProgress(Math.round((i / games.length) * 100));
      await fetchPrices(game, (g) => (g.appid || g.name) === key).catch(() => {});
      setRefreshingKeys((prev) => { const s = new Set(prev); s.delete(key); return s; });
      await new Promise((r) => setTimeout(r, 500));
    }
    setProgress(100);
    setStatus("All prices updated.");
    setTimeout(() => { setProgress(null); setStatus(""); }, 2500);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = games.findIndex((g) => (g.appid || g.name) === active.id);
    const newIndex = games.findIndex((g) => (g.appid || g.name) === over.id);
    persistGames(arrayMove(games, oldIndex, newIndex));
  }

  function removeGame(key: string) {
    const updated = games.filter((g) => (g.appid || g.name) !== key);
    persistGames(updated);
  }

  function clearAll() {
    if (!games.length) return;
    if (!confirm("Remove all games from the list?")) return;
    persistGames([]);
  }

  function toggleStore(id: string) {
    setActiveStores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (!hydrated) return null;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-medium mb-1">Game Price Tracker</h1>
        <p className="text-sm text-gray-500">
          Compare prices across Steam BR &amp; Nuuvem
        </p>
      </div>

      {/* Search */}
      <div className="mb-3">
        <SearchBar onAdd={addGame} />
      </div>
      <p className="text-xs text-gray-400 mb-5">
        Accepts game names, Steam URLs (store.steampowered.com/app/…), or AppIDs
      </p>

      {/* Store filter */}
      <div className="mb-5">
        <StoreFilter activeStores={activeStores} onToggle={toggleStore} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          onClick={refreshAll}
          disabled={!games.length || refreshingKeys.size > 0}
          className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          Refresh all prices
        </button>
        <button
          onClick={clearAll}
          disabled={!games.length}
          className="text-sm px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-40 transition-colors"
        >
          Clear list
        </button>
        {games.length > 0 && (
          <span className="text-xs text-gray-400 ml-auto">
            {games.length} game{games.length !== 1 ? "s" : ""} saved
          </span>
        )}
      </div>

      {/* Status + progress */}
      {status && (
        <p className="text-sm text-gray-500 mb-3">{status}</p>
      )}
      {progress !== null && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-gray-900 dark:bg-white rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Game grid */}
      {games.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-4">🎮</div>
          <p className="text-sm">
            No games added yet — search for a game above to get started.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={games.map((g) => g.appid || g.name)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map((game) => {
                const key = game.appid || game.name;
                return (
                  <SortableGameCard
                    key={key}
                    game={game}
                    activeStores={activeStores}
                    onRemove={removeGame}
                    onRefresh={refreshOne}
                    refreshing={refreshingKeys.has(key)}
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
