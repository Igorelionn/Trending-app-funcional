-- Criar tabela de postagens dos streamers
CREATE TABLE IF NOT EXISTS streamer_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de reações às postagens
CREATE TABLE IF NOT EXISTS post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES streamer_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'fire', 'star')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Criar tabela de horários de lives
CREATE TABLE IF NOT EXISTS stream_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Domingo, 6 = Sábado
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(streamer_id, day_of_week)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_streamer_posts_streamer_id ON streamer_posts(streamer_id);
CREATE INDEX IF NOT EXISTS idx_streamer_posts_created_at ON streamer_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post_id ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_schedules_streamer_id ON stream_schedules(streamer_id);

-- RLS Policies
ALTER TABLE streamer_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_schedules ENABLE ROW LEVEL SECURITY;

-- Policies para streamer_posts
CREATE POLICY "Qualquer um pode ver postagens"
  ON streamer_posts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Streamers podem criar suas próprias postagens"
  ON streamer_posts FOR INSERT
  TO authenticated
  WITH CHECK (streamer_id = auth.uid());

CREATE POLICY "Streamers podem atualizar suas próprias postagens"
  ON streamer_posts FOR UPDATE
  TO authenticated
  USING (streamer_id = auth.uid());

CREATE POLICY "Streamers podem deletar suas próprias postagens"
  ON streamer_posts FOR DELETE
  TO authenticated
  USING (streamer_id = auth.uid());

-- Policies para post_reactions
CREATE POLICY "Qualquer um pode ver reações"
  ON post_reactions FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Usuários autenticados podem adicionar reações"
  ON post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuários podem remover suas próprias reações"
  ON post_reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Policies para stream_schedules
CREATE POLICY "Qualquer um pode ver horários"
  ON stream_schedules FOR SELECT
  TO authenticated, anon
  USING (is_active = true);

CREATE POLICY "Streamers podem gerenciar seus horários"
  ON stream_schedules FOR ALL
  TO authenticated
  USING (streamer_id = auth.uid());

-- Comentários
COMMENT ON TABLE streamer_posts IS 'Postagens dos streamers/traders em seus perfis';
COMMENT ON TABLE post_reactions IS 'Reações dos usuários às postagens';
COMMENT ON TABLE stream_schedules IS 'Horários regulares de lives dos streamers';
COMMENT ON COLUMN stream_schedules.day_of_week IS '0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado';
