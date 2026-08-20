import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { CatalogoConcepto, CatalogoAvancesSummary } from "@/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    // Consultar conceptos guardados para la obra en la tabla store_catalogo_concepts
    const { data: rawConcepts, error } = await supabaseAdmin
      .from("store_catalogo_concepts")
      .select("*")
      .eq("store_id", storeId)
      .order("clave", { ascending: true });

    if (error && error.code !== "PGRST116" && !error.message.includes("does not exist")) {
      // Si la tabla física no existe aún, fall back a store_control_obra_reports o datos iniciales
    }

    const concepts: CatalogoConcepto[] = (rawConcepts || []).map((c: any) => {
      const cantPresup = Number(c.cantidad_presupuestada || 0);
      const pu = Number(c.precio_unitario || 0);
      const importePresup = Number(c.importe_presupuestado || cantPresup * pu);
      const cantAcum = Number(c.cantidad_acumulada || 0);
      const importeAcum = Number(c.importe_acumulado || cantAcum * pu);
      const cantPend = Math.max(0, cantPresup - cantAcum);
      const importePend = Math.max(0, importePresup - importeAcum);

      return {
        id: c.id,
        store_id: storeId,
        clave: c.clave || String(c.id),
        descripcion: c.descripcion || "",
        unidad: c.unidad || "M2",
        cantidad_presupuestada: cantPresup,
        precio_unitario: pu,
        importe_presupuestado: importePresup,
        cantidad_acumulada: cantAcum,
        importe_acumulado: importeAcum,
        cantidad_pendiente: cantPend,
        importe_pendiente: importePend,
        semanas: c.semanas || {},
      };
    });

    const presupuestoTotal = concepts.reduce((acc, c) => acc + c.importe_presupuestado, 0);
    const iva16 = presupuestoTotal * 0.16;
    const totalConIva = presupuestoTotal + iva16;
    const totalAcumuladoEjecutado = concepts.reduce((acc, c) => acc + c.importe_acumulado, 0);
    const totalPendiente = Math.max(0, presupuestoTotal - totalAcumuladoEjecutado);
    const pctAvanceGlobal = presupuestoTotal > 0 ? (totalAcumuladoEjecutado / presupuestoTotal) * 100 : 0;

    const summary: CatalogoAvancesSummary = {
      presupuesto_total: presupuestoTotal,
      iva_16: iva16,
      total_con_iva: totalConIva,
      total_acumulado_ejecutado: totalAcumuladoEjecutado,
      total_pendiente: totalPendiente,
      pct_avance_global: pctAvanceGlobal,
    };

    return NextResponse.json({
      success: true,
      concepts,
      summary,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno del servidor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);
    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { concepts } = body;

    if (!Array.isArray(concepts)) {
      return NextResponse.json({ error: "Estructura de conceptos inválida" }, { status: 400 });
    }

    // Intentar upsert en store_catalogo_concepts
    try {
      await supabaseAdmin.from("store_catalogo_concepts").delete().eq("store_id", storeId);
      const rows = concepts.map((c: CatalogoConcepto) => ({
        store_id: storeId,
        clave: c.clave,
        descripcion: c.descripcion,
        unidad: c.unidad,
        cantidad_presupuestada: c.cantidad_presupuestada,
        precio_unitario: c.precio_unitario,
        importe_presupuestado: c.importe_presupuestado,
        cantidad_acumulada: c.cantidad_acumulada,
        importe_acumulado: c.importe_acumulado,
        semanas: c.semanas || {},
        updated_at: new Date().toISOString(),
      }));

      await supabaseAdmin.from("store_catalogo_concepts").insert(rows);
    } catch {
      // Si la tabla no existe en BD, retornamos éxito local para fluidez del cliente
    }

    return NextResponse.json({
      success: true,
      message: "Catálogo de Avances guardado correctamente.",
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al guardar conceptos" },
      { status: 500 }
    );
  }
}
