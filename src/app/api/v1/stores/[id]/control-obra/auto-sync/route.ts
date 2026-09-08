import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

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

    const body = await request.json().catch(() => ({}));
    const reqFechaInicio = body?.fecha_inicio ? String(body.fecha_inicio).split("T")[0] : null;
    const reqFechaFin = body?.fecha_fin ? String(body.fecha_fin).split("T")[0] : null;

    // 1. Obtener órdenes de compra aprobadas/pagadas para este centro de costos
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, created_at, date, status, total, subtotal, items, is_piecework")
      .eq("store_id", storeId)
      .in("status", ["approved", "paid", "completed"]);

    if (ordersError) {
      console.error("[auto-sync POST] Error al consultar órdenes:", ordersError);
    }

    // 2. Obtener reportes semanales manuales (Mano de Obra / Equipo)
    const { data: weeklyLogs } = await supabaseAdmin
      .from("store_weekly_reports")
      .select("*")
      .eq("store_id", storeId);

    // 3. Consultar semanas existentes en Control de Obra
    const { data: controlReports } = await supabaseAdmin
      .from("store_control_obra_reports")
      .select("*")
      .eq("store_id", storeId);

    const weeklyLogsMap = new Map<string, { manoObra: number; equipo: number }>();
    (weeklyLogs || []).forEach((w) => {
      if (w.week_start_date) {
        weeklyLogsMap.set(w.week_start_date, {
          manoObra: Number(w.mano_obra_gasto || 0),
          equipo: Number(w.equipo_gasto || 0),
        });
      }
    });

    const calculateForRange = (startDateStr: string, endDateStr: string) => {
      let materiales = 0;
      let maquinaria = 0;
      let diesel = 0;
      let destajos = 0;
      let nomina = 0;

      (orders || []).forEach((ord: any) => {
        const orderDate = ord.date || (ord.created_at ? ord.created_at.split("T")[0] : "");
        if (orderDate >= startDateStr && orderDate <= endDateStr) {
          // Si la orden completa está marcada como destajo (is_piecework = true)
          if (ord.is_piecework) {
            const orderCost = Number(ord.subtotal ?? ord.total ?? 0);
            destajos += orderCost;
            return;
          }

          // Si no está marcada completa, clasificar por ítems
          const items = Array.isArray(ord.items) ? ord.items : [];
          items.forEach((item: any) => {
            const cost = Number(item.total || item.subtotal || item.precioTotal || (Number(item.cantidad || 1) * Number(item.precioUnitario || item.costo_unitario || 0))) || 0;
            const desc = (item.nombre || item.descripcion || "").toLowerCase();
            const cat = (item.categoria || "").toLowerCase();

            if (desc.includes("destajo") || cat.includes("destajo")) {
              destajos += cost;
            } else if (desc.includes("diesel") || desc.includes("combustible")) {
              diesel += cost;
            } else if (cat.includes("maquinaria") || cat.includes("equipo") || desc.includes("renta") || desc.includes("excavadora")) {
              maquinaria += cost;
            } else if (cat.includes("mano de obra") || desc.includes("nomina") || desc.includes("nómina")) {
              nomina += cost;
            } else {
              materiales += cost;
            }
          });
        }
      });

      return {
        egreso_materiales: Number(materiales.toFixed(2)),
        egreso_maquinaria_equipo: Number(maquinaria.toFixed(2)),
        egreso_diesel: Number(diesel.toFixed(2)),
        egreso_destajos: Number(destajos.toFixed(2)),
        egreso_nomina_directa: Number(nomina.toFixed(2)),
      };
    };

    let updatedCount = 0;

    // Procesar cada reporte de Control de Obra existente para actualizar egresos de sistema
    for (const report of controlReports || []) {
      const calc = calculateForRange(report.fecha_inicio, report.fecha_fin);

      const manualData = weeklyLogsMap.get(report.fecha_inicio);
      const finalNomina = calc.egreso_nomina_directa > 0 ? calc.egreso_nomina_directa : (manualData?.manoObra || report.egreso_nomina_directa || 0);
      const finalMaquinaria = calc.egreso_maquinaria_equipo > 0 ? calc.egreso_maquinaria_equipo : (manualData?.equipo || report.egreso_maquinaria_equipo || 0);
      const finalMateriales = calc.egreso_materiales > 0 ? calc.egreso_materiales : (report.egreso_materiales || 0);
      const finalDiesel = calc.egreso_diesel > 0 ? calc.egreso_diesel : (report.egreso_diesel || 0);
      const finalDestajos = calc.egreso_destajos > 0 ? calc.egreso_destajos : (report.egreso_destajos || 0);

      // Actualizar registro en store_control_obra_reports
      await supabaseAdmin
        .from("store_control_obra_reports")
        .update({
          egreso_materiales: finalMateriales,
          egreso_maquinaria_equipo: finalMaquinaria,
          egreso_nomina_directa: finalNomina,
          egreso_diesel: finalDiesel,
          egreso_destajos: finalDestajos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id);

      updatedCount++;
    }

    let weekCalculation = null;
    if (reqFechaInicio && reqFechaFin) {
      weekCalculation = calculateForRange(reqFechaInicio, reqFechaFin);
    }

    return NextResponse.json({
      success: true,
      message: `Se sincronizaron automáticamente los gastos del sistema para ${updatedCount} semanas.`,
      weekCalculation,
    });
  } catch (error: unknown) {
    console.error("[auto-sync POST] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error en auto-sincronización: " + errMsg }, { status: 500 });
  }
}
