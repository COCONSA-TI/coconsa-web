import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/stores/[id]/weekly-reports/[reportId]/approval
 * Dirección aprueba o rechaza una solicitud de gasto semanal que excedió el presupuesto.
 * Se requiere rol de Admin o departamento de Dirección (approval_order >= 3 o code ~ /direccion/i).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; reportId: string }> }
) {
  try {
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    const { id, reportId } = await params;
    const storeId = parseInt(id, 10);
    const reportIdNum = parseInt(reportId, 10);

    if (isNaN(storeId) || isNaN(reportIdNum)) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    // Verificar permisos de Dirección
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_department_head, department_id")
      .eq("id", session!.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let isDireccion = false;

    if (userData.department_id) {
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("approval_order, code, name")
        .eq("id", userData.department_id)
        .single();

      if (dept) {
        const ao = dept.approval_order ?? 0;
        const code = dept.code || "";
        const name = dept.name || "";
        isDireccion = ao >= 3 || /dir|direccion|dirección/i.test(code) || /direccion|dirección/i.test(name);
      }
    }

    if (!isDireccion) {
      return NextResponse.json(
        { error: "Solo los miembros del departamento de Dirección pueden autorizar o rechazar este gasto" },
        { status: 403 }
      );
    }

    // Leer acción del body
    const body = await request.json() as {
      action: "approve" | "reject";
      rejection_reason?: string;
    };

    const { action, rejection_reason } = body;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Acción inválida. Debe ser 'approve' o 'reject'" }, { status: 400 });
    }

    // Obtener reporte actual
    const { data: existingReport, error: fetchError } = await supabaseAdmin
      .from("store_weekly_reports")
      .select("*")
      .eq("id", reportIdNum)
      .eq("store_id", storeId)
      .single();

    if (fetchError || !existingReport) {
      return NextResponse.json({ error: "Reporte semanal no encontrado" }, { status: 404 });
    }

    const nowISO = new Date().toISOString();

    const updatedStatus: "approved" | "rejected" = action === "reject" ? "rejected" : "approved";
    const updateFields: Record<string, any> = {
      approved_by: session!.userId,
      approval_date: nowISO,
      updated_at: nowISO,
      status: updatedStatus,
      rejection_reason: action === "reject" ? (rejection_reason || "Solicitud no aprobada por Dirección") : null,
    };

    const { data: updatedReport, error: updateError } = await supabaseAdmin
      .from("store_weekly_reports")
      .update(updateFields)
      .eq("id", reportIdNum)
      .select()
      .single();

    if (updateError) {
      console.error("[weekly-reports approval] Error al actualizar estado:", updateError);
      return NextResponse.json(
        { error: "Error al procesar la autorización: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: action === "approve"
        ? "Gasto semanal autorizado correctamente por Dirección."
        : "Gasto semanal rechazado por Dirección.",
      report: updatedReport,
    });
  } catch (error: unknown) {
    console.error("[weekly-reports approval] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error al procesar la solicitud: " + errMsg }, { status: 500 });
  }
}
