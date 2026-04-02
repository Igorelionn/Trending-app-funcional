-- Migration: Adicionar suporte para banner de perfil
-- Data: 2026-03-15
-- Descrição: Adiciona campo banner_url na tabela user_profiles e cria bucket de storage

-- 1. Adicionar campo banner_url na tabela user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- 2. Criar bucket de storage para banners (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'banners',
  'banners',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS para o bucket de banners

-- Permitir que usuários autenticados façam upload de seus próprios banners
CREATE POLICY IF NOT EXISTS "Usuários autenticados podem fazer upload de banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que todos visualizem os banners (público)
CREATE POLICY IF NOT EXISTS "Todos podem visualizar banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'banners');

-- Permitir que usuários atualizem seus próprios banners
CREATE POLICY IF NOT EXISTS "Usuários podem atualizar seus próprios banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Permitir que usuários deletem seus próprios banners
CREATE POLICY IF NOT EXISTS "Usuários podem deletar seus próprios banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'banners' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
