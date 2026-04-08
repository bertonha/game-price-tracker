-- ─────────────────────────────────────────────────────────────────────────────
-- games
-- Shared game catalog. One row per Steam AppID.
-- Stores cached price data so multiple users tracking the same game
-- share a single price record.
-- Any authenticated user can insert/update (e.g. trigger a price refresh).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS games (
  appid        TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  img          TEXT        NOT NULL DEFAULT '',
  prices       JSONB       NOT NULL DEFAULT '{}',
  last_fetched BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the game catalog.
CREATE POLICY "authenticated_read_games" ON games
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Any authenticated user can insert or update game/price data.
CREATE POLICY "authenticated_write_games" ON games
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_games" ON games
  FOR UPDATE
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────────────────────────────────────
-- user_games
-- Per-user tracking table. References the shared games catalog.
-- Only the owning user can read or modify their rows.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_games (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appid      TEXT        NOT NULL REFERENCES games(appid)  ON DELETE CASCADE,
  added_at   BIGINT      NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_games_user_appid_key UNIQUE (user_id, appid)
);

CREATE INDEX IF NOT EXISTS idx_user_games_user_id ON user_games (user_id);

ALTER TABLE user_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_games" ON user_games
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
