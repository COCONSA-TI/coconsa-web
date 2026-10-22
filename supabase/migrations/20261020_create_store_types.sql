-- ==============================================================================
-- MIGRACIÓN: TABLA DE TIPOS DE CENTROS DE COSTOS (store_types) Y RELACIÓN CON stores
-- ==============================================================================

-- 1. Crear tabla de tipos de centro de costos
CREATE TABLE IF NOT EXISTS public.store_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insertar los tipos iniciales: obra, maquinaria, otro
INSERT INTO public.store_types (code, name, description)
VALUES 
  ('obra', 'Obra', 'Centros de costos de obras de construcción con presupuesto y catálogo de conceptos'),
  ('maquinaria', 'Maquinaria', 'Almacenes y centros de costos de maquinaria, equipos pesados y vehículos'),
  ('otro', 'Otro', 'Almacenes administrativos, oficinas generales, talleres u otros')
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 3. Agregar columna store_type_id a la tabla stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS store_type_id INT REFERENCES public.store_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stores_store_type_id ON public.stores(store_type_id);

-- 4. Clasificación inicial automática de las tiendas existentes:
-- A) Maquinaria: Stores que contienen 'maquinaria' o códigos de maquinaria
UPDATE public.stores
SET store_type_id = (SELECT id FROM public.store_types WHERE code = 'maquinaria')
WHERE store_type_id IS NULL AND (
  LOWER(TRIM(name)) = 'maquinaria'
  OR name ~* '^(M|CG|AT|C|V)\s*0*\d+'
  OR name ~* '^0*30\b'
  OR LOWER(name) LIKE '%taller%'
  OR LOWER(name) LIKE '%mercedez benz%'
  OR LOWER(name) LIKE '%dodge journey%'
  OR LOWER(name) LIKE '%kia sportage%'
  OR LOWER(name) LIKE '%hyundai palisade%'
);

-- B) Obra: Stores que tienen registros en store_insumos o están identificadas como obra
UPDATE public.stores
SET store_type_id = (SELECT id FROM public.store_types WHERE code = 'obra')
WHERE store_type_id IS NULL AND (
  id IN (SELECT DISTINCT store_id FROM public.store_insumos)
  OR LOWER(name) LIKE '%obra%'
  OR LOWER(name) LIKE '%fracc%'
  OR LOWER(name) LIKE '%reserva%'
  OR LOWER(name) LIKE '%pedregal%'
  OR LOWER(name) LIKE '%secope%'
  OR LOWER(name) LIKE '%ruba%'
  OR LOWER(name) LIKE '%4d%'
  OR LOWER(name) LIKE '%jumbo%'
  OR LOWER(name) LIKE '%integra%'
  OR LOWER(name) LIKE '%delta%'
  OR LOWER(name) LIKE '%proveniia%'
  OR LOWER(name) LIKE '%metrocasas%'
  OR LOWER(name) LIKE '%sideapa%'
  OR LOWER(name) LIKE '%peñoles%'
);

-- C) Otro: Todos los demás centros de costos restantes (oficinas, administración, etc.)
UPDATE public.stores
SET store_type_id = (SELECT id FROM public.store_types WHERE code = 'otro')
WHERE store_type_id IS NULL;

-- 5. Comentarios descriptivos
COMMENT ON TABLE public.store_types IS 'Catálogo de tipos de centro de costos / almacenes (obra, maquinaria, otro).';
COMMENT ON COLUMN public.stores.store_type_id IS 'Llave foránea a store_types(id) que clasifica si el almacén es obra, maquinaria u otro.';
