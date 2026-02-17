-- Migración: Agregar campo is_active a la tabla users
-- Fecha: 2026-02-17
-- Descripción: Permite soft delete de usuarios (inhabilitar en lugar de eliminar)

-- Agregar columna is_active si no existe
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Actualizar todos los usuarios existentes a activos
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Crear índice para búsquedas rápidas por estado
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Comentario de la columna
COMMENT ON COLUMN users.is_active IS 'Indica si el usuario está activo. false = soft deleted';
