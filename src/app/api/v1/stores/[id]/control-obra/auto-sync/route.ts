import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(
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

    // 1. Obtener órdenes de compra aprobadas/pagadas para este centro de costos
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, created_at, status, total, items")
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

    let updatedCount = 0;

    // Procesar cada reporte de Control de Obra para actualizar egresos de sistema
    for (const report of controlReports || []) {
      const start = new Date(report.fecha_inicio + "T00:00:00");
      const end = new Date(report.fecha_fin + "T23:59:59");

      let materialesSystem = 0;
      let maquinariaSystem = 0;
      let dieselSystem = 0;
      let destajosSystem = 0;
      let nominaSystem = 0;

      // Sumar ítems de órdenes de compra dentro del rango de la semana
      (orders || []).forEach((ord) => {
        const ordDate = new Date(ord.created_at);
        if (ordDate >= start && ordDate <= end) {
          const items = Array.isArray(ord.items) ? ord.items : [];
          items.forEach((item: any) => {
            const cost = Number(item.total || item.subtotal || (Number(item.cantidad || 1) * Number(item.precioUnitario || item.costo_unitario || 0))) || 0;
            const desc = (item.nombre || item.descripcion || "").toLowerCase();
            const cat = (item.categoria || "").toLowerCase();

            if (desc.includes("diesel") || desc.includes("combustible")) {
              dieselSystem += cost;
            } else if (cat.includes("maquinaria") || cat.includes("equipo") || desc.includes("renta") || desc.includes("excavadora")) {
              maquinariaSystem += cost;
            } else if (cat.includes("destajo") || desc.includes("destajo")) {
              destajosSystem += cost;
            } else if (cat.includes("mano de obra") || desc.includes("nomina") || desc.includes("nómina")) {
              nominaSystem += cost;
            } else {
              materialesSystem += cost;
            }
          });
        }
      });

      const manualData = weeklyLogsMap.get(report.fecha_inicio);
      const finalNomina = nominaSystem > 0 ? nominaSystem : (manualData?.manoObra || report.egreso_nomina_directa || 0);
      const finalMaquinaria = maquinariaSystem > 0 ? maquinariaSystem : (manualData?.equipo || report.egreso_maquinaria_equipo || 0);
      const finalMateriales = materialesSystem > 0 ? materialesSystem : report.egreso_materiales || 0;
      const finalDiesel = dieselSystem > 0 ? dieselSystem : report.egreso_diesel || 0;
      const finalDestajos = destajosSystem > 0 ? destajosSystem : report.egreso_destajos || 0;

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

    return NextResponse.json({
      success: true,
      message: `Se sincronizaron automáticamente los gastos del sistema para ${updatedCount} semanas.`,
    });
  } catch (error: unknown) {
    console.error("[auto-sync POST] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error en auto-sincronización: " + errMsg }, { status: 500 });
  }
}
