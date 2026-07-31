import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/weekly-reports/approvals
 * Obtiene el listado de reportes semanales que han requerido o están en flujo de autorización,
 * calculando presupuestos por obra, acumulados y montos excedidos por categoría.
 */
export async function GET(request: Request) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status") || "all";
    const storeIdFilter = searchParams.get("store_id");

    let query = supabaseAdmin
      .from("store_weekly_reports")
      .select(`
        *,
        store:stores(id, name),
        requester:users!requested_by(id, full_name, email),
        approver:users!approved_by(id, full_name, email)
      `)
      .not("status", "is", null)
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    if (storeIdFilter) {
      const storeIdNum = parseInt(storeIdFilter, 10);
      if (!isNaN(storeIdNum)) {
        query = query.eq("store_id", storeIdNum);
      }
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error("[weekly-reports approvals GET] Error:", error);
      return NextResponse.json({ error: "Error al consultar solicitudes" }, { status: 500 });
    }

    const storeIds = Array.from(new Set((reports || []).map((r) => r.store_id)));

    // Obtener insumos de todas las obras involucradas
    const insumosMap: Record<number, { manoObra: number; equipo: number }> = {};
    if (storeIds.length > 0) {
      const { data: insumos } = await supabaseAdmin
        .from("store_insumos")
        .select("store_id, categoria, monto_presupuestado")
        .in("store_id", storeIds);

      (insumos || []).forEach((i) => {
        if (!insumosMap[i.store_id]) {
          insumosMap[i.store_id] = { manoObra: 0, equipo: 0 };
        }
        if (i.categoria === "Mano de Obra") {
          insumosMap[i.store_id].manoObra += Number(i.monto_presupuestado) || 0;
        } else if (i.categoria === "Equipo") {
          insumosMap[i.store_id].equipo += Number(i.monto_presupuestado) || 0;
        }
      });
    }

    // Obtener reportes aprobados previos por obra para calcular acumulados
    const approvedReportsMap: Record<number, any[]> = {};
    if (storeIds.length > 0) {
      const { data: approvedReports } = await supabaseAdmin
        .from("store_weekly_reports")
        .select("id, store_id, week_start_date, mano_obra_gasto, equipo_gasto")
        .in("store_id", storeIds)
        .eq("status", "approved");

      (approvedReports || []).forEach((r) => {
        if (!approvedReportsMap[r.store_id]) {
          approvedReportsMap[r.store_id] = [];
        }
        approvedReportsMap[r.store_id].push(r);
      });
    }

    // Formatear cada reporte enriqueciéndolo con presupuestos y excesos calculados
    const formattedReports = (reports || []).map((r: any) => {
      const storeInsumos = insumosMap[r.store_id] || { manoObra: 0, equipo: 0 };
      const priorApproved = (approvedReportsMap[r.store_id] || []).filter((prev) => prev.id !== r.id);

      const prevManoObra = priorApproved.reduce((sum, p) => sum + (Number(p.mano_obra_gasto) || 0), 0);
      const prevEquipo = priorApproved.reduce((sum, p) => sum + (Number(p.equipo_gasto) || 0), 0);

      const acumuladoManoObra = prevManoObra + (Number(r.mano_obra_gasto) || 0);
      const acumuladoEquipo = prevEquipo + (Number(r.equipo_gasto) || 0);

      const presupuestoManoObra = storeInsumos.manoObra;
      const presupuestoEquipo = storeInsumos.equipo;

      const excesoManoObra = presupuestoManoObra > 0
        ? Math.max(0, acumuladoManoObra - presupuestoManoObra)
        : (Number(r.mano_obra_gasto) || 0);

      const excesoEquipo = presupuestoEquipo > 0
        ? Math.max(0, acumuladoEquipo - presupuestoEquipo)
        : (Number(r.equipo_gasto) || 0);

      return {
        ...r,
        store_name: r.store?.name || `Obra #${r.store_id}`,
        requested_by_name: r.requester?.full_name || r.requester?.email || "Desconocido",
        approved_by_name: r.approver?.full_name || r.approver?.email || null,
        presupuesto_mano_obra: presupuestoManoObra,
        acumulado_mano_obra: acumuladoManoObra,
        exceso_mano_obra: excesoManoObra,
        presupuesto_equipo: presupuestoEquipo,
        acumulado_equipo: acumuladoEquipo,
        exceso_equipo: excesoEquipo,
      };
    });

    return NextResponse.json({
      success: true,
      reports: formattedReports,
    });
  } catch (error: unknown) {
    console.error("[weekly-reports approvals GET] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error interno: " + errMsg }, { status: 500 });
  }
}
