"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { prioritizeStarred } from "@/lib/sort";
import { clearGames, loadGames, saveGames } from "@/lib/storage";
import type { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  deleteAllUserGames,
  deleteUserGame,
  loadUserGames,
  upsertAllUserGames,
  upsertUserGame,
} from "@/lib/supabase/storage";
import type { Game, SteamSuggestion } from "@/lib/types";
import { gameKey } from "@/lib/utils";

export function useCollection(supabase: ReturnType<typeof getSupabaseBrowserClient>) {
  const router = useRouter();
  const userIdRef = useRef<string | null>(null);
  const refreshAllRef = useRef<(force?: boolean) => void>(() => {});

  const [games, setGames] = useState<Game[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
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
        return;
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
        saveGames(remote);
      } else {
        const local = loadGames();
        if (local.length > 0) {
          await upsertAllUserGames(supabase, user.id, local);
          if (active) setGames(local);
          clearGames();
        }
      }

      setHydrated(true);
    }

    init();
    return () => {
      active = false;
    };
  }, [supabase]);

  // Redirect to login when session expires or is invalidated externally.
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
    const newGame: Game = { ...resolved, prices: {}, addedAt: Date.now(), releaseDate, comingSoon };

    persistGames([newGame, ...games]);
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

  refreshAllRef.current = refreshAll;

  // After hydration, trigger a refresh for stale prices.
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
      if (document.visibilityState === "visible") refreshAllRef.current();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

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

    setGames(normalizedGames);
    saveGames(normalizedGames);

    if (supabase && userIdRef.current) {
      try {
        await upsertAllUserGames(supabase, userIdRef.current, normalizedGames);
      } catch {
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

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearGames();
    userIdRef.current = null;
    router.replace("/auth/login");
    router.refresh();
  }

  return {
    games,
    setGames,
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
  };
}
