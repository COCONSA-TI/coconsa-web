import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { StoreControlObraReport, ControlObraCalculatedReport, ControlObraSummary } from "@/types/database";

function calculateReportTotals(report: StoreControlObraReport): ControlObraCalculatedReport {
  const directos =
    Number(report.egreso_maquinaria_equipo || 0) +
    Number(report.egreso_nomina_directa || 0) +
    Number(report.egreso_seguro_nomina_directa || 0) +
    Number(report.egreso_destajos || 0) +
    Number(report.egreso_materiales || 0) +
    Number(report.egreso_diesel || 0);

  const indirectosBase =
    Number(report.egreso_nomina_indirecta || 0) +
    Number(report.egreso_seguro_nomina_indirecta || 0) +
    Number(report.egreso_gastos_indirectos || 0);

  const gen = Number(report.importe_generado || 0);

  // Porcentaje de campo: (Nómina Indirecta + Seguro Indirecto + Gastos Indirectos) / Importe Generado
  const pctCampo = gen > 0 ? (indirectosBase / gen) * 100 : 0;
  const pctOficina = Number(report.pct_indirecto_oficina || 3.00);

  const montoCampo = indirectosBase;
  const montoOficina = gen * (pctOficina / 100);

  const totalEgresos = directos + indirectosBase + montoOficina;
  const importeUtilidad = gen - totalEgresos;
  const pctUtilidad = gen > 0 ? (importeUtilidad / gen) * 100 : 0;

  return {
    ...report,
    pct_indirecto_campo: pctCampo,
    total_egresos_directos: directos,
    total_egresos_indirectos: indirectosBase,
    monto_indirecto_campo: montoCampo,
    monto_indirecto_oficina: montoOficina,
    total_egresos: totalEgresos,
    importe_utilidad: importeUtilidad,
    pct_utilidad: pctUtilidad,
  };
}

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

    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, name, pct_indirecto_campo, pct_indirecto_oficina")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: "Centro de Costos no encontrado" }, { status: 404 });
    }

    const settings = {
      pct_indirecto_campo: store.pct_indirecto_campo ?? 4.33,
      pct_indirecto_oficina: store.pct_indirecto_oficina ?? 3.00,
    };

    // Consultar reportes de Control de Obra
    const { data: rawReports, error: reportsError } = await supabaseAdmin
      .from("store_control_obra_reports")
      .select("*")
      .eq("store_id", storeId)
      .order("semana_numero", { ascending: true });

    if (reportsError) {
      console.error("[control-obra GET] Error al consultar reportes:", reportsError);
      return NextResponse.json({ error: "Error al obtener reportes de control de obra" }, { status: 500 });
    }

    // Consultar reportes semanales manuales de Mano de Obra y Equipo para sincronización
    const { data: manualWeeklyReports } = await supabaseAdmin
      .from("store_weekly_reports")
      .select("week_start_date, mano_obra_gasto, equipo_gasto, status")
      .eq("store_id", storeId);

    const manualReportsByDate = new Map<string, { manoObra: number; equipo: number }>();
    (manualWeeklyReports || []).forEach((wr) => {
      if (wr.week_start_date) {
        manualReportsByDate.set(wr.week_start_date, {
          manoObra: Number(wr.mano_obra_gasto || 0),
          equipo: Number(wr.equipo_gasto || 0),
        });
      }
    });

    const calculatedReports = (rawReports || []).map((r) => {
      const manualData = manualReportsByDate.get(r.fecha_inicio);
      const mergedReport = { ...r };

      if (manualData) {
        if (!mergedReport.egreso_nomina_directa || mergedReport.egreso_nomina_directa === 0) {
          mergedReport.egreso_nomina_directa = manualData.manoObra;
        }
        if (!mergedReport.egreso_maquinaria_equipo || mergedReport.egreso_maquinaria_equipo === 0) {
          mergedReport.egreso_maquinaria_equipo = manualData.equipo;
        }
      }

      return calculateReportTotals(mergedReport as StoreControlObraReport);
    });

    let totalGenerado = 0;
    let totalDirectos = 0;
    let totalIndirectosBase = 0;
    let totalMontoCampo = 0;
    let totalMontoOficina = 0;
    let totalEgresos = 0;
    let totalUtilidad = 0;
    let ultimoAvance = 0;

    calculatedReports.forEach((r) => {
      totalGenerado += r.importe_generado;
      totalDirectos += r.total_egresos_directos;
      totalIndirectosBase += r.total_egresos_indirectos;
      totalMontoCampo += r.monto_indirecto_campo;
      totalMontoOficina += r.monto_indirecto_oficina;
      totalEgresos += r.total_egresos;
      totalUtilidad += r.importe_utilidad;
      if (r.pct_avance_programa > 0) {
        ultimoAvance = r.pct_avance_programa;
      }
    });

    const summary: ControlObraSummary = {
      total_generado: totalGenerado,
      total_egresos_directos: totalDirectos,
      total_egresos_indirectos: totalIndirectosBase,
      total_indirectos_campo: totalMontoCampo,
      total_indirectos_oficina: totalMontoOficina,
      total_egresos: totalEgresos,
      total_utilidad: totalUtilidad,
      pct_utilidad_global: totalGenerado > 0 ? (totalUtilidad / totalGenerado) * 100 : 0,
      semanas_count: calculatedReports.length,
      ultimo_pct_avance: ultimoAvance,
    };

    return NextResponse.json({
      success: true,
      store: { id: store.id, name: store.name },
      settings,
      reports: calculatedReports,
      summary,
    });
  } catch (error: unknown) {
    console.error("[control-obra GET] Error inesperado:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("is_department_head, department_id")
      .eq("id", session!.userId)
      .single();

    let canWrite = session!.role === "admin";
    if (!canWrite && userData?.is_department_head && userData.department_id) {
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("approval_order")
        .eq("id", userData.department_id)
        .single();
      const ao = dept?.approval_order ?? 0;
      canWrite = ao === 1 || ao >= 3;
    }

    if (!canWrite) {
      return NextResponse.json({ error: "Permisos insuficientes para capturar en Control de Obra" }, { status: 403 });
    }

    const body = await request.json();
    const {
      semana_numero,
      fecha_inicio,
      fecha_fin,
      importe_generado,
      egreso_maquinaria_equipo,
      egreso_nomina_directa,
      egreso_seguro_nomina_directa,
      egreso_destajos,
      egreso_materiales,
      egreso_diesel,
      egreso_nomina_indirecta,
      egreso_seguro_nomina_indirecta,
      egreso_gastos_indirectos,
      pct_indirecto_campo,
      pct_indirecto_oficina,
      pct_avance_programa,
      comments,
    } = body;

    if (!semana_numero || !fecha_inicio || !fecha_fin) {
      return NextResponse.json({ error: "semana_numero, fecha_inicio y fecha_fin son requeridos" }, { status: 400 });
    }

    const payload = {
      store_id: storeId,
      semana_numero: Number(semana_numero),
      fecha_inicio,
      fecha_fin,
      importe_generado: Number(importe_generado || 0),
      egreso_maquinaria_equipo: Number(egreso_maquinaria_equipo || 0),
      egreso_nomina_directa: Number(egreso_nomina_directa || 0),
      egreso_seguro_nomina_directa: Number(egreso_seguro_nomina_directa || 0),
      egreso_destajos: Number(egreso_destajos || 0),
      egreso_materiales: Number(egreso_materiales || 0),
      egreso_diesel: Number(egreso_diesel || 0),
      egreso_nomina_indirecta: Number(egreso_nomina_indirecta || 0),
      egreso_seguro_nomina_indirecta: Number(egreso_seguro_nomina_indirecta || 0),
      egreso_gastos_indirectos: Number(egreso_gastos_indirectos || 0),
      pct_indirecto_campo: Number(pct_indirecto_campo ?? 4.33),
      pct_indirecto_oficina: Number(pct_indirecto_oficina ?? 3.00),
      pct_avance_programa: Number(pct_avance_programa || 0),
      comments: comments || null,
      updated_at: new Date().toISOString(),
    };

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("store_control_obra_reports")
      .upsert(payload, { onConflict: "store_id,semana_numero" })
      .select()
      .single();

    if (upsertError) {
      console.error("[control-obra POST] Error en upsert:", upsertError);
      return NextResponse.json({ error: "Error al guardar el reporte semanal: " + upsertError.message }, { status: 500 });
    }

    // Sincronizar también con store_weekly_reports si aplica
    if (fecha_inicio) {
      await supabaseAdmin
        .from("store_weekly_reports")
        .upsert({
          store_id: storeId,
          week_start_date: fecha_inicio,
          mano_obra_gasto: Number(egreso_nomina_directa || 0),
          equipo_gasto: Number(egreso_maquinaria_equipo || 0),
          comments: comments || "Sincronizado desde Control de Obra",
          status: "approved",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "store_id,week_start_date",
        });
    }

    const calculated = calculateReportTotals(upserted as StoreControlObraReport);

    return NextResponse.json({
      success: true,
      message: `Semana ${semana_numero} guardada correctamente`,
      report: calculated,
    });
  } catch (error: unknown) {
    console.error("[control-obra POST] Error inesperado:", error);
    return NextResponse.json({ error: "Error procesando solicitud" }, { status: 500 });
  }
}

