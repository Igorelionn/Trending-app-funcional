-- Atualizar políticas RLS para supporter_code_usage para permitir upsert

-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Qualquer um pode registrar uso de código" ON supporter_code_usage;

-- Criar política que permite INSERT e UPDATE para usuários autenticados
CREATE POLICY "Usuários autenticados podem registrar e atualizar uso de código"
  ON supporter_code_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Permitir UPDATE apenas do próprio registro
CREATE POLICY "Usuários podem atualizar seu próprio uso de código"
  ON supporter_code_usage FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Manter política de SELECT para traders verem seus apoiadores
-- (já existe, não precisa recriar)

-- Comentário explicativo
COMMENT ON POLICY "Usuários autenticados podem registrar e atualizar uso de código" ON supporter_code_usage 
IS 'Permite que usuários autenticados registrem quando usam um código de apoiador';

COMMENT ON POLICY "Usuários podem atualizar seu próprio uso de código" ON supporter_code_usage 
IS 'Permite que usuários atualizem a data de uso (used_at) do seu próprio registro ao fazer upsert';
