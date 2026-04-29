import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "@/lib/types";

// ─── Shape returned by the join query ────────────────────────────────────────
type UserGameRow = {
  appid: string;
  added_at: number;
  sort_order: number;
  is_favorite: boolean;
  games: {
    name: string;
    img: string;
    prices: Game["prices"];
    last_fetched: number | null;
  };
};

function rowToGame(row: UserGameRow): Game {
  return {
    appid: row.appid,
    name: row.games.name,
    img: row.games.img,
    prices: row.games.prices ?? {},
    lastFetched: row.games.last_fetched ?? undefined,
    addedAt: row.added_at,
    isFavorite: row.is_favorite ?? false,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function loadUserGames(supabase: SupabaseClient, userId: string): Promise<Game[]> {
  const { data, error } = await supabase
    .from("user_games")
    .select("appid, added_at, sort_order, is_favorite, games(name, img, prices, last_fetched)")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return (data as unknown as UserGameRow[]).map(rowToGame);
}

// ─── Writes ───────────────────────────────────────────────────────────────────

// Upserts a game into the shared catalog then links it to the user.
export async function upsertUserGame(
  supabase: SupabaseClient,
  userId: string,
  game: Game,
  sortOrder: number,
): Promise<void> {
  // 1. Upsert shared game record (name, img, prices, last_fetched)
  const { error: gameError } = await supabase.from("games").upsert(
    {
      appid: game.appid,
      name: game.name,
      img: game.img,
      prices: game.prices,
      last_fetched: game.lastFetched ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "appid" },
  );
  if (gameError) throw gameError;

  // 2. Upsert user → game link
  const { error: linkError } = await supabase.from("user_games").upsert(
    {
      user_id: userId,
      appid: game.appid,
      added_at: game.addedAt,
      sort_order: sortOrder,
      is_favorite: game.isFavorite ?? false,
    },
    { onConflict: "user_id,appid" },
  );
  if (linkError) throw linkError;
}

// Batch upsert — used for initial auto-import and full-list reorder.
export async function upsertAllUserGames(
  supabase: SupabaseClient,
  userId: string,
  games: Game[],
): Promise<void> {
  if (!games.length) return;

  const gameRows = games.map((g) => ({
    appid: g.appid,
    name: g.name,
    img: g.img,
    prices: g.prices,
    last_fetched: g.lastFetched ?? null,
    updated_at: new Date().toISOString(),
  }));

  const linkRows = games.map((g, i) => ({
    user_id: userId,
    appid: g.appid,
    added_at: g.addedAt,
    sort_order: i,
    is_favorite: g.isFavorite ?? false,
  }));

  const { error: gameError } = await supabase
    .from("games")
    .upsert(gameRows, { onConflict: "appid" });
  if (gameError) throw gameError;

  const { error: linkError } = await supabase
    .from("user_games")
    .upsert(linkRows, { onConflict: "user_id,appid" });
  if (linkError) throw linkError;
}

export async function deleteUserGame(
  supabase: SupabaseClient,
  userId: string,
  appid: string,
): Promise<void> {
  // Only removes the user → game link. The shared games row is intentionally
  // kept so other users' data is unaffected.
  const { error } = await supabase
    .from("user_games")
    .delete()
    .eq("user_id", userId)
    .eq("appid", appid);
  if (error) throw error;
}

export async function deleteAllUserGames(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from("user_games").delete().eq("user_id", userId);
  if (error) throw error;
}
