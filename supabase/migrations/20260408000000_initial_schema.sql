CREATE TABLE IF NOT EXISTS games (
  appid        TEXT        PRIMARY KEY,
  name         TEXT        NOT NULL,
  img          TEXT        NOT NULL DEFAULT '',
  prices       JSONB       NOT NULL DEFAULT '{}',
  last_fetched BIGINT,
  release_date TIMESTAMPTZ,
  coming_soon  BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_games" ON games
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_write_games" ON games
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update_games" ON games
  FOR UPDATE
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS user_games (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appid        TEXT        NOT NULL REFERENCES games(appid)   ON DELETE CASCADE,
  added_at     BIGINT      NOT NULL,
  sort_order   INT         NOT NULL DEFAULT 0,
  is_favorite  BOOLEAN              DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_games_user_appid_key UNIQUE (user_id, appid)
);

CREATE INDEX IF NOT EXISTS idx_user_games_user_id ON user_games (user_id);

ALTER TABLE user_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_games" ON user_games
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