export async function PATCH(
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
    const { pct_indirecto_campo, pct_indirecto_oficina } = body;

    const { error: updateError } = await supabaseAdmin
      .from("stores")
      .update({
        pct_indirecto_campo: Number(pct_indirecto_campo ?? 4.33),
        pct_indirecto_oficina: Number(pct_indirecto_oficina ?? 3.00),
      })
      .eq("id", storeId);

    if (updateError) {
      return NextResponse.json({ error: "Error actualizando configuración de la obra" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Configuración de indirectos actualizada",
      settings: {
        pct_indirecto_campo: Number(pct_indirecto_campo),
        pct_indirecto_oficina: Number(pct_indirecto_oficina),
      },
    });
  } catch (error: unknown) {
    console.error("[control-obra PATCH] Error:", error);
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    const url = new URL(request.url);
    const reportIdStr = url.searchParams.get("reportId");

    if (!reportIdStr) {
      return NextResponse.json({ error: "reportId requerido" }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("store_control_obra_reports")
      .delete()
      .eq("id", parseInt(reportIdStr, 10))
      .eq("store_id", storeId);

    if (deleteError) {
      return NextResponse.json({ error: "Error al eliminar el registro" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Semana eliminada correctamente",
    });
  } catch (error: unknown) {
    console.error("[control-obra DELETE] Error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
