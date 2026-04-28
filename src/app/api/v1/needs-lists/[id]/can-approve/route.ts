import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/v1/needs-lists/[id]/can-approve
 * Verifica si el usuario actual puede aprobar una lista de necesidades
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const needsListId = parseInt(id);

    if (isNaN(needsListId)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    // Verificar que el usuario es jefe de departamento
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, department_id, is_department_head')
      .eq('id', session.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "Usuario no encontrado" },
        { status: 200 }
      );
    }

    if (!user.is_department_head) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "No eres jefe de departamento" },
        { status: 200 }
      );
    }

    if (!user.department_id) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "No tienes departamento asignado" },
        { status: 200 }
      );
    }

    // Verificar que la lista existe
    const { data: needsList, error: needsListError } = await supabaseAdmin
      .from('needs_lists')
      .select('id, status')
      .eq('id', needsListId)
      .single();

    if (needsListError || !needsList) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "Lista de necesidades no encontrada" },
        { status: 200 }
      );
    }

    // Verificar estado de la lista
    if (['rejected', 'completed', 'paid'].includes(needsList.status)) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: `La lista está en estado '${needsList.status}'` },
        { status: 200 }
      );
    }

    // Buscar aprobación pendiente para el departamento del usuario
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('needs_list_approvals')
      .select(`
        *,
        department:departments (
          name,
          code
        )
      `)
      .eq('needs_list_id', needsListId)
      .eq('department_id', user.department_id)
      .eq('status', 'pending')
      .single();

    if (approvalError || !approval) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "No hay una aprobación pendiente para tu departamento" },
        { status: 200 }
      );
    }

    // Verificar que todas las aprobaciones anteriores estén completadas
    const { data: previousApprovals, error: prevError } = await supabaseAdmin
      .from('needs_list_approvals')
      .select('*')
      .eq('needs_list_id', needsListId)
      .lt('approval_order', approval.approval_order);

    if (prevError) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "Error al verificar aprobaciones previas" },
        { status: 200 }
      );
    }

    const allPreviousApproved = previousApprovals?.every(a => a.status === 'approved') ?? true;

    if (!allPreviousApproved) {
      return NextResponse.json(
        { success: true, canApprove: false, reason: "Hay aprobaciones anteriores pendientes" },
        { status: 200 }
      );
    }

    // El usuario puede aprobar
    return NextResponse.json({
      success: true,
      canApprove: true,
      approval: approval,
      message: `Puedes aprobar esta lista en el nivel: ${approval.department?.name || 'Desconocido'}`,
    });

  } catch (error) {
    console.error("Error en GET /api/v1/needs-lists/[id]/can-approve:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
