-- ==============================================================================
-- MIGRACIÓN: ASIGNACIÓN DE CENTROS DE COSTOS Y PERMISOS DE VISIBILIDAD DE USUARIOS
-- ==============================================================================

-- 1. Crear tabla intermedia user_stores
CREATE TABLE IF NOT EXISTS public.user_stores (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id BIGINT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stores_user_id ON public.user_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stores_store_id ON public.user_stores(store_id);

-- 2. Agregar columnas de permisos a la tabla users
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS all_stores_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_all_store_orders BOOLEAN DEFAULT FALSE;

-- 3. Habilitar all_stores_access por defecto para los administradores existentes
-- para que no pierdan acceso inmediato hasta que se les configure manualmente si se desea probar
UPDATE public.users u
SET all_stores_access = TRUE, can_view_all_store_orders = TRUE
FROM public.roles r
WHERE u.role = r.id AND LOWER(TRIM(r.name)) = 'admin';

-- 4. Comentarios descriptivos
COMMENT ON TABLE public.user_stores IS 'Relación M:N de centros de costos / obras asignadas a cada usuario.';
COMMENT ON COLUMN public.users.all_stores_access IS 'Si es TRUE, el usuario tiene acceso global a todos los centros de costos.';
COMMENT ON COLUMN public.users.can_view_all_store_orders IS 'Si es TRUE, el usuario puede ver todas las órdenes de sus centros de costos asignados y su histórico completo. Si es FALSE, solo ve sus propias órdenes.';
