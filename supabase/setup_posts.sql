-- Script SQL para criar bucket de storage para posts
-- Execute este script no SQL Editor do Supabase

-- 1. Criar bucket para imagens de posts (se não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Criar política de upload (apenas usuários autenticados podem fazer upload)
CREATE POLICY "Usuários autenticados podem fazer upload de imagens"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images');

-- 3. Criar política de leitura pública
CREATE POLICY "Imagens de posts são públicas"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- 4. Criar política de delete (apenas o dono pode deletar)
CREATE POLICY "Usuários podem deletar suas próprias imagens"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Verificar se as tabelas existem e estão corretas
-- Tabela streamer_posts
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'streamer_posts') THEN
        CREATE TABLE public.streamer_posts (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            streamer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            media_url TEXT,
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
        );
        
        CREATE INDEX idx_streamer_posts_streamer_id ON public.streamer_posts(streamer_id);
        CREATE INDEX idx_streamer_posts_created_at ON public.streamer_posts(created_at DESC);
        
        -- RLS
        ALTER TABLE public.streamer_posts ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Posts são públicos para leitura"
        ON public.streamer_posts FOR SELECT
        TO public
        USING (true);
        
        CREATE POLICY "Streamers podem criar seus próprios posts"
        ON public.streamer_posts FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = streamer_id);
        
        CREATE POLICY "Streamers podem atualizar seus próprios posts"
        ON public.streamer_posts FOR UPDATE
        TO authenticated
        USING (auth.uid() = streamer_id);
        
        CREATE POLICY "Streamers podem deletar seus próprios posts"
        ON public.streamer_posts FOR DELETE
        TO authenticated
        USING (auth.uid() = streamer_id);
    END IF;
END
$$;

-- 6. Tabela post_reactions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'post_reactions') THEN
        CREATE TABLE public.post_reactions (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            post_id UUID NOT NULL REFERENCES public.streamer_posts(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'love', 'fire', 'star')),
            created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
            UNIQUE(post_id, user_id)
        );
        
        CREATE INDEX idx_post_reactions_post_id ON public.post_reactions(post_id);
        CREATE INDEX idx_post_reactions_user_id ON public.post_reactions(user_id);
        
        -- RLS
        ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Reações são públicas para leitura"
        ON public.post_reactions FOR SELECT
        TO public
        USING (true);
        
        CREATE POLICY "Usuários autenticados podem criar reações"
        ON public.post_reactions FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Usuários podem atualizar suas próprias reações"
        ON public.post_reactions FOR UPDATE
        TO authenticated
        USING (auth.uid() = user_id);
        
        CREATE POLICY "Usuários podem deletar suas próprias reações"
        ON public.post_reactions FOR DELETE
        TO authenticated
        USING (auth.uid() = user_id);
    END IF;
END
$$;

-- 7. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_streamer_posts_updated_at') THEN
        CREATE TRIGGER update_streamer_posts_updated_at
        BEFORE UPDATE ON public.streamer_posts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;
