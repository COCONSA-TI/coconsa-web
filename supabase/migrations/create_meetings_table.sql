-- ============================================================
-- MÓDULO DE REUNIONES CON IA
-- Tabla: meetings — almacena reuniones, transcripciones y minutas
-- ============================================================

-- Tabla principal de reuniones
CREATE TABLE IF NOT EXISTS meetings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  organizer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendees       TEXT[]          DEFAULT '{}',
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_seconds INTEGER,
  transcript      TEXT,
  minutes_structured JSONB,
  audio_path      TEXT,           -- ruta dentro del bucket: {userId}/{meetingId}.webm
  audio_size_bytes BIGINT,
  status          TEXT            DEFAULT 'draft'
                  CHECK (status IN ('draft', 'in_progress', 'completed')),
  created_at      TIMESTAMPTZ     DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS meetings_organizer_id_idx ON meetings(organizer_id);
CREATE INDEX IF NOT EXISTS meetings_status_idx       ON meetings(status);
CREATE INDEX IF NOT EXISTS meetings_created_at_idx   ON meetings(created_at DESC);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_meetings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at_trigger
  BEFORE UPDATE ON meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meetings_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY: cada usuario solo ve sus propias reuniones
-- ============================================================
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo pueden ver sus propias reuniones
CREATE POLICY "meetings_select_own"
  ON meetings FOR SELECT
  USING (organizer_id::text = current_setting('app.current_user_id', TRUE));

-- Los usuarios solo pueden insertar reuniones propias
CREATE POLICY "meetings_insert_own"
  ON meetings FOR INSERT
  WITH CHECK (organizer_id::text = current_setting('app.current_user_id', TRUE));

-- Los usuarios solo pueden actualizar sus propias reuniones
CREATE POLICY "meetings_update_own"
  ON meetings FOR UPDATE
  USING (organizer_id::text = current_setting('app.current_user_id', TRUE));

-- Los usuarios solo pueden eliminar sus propias reuniones
CREATE POLICY "meetings_delete_own"
  ON meetings FOR DELETE
  USING (organizer_id::text = current_setting('app.current_user_id', TRUE));

-- ============================================================
-- STORAGE: Bucket para audios de reuniones
-- Nota: ejecutar en el dashboard de Supabase > Storage si el
-- SQL runner no tiene permisos sobre el schema storage.
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'meeting-audios',
--   'meeting-audios',
--   false,
--   524288000,  -- 500 MB máximo por archivo
--   ARRAY['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']
-- )
-- ON CONFLICT (id) DO NOTHING;

-- Política de storage: el dueño del audio puede leer y escribir
-- CREATE POLICY "meeting_audio_owner_access"
--   ON storage.objects FOR ALL
--   USING (
--     bucket_id = 'meeting-audios'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   )
--   WITH CHECK (
--     bucket_id = 'meeting-audios'
--     AND (storage.foldername(name))[1] = auth.uid()::text
--   );
