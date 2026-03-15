-- Criar tabela para registrar uso de códigos de apoiador
CREATE TABLE IF NOT EXISTS supporter_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES supporter_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  trader_id UUID NOT NULL REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  
  -- Índices para melhor performance
  CONSTRAINT unique_user_code UNIQUE(user_id, code_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_supporter_code_usage_trader_id ON supporter_code_usage(trader_id);
CREATE INDEX IF NOT EXISTS idx_supporter_code_usage_code_id ON supporter_code_usage(code_id);
CREATE INDEX IF NOT EXISTS idx_supporter_code_usage_user_id ON supporter_code_usage(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supporter_code_usage_used_at ON supporter_code_usage(used_at);

-- Habilitar RLS
ALTER TABLE supporter_code_usage ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Qualquer um pode registrar uso de código"
  ON supporter_code_usage FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Traders podem ver seus apoiadores"
  ON supporter_code_usage FOR SELECT
  TO authenticated
  USING (trader_id = auth.uid());

CREATE POLICY "Admins podem ver tudo"
  ON supporter_code_usage FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Comentários
COMMENT ON TABLE supporter_code_usage IS 'Registra quando usuários usam códigos de apoiador de traders';
COMMENT ON COLUMN supporter_code_usage.code_id IS 'ID do código de apoiador usado';
COMMENT ON COLUMN supporter_code_usage.user_id IS 'ID do usuário que usou o código (pode ser null para não autenticados)';
COMMENT ON COLUMN supporter_code_usage.trader_id IS 'ID do trader dono do código';
COMMENT ON COLUMN supporter_code_usage.ip_address IS 'IP do usuário para tracking';
COMMENT ON COLUMN supporter_code_usage.user_agent IS 'User agent para analytics';
