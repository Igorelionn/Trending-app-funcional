-- Adiciona campo meeting_url para links externos (Google Meet, Zoom, etc.)
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS meeting_url TEXT;
