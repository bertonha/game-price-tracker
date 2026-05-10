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
import type { Game, SteamSuggestion } from "@/lib/types";
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
  const [sortOrder, setSortOrder] = useState<
    "priority" | "cheapest" | "expensive" | "release-date"
  >("priority");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [savedGamesQuery, setSavedGamesQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(() => {
    try {
      return localStorage.getItem("filtersOpen") !== "false";
    } catch {
      return false;
    }
  });

  function prioritizeStarred(list: Game[]): Game[] {
    const starred = list.filter((g) => g.isFavorite);
    const others = list.filter((g) => !g.isFavorite);
    return [...starred, ...others];
  }

  function sortByReleaseDateWithinStarGroups(list: Game[]): Game[] {
    function byDate(a: Game, b: Game): number {
      if (!a.releaseDate && !b.releaseDate) return 0;
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime();
    }
    const starred = list.filter((g) => g.isFavorite).sort(byDate);
    const others = list.filter((g) => !g.isFavorite).sort(byDate);
    return [...starred, ...others];
  }

  function sortByPriceWithinStarGroups(list: Game[], direction: "asc" | "desc"): Game[] {
    function minPrice(game: Game): number {
      let min = Number.POSITIVE_INFINITY;
      for (const info of Object.values(game.prices)) {
        if (!info?.price || info.price === "N/A") continue;
        const n = parseFloat(info.price.replace(/[^0-9.,]/g, "").replace(",", "."));
        if (!Number.isNaN(n) && n < min) min = n;
      }
      return min;
    }

    function byPrice(a: Game, b: Game): number {
      const pa = minPrice(a);
      const pb = minPrice(b);
      if (pa === Number.POSITIVE_INFINITY && pb === Number.POSITIVE_INFINITY) return 0;
      if (pa === Number.POSITIVE_INFINITY) return 1;
      if (pb === Number.POSITIVE_INFINITY) return -1;
      return direction === "asc" ? pa - pb : pb - pa;
    }

    const starred = list.filter((g) => g.isFavorite).sort(byPrice);
    const others = list.filter((g) => !g.isFavorite).sort(byPrice);
    return [...starred, ...others];
  }

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

  async function fetchPrices(game: Game, force = false): Promise<void> {
    const key = gameKey(game);
    const res = await fetch("/api/fetch-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appid: game.appid, name: game.name, force }),
    });
    if (!res.ok) return;
    const { prices, lastFetched, releaseDate, comingSoon } = await res.json();
    setGames((prev) => {
      const next = prev.map((g) =>
        gameKey(g) === key
          ? {
              ...g,
              prices: { ...g.prices, ...prices },
              lastFetched,
              ...(releaseDate !== undefined && { releaseDate }),
              ...(comingSoon !== undefined && { comingSoon }),
            }
          : g,
      );
      saveGames(next);
      if (supabase && userIdRef.current) {
        const updated = next.find((g) => gameKey(g) === key);
        const idx = next.findIndex((g) => gameKey(g) === key);
        if (updated) upsertUserGame(supabase, userIdRef.current, updated, idx);
      }
      return next;
    });
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
    let releaseDate: string | undefined;
    let comingSoon: boolean | undefined;
    try {
      const res = await fetch(`/api/game-details?appid=${input.appid}`);
      const data = await res.json();
      if (data.name) resolved = { ...resolved, name: data.name, img: data.img };
      if (data.releaseDate) releaseDate = data.releaseDate;
      if (data.comingSoon !== undefined) comingSoon = data.comingSoon;
    } catch {
      /* fall back to suggestion data */
    }

    const key = gameKey(resolved);
    const newGame: Game = {
      ...resolved,
      prices: {},
      addedAt: Date.now(),
      releaseDate,
      comingSoon,
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
      await fetchPrices(game, true);
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
        await fetchPrices(game, force).catch(() => {});
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
    persistGames(prioritizeStarred(arrayMove(games, oldIndex, newIndex)));
  }

  function removeGame(key: string) {
    const game = games.find((g) => gameKey(g) === key);
    if (game && supabase && userIdRef.current) {
      deleteUserGame(supabase, userIdRef.current, game.appid);
    }
    persistGames(games.filter((g) => gameKey(g) !== key));
  }

  async function toggleFavorite(appid: string) {
    const gameIndex = games.findIndex((g) => g.appid === appid);
    if (gameIndex === -1) return;

    const game = games[gameIndex];
    const prevGames = [...games];
    const updatedGame = { ...game, isFavorite: !game.isFavorite };
    const nextGames = [...games];
    nextGames[gameIndex] = updatedGame;
    const normalizedGames = prioritizeStarred(nextGames);

    // Optimistic update
    setGames(normalizedGames);
    saveGames(normalizedGames);

    if (supabase && userIdRef.current) {
      try {
        await upsertAllUserGames(supabase, userIdRef.current, normalizedGames);
      } catch {
        // Revert on failure
        setGames(prevGames);
        saveGames(prevGames);
        setStatus("Failed to update favorite status. Please try again.");
        setTimeout(() => setStatus(""), 3000);
      }
    }
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

  const storeFilteredGames =
    activeStores.size === 0
      ? games
      : games.filter((g) => activeStores.has(bestDeal(g.prices) ?? ""));

  const filteredGames = showStarredOnly
    ? storeFilteredGames.filter((g) => g.isFavorite)
    : storeFilteredGames;

  const searchFilteredGames = filteredGames.filter((g) => {
    const query = savedGamesQuery.trim().toLowerCase();
    if (!query) return true;
    return g.name.toLowerCase().includes(query) || g.appid.includes(query);
  });

  function sortGames(list: Game[]) {
    if (sortOrder === "cheapest") return sortByPriceWithinStarGroups(list, "asc");
    if (sortOrder === "expensive") return sortByPriceWithinStarGroups(list, "desc");
    if (sortOrder === "release-date") return sortByReleaseDateWithinStarGroups(list);
    return prioritizeStarred(list);
  }

  const displayedGames = sortGames(searchFilteredGames);

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
          onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
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
