-- Migration: Unificar centros de costos "Colector caed" (id 94) en "Colector CAED" (id 93) y desactivar duplicado
-- Fecha: 2026-09-14

-- 1. Asegurar columna is_active en la tabla stores
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Migrar todas las referencias existentes que apunten a store_id = 94 hacia store_id = 93
UPDATE orders SET store_id = 93 WHERE store_id = 94;
UPDATE needs_lists SET store_id = 93 WHERE store_id = 94;
UPDATE store_insumos SET store_id = 93 WHERE store_id = 94;
UPDATE store_budget_uploads SET store_id = 93 WHERE store_id = 94;
UPDATE store_weekly_reports SET store_id = 93 WHERE store_id = 94;

-- 3. Desactivar y renombrar el centro de costos duplicado para que nunca más aparezca en listas ni se use
UPDATE stores 
SET 
  name = '[INACTIVO] Colector caed',
  is_active = false
WHERE id = 94;

-- 4. Asegurar que el centro de costos definitivo (id 93) esté activo y con el nombre estándar
UPDATE stores 
SET 
  name = 'Colector CAED',
  is_active = true
WHERE id = 93;
