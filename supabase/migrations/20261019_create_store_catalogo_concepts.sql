-- ==============================================================================
-- TABLA: store_catalogo_concepts
-- Módulo: Catálogo de Avances y Conceptos de Obra
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.store_catalogo_concepts (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id                BIGINT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  clave                   VARCHAR(100) NOT NULL,
  descripcion             TEXT NOT NULL,
  unidad                  VARCHAR(50) DEFAULT 'PZA',
  cantidad_presupuestada  NUMERIC(16, 4) DEFAULT 0,
  precio_unitario         NUMERIC(16, 4) DEFAULT 0,
  importe_presupuestado   NUMERIC(16, 2) DEFAULT 0,
  cantidad_acumulada      NUMERIC(16, 4) DEFAULT 0,
  importe_acumulado       NUMERIC(16, 2) DEFAULT 0,
  cantidad_pendiente      NUMERIC(16, 4) DEFAULT 0,
  importe_pendiente       NUMERIC(16, 2) DEFAULT 0,
  semanas                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas por obra y ordenamiento por clave
CREATE INDEX IF NOT EXISTS idx_store_catalogo_concepts_store_id 
  ON public.store_catalogo_concepts(store_id);

CREATE INDEX IF NOT EXISTS idx_store_catalogo_concepts_store_clave 
  ON public.store_catalogo_concepts(store_id, clave);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_store_catalogo_concepts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_store_catalogo_concepts_updated_at ON public.store_catalogo_concepts;
CREATE TRIGGER trigger_store_catalogo_concepts_updated_at
  BEFORE UPDATE ON public.store_catalogo_concepts
  FOR EACH ROW
  EXECUTE FUNCTION update_store_catalogo_concepts_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.store_catalogo_concepts ENABLE ROW LEVEL SECURITY;

-- Política de RLS para usuarios autenticados
CREATE POLICY "store_catalogo_concepts_all_authenticated"
  ON public.store_catalogo_concepts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comentarios explicativos
COMMENT ON TABLE public.store_catalogo_concepts IS 'Almacena los conceptos de obra presupuestados y sus avances ejecutados por semana (Catálogo de Avances).';
COMMENT ON COLUMN public.store_catalogo_concepts.semanas IS 'Mapa JSON de avance semanal con formato: { "1": { "semana_numero": 1, "cantidad_ejecutada": 10, "importe_ejecutado": 500, "fecha_inicio": "...", "fecha_fin": "..." } }';
