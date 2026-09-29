-- ==============================================================================
-- SISTEMA DE PRESUPUESTOS: GASTOS INDIRECTOS PARA LISTAS DE NECESIDADES
-- ==============================================================================
-- 1. Función `gastos_indirectos`: Encuentra todos los insumos pedidos y aprobados en
--    listas de necesidades que NO estaban en el presupuesto original, y los da de alta
--    en `store_insumos` con categoría 'Gastos Indirectos' y prefijo 'IND-'.
-- 2. Función `adicionales`: Exclusiva para órdenes de compra, crea insumos con
--    categoría 'Adicionales' y prefijo 'ADIC-'.
-- 3. Migración de datos existentes: Convierte los insumos de listas de necesidades
--    que se hubieran creado previamente con 'Adicionales' a 'Gastos Indirectos'.
-- 4. Función `recalcular_presupuesto_obra`: Sincroniza tanto adicionales como
--    gastos indirectos con `store_insumos`.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIÓN: gastos_indirectos(p_store_id INT DEFAULT NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gastos_indirectos(p_store_id INT DEFAULT NULL)
RETURNS TABLE (
  obra_id INT,
  clave_indirecto VARCHAR,
  descripcion_insumo TEXT,
  unidad_insumo VARCHAR,
  cantidad_aprobada NUMERIC,
  monto_agregado NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH items_no_presupuestados AS (
    -- Conceptos de listas de necesidades aprobadas/en proceso/pagadas que no existen en store_insumos
    SELECT 
      nl.store_id,
      TRIM(COALESCE(item->>'nombre', item->>'descripcion', 'Gasto Indirecto')) AS descripcion,
      COALESCE(NULLIF(TRIM(item->>'unidad'), ''), 'pza')::varchar AS unidad,
      COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(item->>'cantidad', item->>'quantity', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) AS cantidad,
      COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(item->>'precioUnitario', item->>'precio_unitario', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) AS precio_unitario,
      COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(item->>'precioTotal', item->>'total', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) AS precio_total
    FROM needs_lists nl
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN nl.items IS NULL OR TRIM(nl.items::text) IN ('', 'null', '[]', '""') THEN '[]'::jsonb
        WHEN nl.items::text ~ '^\s*\[.*\]\s*$' THEN nl.items::text::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS item
    WHERE nl.store_id IS NOT NULL
      AND (p_store_id IS NULL OR nl.store_id = p_store_id)
      AND LOWER(TRIM(COALESCE(nl.status, ''))) IN ('approved', 'aprobada', 'completed', 'completada', 'in_progress', 'en_proceso', 'paid', 'pagada', 'verifying', 'verified')
      AND COALESCE(nl.is_definitive_rejection, FALSE) = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM store_insumos si
        WHERE si.store_id = nl.store_id
          AND si.activo = TRUE
          AND (
            (NULLIF(TRIM(item->>'insumo_clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'insumo_clave')))
            OR (NULLIF(TRIM(item->>'clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'clave')))
            OR LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', '')))
            OR LOWER(TRIM(si.descripcion)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', '')))
          )
      )
  ),
  agrupados AS (
    SELECT 
      inp.store_id,
      inp.descripcion,
      MAX(inp.unidad)::varchar AS unidad,
      SUM(inp.cantidad)::numeric AS total_cantidad,
      MAX(inp.precio_unitario)::numeric AS precio_unitario,
      CASE 
        WHEN SUM(inp.precio_total) > 0 THEN SUM(inp.precio_total)::numeric
        ELSE (SUM(inp.cantidad) * MAX(inp.precio_unitario))::numeric
      END AS total_monto
    FROM items_no_presupuestados inp
    WHERE inp.descripcion IS NOT NULL AND inp.descripcion <> ''
    GROUP BY inp.store_id, LOWER(inp.descripcion), inp.descripcion
  ),
  con_clave AS (
    SELECT 
      a.store_id,
      ('IND-' || LPAD((
        COALESCE(
          (SELECT MAX(NULLIF(REGEXP_REPLACE(si.clave, '^IND-', ''), ''))::int 
           FROM store_insumos si 
           WHERE si.store_id = a.store_id AND si.clave ~ '^IND-[0-9]+$'), 
          0
        ) + ROW_NUMBER() OVER (PARTITION BY a.store_id ORDER BY a.descripcion)
      )::text, 4, '0'))::varchar AS nueva_clave,
      a.descripcion,
      a.unidad,
      a.total_cantidad,
      a.precio_unitario,
      a.total_monto
    FROM agrupados a
  ),
  insertados AS (
    INSERT INTO store_insumos (
      store_id,
      clave,
      descripcion,
      unidad,
      cantidad_presupuestada,
      costo_unitario,
      costo_autorizado,
      monto_presupuestado,
      monto_autorizado,
      porcentaje,
      categoria,
      cantidad_solicitada,
      cantidad_comprada,
      activo,
      created_at,
      updated_at
    )
    SELECT 
      c.store_id,
      c.nueva_clave,
      c.descripcion,
      c.unidad,
      c.total_cantidad,
      c.precio_unitario,
      c.precio_unitario,
      c.total_monto,
      c.total_monto,
      0,
      'Gastos Indirectos',
      0, -- se actualizará en recalcular_presupuesto_obra
      0,
      TRUE,
      NOW(),
      NOW()
    FROM con_clave c
    RETURNING 
      store_insumos.store_id,
      store_insumos.clave::varchar,
      store_insumos.descripcion,
      store_insumos.unidad::varchar,
      store_insumos.cantidad_presupuestada,
      store_insumos.monto_presupuestado
  )
  SELECT 
    i.store_id AS obra_id,
    i.clave AS clave_indirecto,
    i.descripcion AS descripcion_insumo,
    i.unidad AS unidad_insumo,
    i.cantidad_presupuestada AS cantidad_aprobada,
    i.monto_presupuestado AS monto_agregado
  FROM insertados i;

END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN: adicionales(p_store_id INT DEFAULT NULL) - Solo Órdenes de Compra
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION adicionales(p_store_id INT DEFAULT NULL)
RETURNS TABLE (
  obra_id INT,
  clave_adicional VARCHAR,
  descripcion_insumo TEXT,
  unidad_insumo VARCHAR,
  cantidad_aprobada NUMERIC,
  monto_agregado NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH items_no_presupuestados AS (
    -- Conceptos de órdenes de compra aprobadas/en proceso que no existen en store_insumos
    SELECT 
      o.store_id,
      TRIM(COALESCE(item->>'nombre', item->>'descripcion', 'Insumo Adicional')) AS descripcion,
      COALESCE(NULLIF(TRIM(item->>'unidad'), ''), 'pza')::varchar AS unidad,
      COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(item->>'cantidad', item->>'quantity', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) AS cantidad,
      COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(item->>'precioUnitario', item->>'precio_unitario', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) AS precio_unitario,
      COALESCE(NULLIF(REGEXP_REPLACE(COALESCE(item->>'precioTotal', item->>'total', '0'), '[^0-9.]', '', 'g'), '')::numeric, 0) AS precio_total
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN o.items IS NULL OR TRIM(o.items::text) IN ('', 'null', '[]', '""') THEN '[]'::jsonb
        WHEN o.items::text ~ '^\s*\[.*\]\s*$' THEN o.items::text::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS item
    WHERE o.store_id IS NOT NULL
      AND (p_store_id IS NULL OR o.store_id = p_store_id)
      AND LOWER(TRIM(COALESCE(o.status, ''))) IN ('approved', 'aprobada', 'completed', 'completada', 'in_progress', 'en_proceso')
      AND COALESCE(o.is_definitive_rejection, FALSE) = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM store_insumos si
        WHERE si.store_id = o.store_id
          AND si.activo = TRUE
          AND (
            (NULLIF(TRIM(item->>'insumo_clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'insumo_clave')))
            OR (NULLIF(TRIM(item->>'clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'clave')))
            OR LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', '')))
            OR LOWER(TRIM(si.descripcion)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', '')))
          )
      )
  ),
  agrupados AS (
    SELECT 
      inp.store_id,
      inp.descripcion,
      MAX(inp.unidad)::varchar AS unidad,
      SUM(inp.cantidad)::numeric AS total_cantidad,
      MAX(inp.precio_unitario)::numeric AS precio_unitario,
      CASE 
        WHEN SUM(inp.precio_total) > 0 THEN SUM(inp.precio_total)::numeric
        ELSE (SUM(inp.cantidad) * MAX(inp.precio_unitario))::numeric
      END AS total_monto
    FROM items_no_presupuestados inp
    WHERE inp.descripcion IS NOT NULL AND inp.descripcion <> ''
    GROUP BY inp.store_id, LOWER(inp.descripcion), inp.descripcion
  ),
  con_clave AS (
    SELECT 
      a.store_id,
      ('ADIC-' || LPAD((
        COALESCE(
          (SELECT MAX(NULLIF(REGEXP_REPLACE(si.clave, '^ADIC-', ''), ''))::int 
           FROM store_insumos si 
           WHERE si.store_id = a.store_id AND si.clave ~ '^ADIC-[0-9]+$'), 
          0
        ) + ROW_NUMBER() OVER (PARTITION BY a.store_id ORDER BY a.descripcion)
      )::text, 4, '0'))::varchar AS nueva_clave,
      a.descripcion,
      a.unidad,
      a.total_cantidad,
      a.precio_unitario,
      a.total_monto
    FROM agrupados a
  ),
  insertados AS (
    INSERT INTO store_insumos (
      store_id,
      clave,
      descripcion,
      unidad,
      cantidad_presupuestada,
      costo_unitario,
      costo_autorizado,
      monto_presupuestado,
      monto_autorizado,
      porcentaje,
      categoria,
      cantidad_solicitada,
      cantidad_comprada,
      activo,
      created_at,
      updated_at
    )
    SELECT 
      c.store_id,
      c.nueva_clave,
      c.descripcion,
      c.unidad,
      c.total_cantidad,
      c.precio_unitario,
      c.precio_unitario,
      c.total_monto,
      c.total_monto,
      0,
      'Adicionales',
      0, -- se actualizará en recalcular_presupuesto_obra
      0,
      TRUE,
      NOW(),
      NOW()
    FROM con_clave c
    RETURNING 
      store_insumos.store_id,
      store_insumos.clave::varchar,
      store_insumos.descripcion,
      store_insumos.unidad::varchar,
      store_insumos.cantidad_presupuestada,
      store_insumos.monto_presupuestado
  )
  SELECT 
    i.store_id AS obra_id,
    i.clave AS clave_adicional,
    i.descripcion AS descripcion_insumo,
    i.unidad AS unidad_insumo,
    i.cantidad_presupuestada AS cantidad_aprobada,
    i.monto_presupuestado AS monto_agregado
  FROM insertados i;

END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. MIGRACIÓN: Actualizar insumos de listas de necesidades ya existentes
-- ------------------------------------------------------------------------------
UPDATE store_insumos si
SET categoria = 'Gastos Indirectos',
    clave = REGEXP_REPLACE(si.clave, '^ADIC-', 'IND-'),
    updated_at = NOW()
WHERE si.categoria = 'Adicionales'
  AND (
    si.clave ~ '^ADIC-'
    OR si.descripcion ILIKE '%indirecto%'
  )
  AND EXISTS (
    SELECT 1 FROM needs_lists nl
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN nl.items IS NULL OR TRIM(nl.items::text) IN ('', 'null', '[]', '""') THEN '[]'::jsonb
        WHEN nl.items::text ~ '^\s*\[.*\]\s*$' THEN nl.items::text::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS item
    WHERE nl.store_id = si.store_id
      AND (
        LOWER(TRIM(si.descripcion)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', '')))
        OR LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'insumo_clave', item->>'clave', '')))
        OR LOWER(TRIM(REGEXP_REPLACE(si.clave, '^IND-', 'ADIC-'))) = LOWER(TRIM(COALESCE(item->>'insumo_clave', item->>'clave', '')))
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN o.items IS NULL OR TRIM(o.items::text) IN ('', 'null', '[]', '""') THEN '[]'::jsonb
        WHEN o.items::text ~ '^\s*\[.*\]\s*$' THEN o.items::text::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS item
    WHERE o.store_id = si.store_id
      AND (
        LOWER(TRIM(si.descripcion)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', '')))
        OR LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'insumo_clave', item->>'clave', '')))
      )
  );

-- ------------------------------------------------------------------------------
-- 4. FUNCIÓN: recalcular_presupuesto_obra(p_store_id INT DEFAULT NULL)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalcular_presupuesto_obra(p_store_id INT DEFAULT NULL)
RETURNS TABLE (
  obra_id INT,
  insumos_con_solicitudes INT,
  total_cantidad_solicitada NUMERIC
) AS $$
BEGIN
  -- Paso 1A: Incorporar conceptos adicionales de órdenes de compra
  PERFORM adicionales(p_store_id);

  -- Paso 1B: Incorporar conceptos de gastos indirectos de listas de necesidades
  PERFORM gastos_indirectos(p_store_id);

  -- Paso 2: Reiniciar cantidad_solicitada en 0 para las obras a recalcular
  UPDATE store_insumos si
  SET cantidad_solicitada = 0,
      updated_at = NOW()
  WHERE (p_store_id IS NULL OR si.store_id = p_store_id);

  -- Paso 3: Consolidar cantidades buscando coincidencias por clave, descripción o insumo_clave
  WITH items_ordenes_historicas AS (
    SELECT 
      o.store_id,
      (
        SELECT si.id 
        FROM store_insumos si 
        WHERE si.store_id = o.store_id 
          AND si.activo = TRUE
          AND (
            (NULLIF(TRIM(item->>'insumo_clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'insumo_clave')))
            OR (NULLIF(TRIM(item->>'clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'clave')))
            OR (LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', ''))))
            OR (LOWER(TRIM(si.descripcion)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', ''))))
          )
        ORDER BY 
          CASE 
            WHEN NULLIF(TRIM(item->>'insumo_clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'insumo_clave')) THEN 1
            WHEN NULLIF(TRIM(item->>'clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'clave')) THEN 2
            WHEN LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', ''))) THEN 3
            ELSE 4
          END
        LIMIT 1
      ) AS matched_insumo_id,
      COALESCE(
        NULLIF(REGEXP_REPLACE(COALESCE(item->>'cantidad', item->>'quantity', '0'), '[^0-9.]', '', 'g'), '')::numeric,
        0
      ) AS cantidad
    FROM orders o
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN o.items IS NULL OR TRIM(o.items::text) IN ('', 'null', '[]', '""') THEN '[]'::jsonb
        WHEN o.items::text ~ '^\s*\[.*\]\s*$' THEN o.items::text::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS item
    WHERE o.store_id IS NOT NULL
      AND (p_store_id IS NULL OR o.store_id = p_store_id)
      AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('rejected', 'rechazada', 'rechazado', 'cancelada', 'cancelado', 'cancelled', 'canceled')
      AND COALESCE(o.is_definitive_rejection, FALSE) = FALSE
  ),
  items_necesidades_historicas AS (
    SELECT 
      nl.store_id,
      (
        SELECT si.id 
        FROM store_insumos si 
        WHERE si.store_id = nl.store_id 
          AND si.activo = TRUE
          AND (
            (NULLIF(TRIM(item->>'insumo_clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'insumo_clave')))
            OR (NULLIF(TRIM(item->>'clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'clave')))
            OR (LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', ''))))
            OR (LOWER(TRIM(si.descripcion)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', ''))))
          )
        ORDER BY 
          CASE 
            WHEN NULLIF(TRIM(item->>'insumo_clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'insumo_clave')) THEN 1
            WHEN NULLIF(TRIM(item->>'clave'), '') IS NOT NULL AND LOWER(TRIM(si.clave)) = LOWER(TRIM(item->>'clave')) THEN 2
            WHEN LOWER(TRIM(si.clave)) = LOWER(TRIM(COALESCE(item->>'nombre', item->>'descripcion', ''))) THEN 3
            ELSE 4
          END
        LIMIT 1
      ) AS matched_insumo_id,
      COALESCE(
        NULLIF(REGEXP_REPLACE(COALESCE(item->>'cantidad', item->>'quantity', '0'), '[^0-9.]', '', 'g'), '')::numeric,
        0
      ) AS cantidad
    FROM needs_lists nl
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE 
        WHEN nl.items IS NULL OR TRIM(nl.items::text) IN ('', 'null', '[]', '""') THEN '[]'::jsonb
        WHEN nl.items::text ~ '^\s*\[.*\]\s*$' THEN nl.items::text::jsonb 
        ELSE '[]'::jsonb 
      END
    ) AS item
    WHERE nl.store_id IS NOT NULL
      AND (p_store_id IS NULL OR nl.store_id = p_store_id)
      AND LOWER(TRIM(COALESCE(nl.status, ''))) NOT IN ('rejected', 'rechazada', 'rechazado', 'cancelada', 'cancelado', 'cancelled', 'canceled')
      AND COALESCE(nl.is_definitive_rejection, FALSE) = FALSE
  ),
  todos_los_items AS (
    SELECT matched_insumo_id, cantidad FROM items_ordenes_historicas WHERE matched_insumo_id IS NOT NULL
    UNION ALL
    SELECT matched_insumo_id, cantidad FROM items_necesidades_historicas WHERE matched_insumo_id IS NOT NULL
  ),
  totales_consolidados AS (
    SELECT 
      matched_insumo_id AS insumo_id,
      SUM(cantidad) AS total_solicitado
    FROM todos_los_items
    GROUP BY matched_insumo_id
  )
  -- Paso 4: Actualizar store_insumos por Primary Key
  UPDATE store_insumos si
  SET 
    cantidad_solicitada = t.total_solicitado,
    updated_at = NOW()
  FROM totales_consolidados t
  WHERE si.id = t.insumo_id;

  -- Paso 5: Devolver resumen de las obras procesadas
  RETURN QUERY
  SELECT 
    si.store_id AS obra_id,
    COUNT(*)::INT AS insumos_con_solicitudes,
    COALESCE(SUM(si.cantidad_solicitada), 0)::NUMERIC AS total_cantidad_solicitada
  FROM store_insumos si
  WHERE (p_store_id IS NULL OR si.store_id = p_store_id)
    AND si.cantidad_solicitada > 0
  GROUP BY si.store_id;

END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. EJECUCIÓN INMEDIATA PARA APLICAR CAMBIOS
-- ------------------------------------------------------------------------------
SELECT * FROM adicionales(NULL);
SELECT * FROM gastos_indirectos(NULL);
SELECT * FROM recalcular_presupuesto_obra(NULL);
