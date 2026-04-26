"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GameCard from "@/components/GameCard";
import SearchBar from "@/components/SearchBar";
import StoreFilter from "@/components/StoreFilter";
import { clearGames, loadGames, saveGames } from "@/lib/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteAllUserGames,
  deleteUserGame,
  loadUserGames,
  upsertAllUserGames,
  upsertUserGame,
} from "@/lib/supabase/storage";
import type { Game, GamePrices, SteamSuggestion, StorePrice } from "@/lib/types";
import { bestDeal, gameKey } from "@/lib/utils";

function SortableGameCard(props: React.ComponentProps<typeof GameCard>) {
  const key = gameKey(props.game);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: key,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "z-10 opacity-50" : ""}
    >
      <GameCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  // Keep userId in a ref so callbacks always have the latest value without
  // needing it as a dependency.
  const userIdRef = useRef<string | null>(null);
  const refreshAllRef = useRef<(force?: boolean) => void>(() => {});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [games, setGames] = useState<Game[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeStores, setActiveStores] = useState<Set<string>>(new Set());
  const [refreshingKeys, setRefreshingKeys] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // On mount: resolve user, load games from Supabase.
  // If DB is empty and localStorage has games → auto-import once.
  useEffect(() => {
    let active = true;

    async function init() {
      if (!supabase) {
        setGames(loadGames());
        setHydrated(true);
        return; // no auth configured — treat as guest
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        setGames(loadGames());
        setHydrated(true);
        return;
      }

      userIdRef.current = user.id;
      setIsLoggedIn(true);

      const remote = await loadUserGames(supabase, user.id);

      if (!active) return;

      if (remote.length > 0) {
        setGames(remote);
        saveGames(remote); // keep localStorage as a warm cache
      } else {
        // First login: auto-import games from localStorage.
        const local = loadGames();
        if (local.length > 0) {
          await upsertAllUserGames(supabase, user.id, local);
          if (active) setGames(local);
          clearGames(); // localStorage no longer needed as source
        }
      }

      setHydrated(true);
    }

    init();

    return () => {
      active = false;
    };
  }, [supabase]);

  // Redirect to login and clean up local state when the session expires or is
  // invalidated externally (e.g. refresh token rotation failure).
  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && userIdRef.current) {
        clearGames();
        userIdRef.current = null;
        setIsLoggedIn(false);
        setGames([]);
        router.replace("/auth/login");
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  const persistGames = useCallback(
    (updated: Game[]) => {
      setGames(updated);
      saveGames(updated);
      if (supabase && userIdRef.current) {
        upsertAllUserGames(supabase, userIdRef.current, updated);
      }
    },
    [supabase],
  );

  async function fetchPrices(game: Game): Promise<void> {
    const key = gameKey(game);
    const update = (storeId: keyof GamePrices, price: StorePrice) =>
      setGames((prev) => {
        const next = prev.map((g) =>
          gameKey(g) === key
            ? {
                ...g,
                prices: { ...g.prices, [storeId]: price },
                lastFetched: Date.now(),
              }
            : g,
        );
        saveGames(next);
        if (supabase && userIdRef.current) {
          const updated = next.find((g) => gameKey(g) === key);
          const sortOrder = next.findIndex((g) => gameKey(g) === key);
          if (updated) {
            upsertUserGame(supabase, userIdRef.current, updated, sortOrder);
          }
        }
        return next;
      });

    const steam = fetch("/api/fetch-prices/steam", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: game.name, appid: game.appid }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.price) update("steam", d.price);
      })
      .catch(() => {});

    const nuuvem = fetch("/api/fetch-prices/nuuvem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: game.name }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.price) update("nuuvem", d.price);
      })
      .catch(() => {});

    const instantGaming = fetch("/api/fetch-prices/instant-gaming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: game.name }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.price) update("instant-gaming", d.price);
      })
      .catch(() => {});

    await Promise.all([steam, nuuvem, instantGaming]);
  }

  async function addGame(input: SteamSuggestion | { name: string; appid: string; img: string }) {
    const existing = games.find((g) => gameKey(g) === gameKey(input));
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
    try {
      const res = await fetch(`/api/game-details?appid=${input.appid}`);
      const data = await res.json();
      if (data.name) resolved = { ...resolved, name: data.name, img: data.img };
    } catch {
      /* fall back to suggestion data */
    }

    const key = gameKey(resolved);
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
      await fetchPrices(newGame);
      setStatus("");
    } catch {
      setStatus(`Could not fetch prices for "${input.name}".`);
      setTimeout(() => setStatus(""), 5000);
    } finally {
      setRefreshingKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  }

  async function refreshOne(key: string) {
    const game = games.find((g) => gameKey(g) === key);
    if (!game) return;
    setRefreshingKeys((prev) => new Set(prev).add(key));
    setGames((prev) => prev.map((g) => (gameKey(g) === key ? { ...g, prices: {} } : g)));
    setStatus(`Refreshing "${game.name}"…`);
    try {
      await fetchPrices(game);
      setStatus("");
    } catch {
      setStatus(`Failed to refresh "${game.name}".`);
      setTimeout(() => setStatus(""), 4000);
    } finally {
      setRefreshingKeys((prev) => {
        const s = new Set(prev);
        s.delete(key);
        return s;
      });
    }
  }

  async function refreshAll(force = false) {
    if (!games.length) return;

    const ONE_HOUR = 60 * 60 * 1000;
    const stale = force
      ? games
      : games.filter((g) => !g.lastFetched || Date.now() - g.lastFetched > ONE_HOUR);

    if (stale.length === 0) {
      setStatus("All prices are up to date.");
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    const total = stale.length;
    const skipped = games.length - total;
    setProgress(0);
    setStatus(
      skipped > 0
        ? `Refreshing ${total} game${total !== 1 ? "s" : ""} (${skipped} up to date)…`
        : `Refreshing all ${total} games…`,
    );
    let completed = 0;

    // Mark only stale games as refreshing and clear their prices
    const staleKeys = new Set(stale.map(gameKey));
    setRefreshingKeys(new Set(staleKeys));
    setGames((prev) => prev.map((g) => (staleKeys.has(gameKey(g)) ? { ...g, prices: {} } : g)));

    await Promise.all(
      stale.map(async (game) => {
        const key = gameKey(game);
        await fetchPrices(game).catch(() => {});
        setRefreshingKeys((prev) => {
          const s = new Set(prev);
          s.delete(key);
          return s;
        });
        completed++;
        setProgress(Math.round((completed / total) * 100));
      }),
    );

    setProgress(100);
    setStatus("Prices updated.");
    setTimeout(() => {
      setProgress(null);
      setStatus("");
    }, 2500);
  }

  // Keep the ref pointing at the latest refreshAll so the auto-refresh effect
  // below can call it without a stale closure.
  refreshAllRef.current = refreshAll;

  // After hydration, trigger a refresh for any stale prices.
  // If ?refresh=1 is present in the URL, force-refresh all games ignoring the 1-hour cache.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const force = params.get("refresh") === "1";
    if (force) {
      params.delete("refresh");
      const newUrl = window.location.pathname + (params.size ? `?${params}` : "");
      window.history.replaceState(null, "", newUrl);
    }
    refreshAllRef.current(force);
  }, [hydrated]);

  // When the user returns to the tab, refresh stale prices.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshAllRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = games.findIndex((g) => gameKey(g) === active.id);
    const newIndex = games.findIndex((g) => gameKey(g) === over.id);
    persistGames(arrayMove(games, oldIndex, newIndex));
  }

  function removeGame(key: string) {
    const game = games.find((g) => gameKey(g) === key);
    if (game && supabase && userIdRef.current) {
      deleteUserGame(supabase, userIdRef.current, game.appid);
    }
    persistGames(games.filter((g) => gameKey(g) !== key));
  }

  function clearAll() {
    if (!games.length) return;
    if (!confirm("Remove all games from the list?")) return;
    if (supabase && userIdRef.current) {
      deleteAllUserGames(supabase, userIdRef.current);
    }
    persistGames([]);
  }

  function toggleStore(id: string) {
    setActiveStores((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    clearGames();
    userIdRef.current = null;
    router.replace("/auth/login");
    router.refresh();
  }

  if (!hydrated) return null;

  const filteredGames =
    activeStores.size === 0
      ? games
      : games.filter((g) => activeStores.has(bestDeal(g.prices) ?? ""));

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
      <div className="mb-5">
        <StoreFilter activeStores={activeStores} onToggle={toggleStore} />
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
        {games.length > 0 && (
          <span className="ml-auto text-gray-400 text-xs">
            {activeStores.size > 0
              ? `${filteredGames.length} of ${games.length} game${games.length !== 1 ? "s" : ""}`
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
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={games.map(gameKey)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGames.map((game, idx) => {
                const key = gameKey(game);
                return (
                  <SortableGameCard
                    key={key}
                    game={game}
                    onRemove={removeGame}
                    onRefresh={refreshOne}
                    refreshing={refreshingKeys.has(key)}
                    prioritizeImage={idx === 0}
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
