import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/stores/[id]/weekly-reports
 * Obtiene todos los reportes semanales de Mano de Obra y Equipo de una obra.
 */
export async function GET(
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

    // Consultar todos los reportes ordenados cronológicamente por fecha de inicio de semana
    const { data: reports, error } = await supabaseAdmin
      .from("store_weekly_reports")
      .select("*")
      .eq("store_id", storeId)
      .order("week_start_date", { ascending: true });

    if (error) {
      console.error("[weekly-reports GET] Error al consultar reportes:", error);
      return NextResponse.json(
        { error: "Error al consultar reportes: " + error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reports: reports || [],
    });
  } catch (error: unknown) {
    console.error("[weekly-reports GET] Error inesperado:", error);
    return NextResponse.json({ error: "Error al obtener los reportes semanales" }, { status: 500 });
  }
}

/**
 * POST /api/v1/stores/[id]/weekly-reports
 * Crea o actualiza un reporte semanal para una obra (Upsert).
 * Solo usuarios de Gerencia (approval_order = 1), Dirección (approval_order >= 3) o Admin pueden guardar.
 */
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

    // Verificar permisos
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_department_head, department_id")
      .eq("id", session!.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let canWrite = session!.role === "admin";

    if (!canWrite && userData.is_department_head && userData.department_id) {
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("approval_order")
        .eq("id", userData.department_id)
        .single();

      if (dept) {
        const ao = dept.approval_order ?? 0;
        canWrite = ao === 1 || ao >= 3;
      }
    }

    if (!canWrite) {
      return NextResponse.json(
        { error: "Solo Gerencia y Dirección pueden reportar gastos semanales" },
        { status: 403 }
      );
    }

    // Leer cuerpo de la solicitud
    const body = await request.json() as {
      week_start_date: string;
      mano_obra_gasto: number;
      equipo_gasto: number;
      comments?: string;
    };

    const { week_start_date, mano_obra_gasto, equipo_gasto, comments } = body;

    if (!week_start_date) {
      return NextResponse.json({ error: "Se requiere la fecha de inicio de semana (week_start_date)" }, { status: 400 });
    }

    if (typeof mano_obra_gasto !== "number" || mano_obra_gasto < 0 || typeof equipo_gasto !== "number" || equipo_gasto < 0) {
      return NextResponse.json({ error: "Los gastos deben ser números mayores o iguales a 0" }, { status: 400 });
    }

    // 1. Obtener presupuesto de la obra para Mano de Obra y Equipo
    const { data: insumos } = await supabaseAdmin
      .from("store_insumos")
      .select("categoria, monto_presupuestado")
      .eq("store_id", storeId);

    const presupuestoManoObra = (insumos || [])
      .filter((i) => i.categoria === "Mano de Obra")
      .reduce((sum, i) => sum + (Number(i.monto_presupuestado) || 0), 0);

    const presupuestoEquipo = (insumos || [])
      .filter((i) => i.categoria === "Equipo")
      .reduce((sum, i) => sum + (Number(i.monto_presupuestado) || 0), 0);

    // 2. Obtener gastos previos aprobados (excluyendo la semana actual)
    const { data: previousReports } = await supabaseAdmin
      .from("store_weekly_reports")
      .select("week_start_date, mano_obra_gasto, equipo_gasto, status")
      .eq("store_id", storeId)
      .neq("week_start_date", week_start_date)
      .eq("status", "approved");

    const prevManoObra = (previousReports || []).reduce((sum, r) => sum + (Number(r.mano_obra_gasto) || 0), 0);
    const prevEquipo = (previousReports || []).reduce((sum, r) => sum + (Number(r.equipo_gasto) || 0), 0);

    const totalManoObraPropuesto = prevManoObra + mano_obra_gasto;
    const totalEquipoPropuesto = prevEquipo + equipo_gasto;

    const exceedsManoObra = presupuestoManoObra > 0
      ? (totalManoObraPropuesto > presupuestoManoObra)
      : (mano_obra_gasto > 0);

    const exceedsEquipo = presupuestoEquipo > 0
      ? (totalEquipoPropuesto > presupuestoEquipo)
      : (equipo_gasto > 0);

    let reportStatus: "approved" | "pending_approval" = "approved";
    let exceededCategoriesStr: string | null = null;

    if (exceedsManoObra || exceedsEquipo) {
      reportStatus = "pending_approval";
      const categories: string[] = [];
      if (exceedsManoObra) categories.push("Mano de Obra");
      if (exceedsEquipo) categories.push("Equipo y Maquinaria");
      exceededCategoriesStr = categories.join(", ");
    }

    // Ejecutar UPSERT
    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("store_weekly_reports")
      .upsert({
        store_id: storeId,
        week_start_date,
        mano_obra_gasto,
        equipo_gasto,
        comments: comments || null,
        status: reportStatus,
        exceeded_categories: exceededCategoriesStr,
        requested_by: session!.userId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "store_id,week_start_date",
      })
      .select()
      .single();

    if (upsertError) {
      console.error("[weekly-reports POST] Error al guardar reporte semanal:", upsertError);
      return NextResponse.json(
        { error: "Error al guardar el reporte: " + upsertError.message },
        { status: 500 }
      );
    }

    const isPending = reportStatus === "pending_approval";

    return NextResponse.json({
      success: true,
      message: isPending
        ? `El gasto registrado excede el presupuesto disponible en (${exceededCategoriesStr}). Se ha enviado una solicitud de autorización a Dirección.`
        : "Reporte semanal guardado exitosamente",
      isPendingApproval: isPending,
      exceededCategories: exceededCategoriesStr,
      report: upserted,
    });
  } catch (error: unknown) {
    console.error("[weekly-reports POST] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error al procesar la solicitud: " + errMsg }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/stores/[id]/weekly-reports?reportId=X
 * Elimina un reporte semanal específico.
 */
export async function DELETE(
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

    const url = new URL(request.url);
    const reportIdStr = url.searchParams.get("reportId");
    if (!reportIdStr) {
      return NextResponse.json({ error: "Se requiere el ID del reporte (reportId)" }, { status: 400 });
    }
    const reportId = parseInt(reportIdStr, 10);

    // Verificar permisos
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_department_head, department_id")
      .eq("id", session!.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let canWrite = session!.role === "admin";

    if (!canWrite && userData.is_department_head && userData.department_id) {
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("approval_order")
        .eq("id", userData.department_id)
        .single();

      if (dept) {
        const ao = dept.approval_order ?? 0;
        canWrite = ao === 1 || ao >= 3;
      }
    }

    if (!canWrite) {
      return NextResponse.json(
        { error: "Solo Gerencia y Dirección pueden eliminar reportes semanales" },
        { status: 403 }
      );
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from("store_weekly_reports")
      .delete({ count: "exact" })
      .eq("id", reportId)
      .eq("store_id", storeId);

    if (deleteError) {
      console.error("[weekly-reports DELETE] Error al eliminar reporte semanal:", deleteError);
      return NextResponse.json(
        { error: "Error al eliminar el reporte: " + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reporte semanal eliminado exitosamente",
      deletedCount: count || 0,
    });
  } catch (error: unknown) {
    console.error("[weekly-reports DELETE] Error inesperado:", error);
    return NextResponse.json({ error: "Error al eliminar el reporte semanal" }, { status: 500 });
  }
}
