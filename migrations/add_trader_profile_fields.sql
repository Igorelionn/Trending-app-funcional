-- Adicionar coluna 'about' na tabela user_profiles para informações escritas pelo próprio trader
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS about TEXT;

-- Adicionar colunas de ranking na tabela user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS ranking_lifetime INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ranking_monthly INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ranking_weekly INTEGER DEFAULT NULL;

-- Adicionar índices para melhor performance nas consultas de ranking
CREATE INDEX IF NOT EXISTS idx_user_profiles_ranking_lifetime ON user_profiles(ranking_lifetime) WHERE ranking_lifetime IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_ranking_monthly ON user_profiles(ranking_monthly) WHERE ranking_monthly IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_profiles_ranking_weekly ON user_profiles(ranking_weekly) WHERE ranking_weekly IS NOT NULL;

-- Adicionar coluna user_id na tabela supporter_codes para vincular códigos de apoiador aos usuários/traders
ALTER TABLE supporter_codes
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Criar índice para buscar códigos de um usuário específico
CREATE INDEX IF NOT EXISTS idx_supporter_codes_user_id ON supporter_codes(user_id) WHERE user_id IS NOT NULL;

-- Comentários nas colunas
COMMENT ON COLUMN user_profiles.about IS 'Informações sobre o trader escritas por ele mesmo';
COMMENT ON COLUMN user_profiles.ranking_lifetime IS 'Posição no ranking geral (lifetime) - controlado pelo admin';
COMMENT ON COLUMN user_profiles.ranking_monthly IS 'Posição no ranking mensal - controlado pelo admin';
COMMENT ON COLUMN user_profiles.ranking_weekly IS 'Posição no ranking semanal - controlado pelo admin';
COMMENT ON COLUMN supporter_codes.user_id IS 'ID do trader/streamer vinculado a este código de apoiador';
