-- ============================================
-- Instruções para Aplicar a Migração
-- ============================================
-- 
-- 1. Acesse o Supabase Dashboard
-- 2. Vá em SQL Editor
-- 3. Cole e execute este script
-- 
-- ============================================

-- Atualizar políticas RLS para supporter_code_usage para permitir upsert

-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Qualquer um pode registrar uso de código" ON supporter_code_usage;

-- Criar política que permite INSERT para usuários autenticados
CREATE POLICY "Usuários autenticados podem registrar uso de código"
  ON supporter_code_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Permitir UPDATE apenas do próprio registro
CREATE POLICY "Usuários podem atualizar seu próprio uso de código"
  ON supporter_code_usage FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Verificar políticas criadas
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'supporter_code_usage'
ORDER BY policyname;

-- ============================================
-- Fim da Migração
-- ============================================
