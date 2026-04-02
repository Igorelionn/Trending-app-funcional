-- Adiciona suporte a posts exclusivos para apoiadores
ALTER TABLE streamer_posts
ADD COLUMN IF NOT EXISTS supporters_only BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para filtrar posts de apoiadores
CREATE INDEX IF NOT EXISTS idx_streamer_posts_supporters_only
  ON streamer_posts (supporters_only)
  WHERE supporters_only = TRUE;
