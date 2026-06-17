import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { StoreInsumoSearchResult } from "@/types/database";

/**
 * GET /api/v1/stores/[id]/insumos
 * Devuelve los insumos presupuestados de una obra para autocompletar
 * en el formulario de Órdenes de Compra.
 *
 * Query params opcionales:
 *   - query: string de búsqueda (clave o descripción)
 *   - categoria: filtrar por categoría ('Materiales', 'Mano de Obra', etc.)
 *   - limit: número máximo de resultados (default: 50)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requirePermission("orders", "create");
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() || "";
    const categoria = url.searchParams.get("categoria") || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

    // Verificar que el store existe
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (!store) {
      return NextResponse.json({ error: "Centro de Costos no encontrado" }, { status: 404 });
    }

    // Construir la query base
    let dbQuery = supabaseAdmin
      .from("store_insumos")
      .select("*")
      .eq("store_id", storeId)
      .order("categoria", { ascending: true })
      .order("clave", { ascending: true })
      .limit(limit);

    if (categoria) {
      dbQuery = dbQuery.eq("categoria", categoria);
    }

    if (query) {
      // Buscar en clave O en descripción (case-insensitive)
      dbQuery = dbQuery.or(
        `clave.ilike.%${query}%,descripcion.ilike.%${query}%`
      );
    }

    const { data: insumos, error } = await dbQuery;

    if (error) {
      console.error("[stores/insumos] Error al buscar insumos:", error);
      return NextResponse.json(
        { error: "Error al buscar insumos: " + error.message },
        { status: 500 }
      );
    }

    // Calcular disponibilidad para cada insumo
    const insumosConDisponibilidad: StoreInsumoSearchResult[] = (insumos ?? []).map((ins) => {
      const disponible =
        ins.cantidad_presupuestada - ins.cantidad_solicitada - ins.cantidad_comprada;
      return {
        ...ins,
        cantidad_disponible: Math.max(0, disponible),
        agotado: disponible <= 0,
      };
    });

    return NextResponse.json({
      success: true,
      store: { id: storeId, name: store.name },
      hasPresupuesto: (insumos?.length ?? 0) > 0,
      insumos: insumosConDisponibilidad,
      total: insumos?.length ?? 0,
    });
  } catch (error: unknown) {
    console.error("[stores/insumos] Error inesperado:", error);
    return NextResponse.json({ error: "Error al obtener los insumos" }, { status: 500 });
  }
}
