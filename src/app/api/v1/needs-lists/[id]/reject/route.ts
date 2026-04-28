import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/v1/needs-lists/[id]/reject
 * Rechaza una lista de necesidades
 */
export async function POST(
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

    // Parsear body
    const body = await request.json();
    const { comments, is_definitive } = body;

    if (!comments || comments.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: "Debes proporcionar una razón de rechazo de al menos 10 caracteres" },
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
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if (!user.is_department_head) {
      return NextResponse.json(
        { success: false, error: "Solo los jefes de departamento pueden rechazar listas" },
        { status: 403 }
      );
    }

    if (!user.department_id) {
      return NextResponse.json(
        { success: false, error: "El usuario no tiene departamento asignado" },
        { status: 400 }
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
        { success: false, error: "Lista de necesidades no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que la lista no está completada o pagada
    if (['completed', 'paid'].includes(needsList.status)) {
      return NextResponse.json(
        { success: false, error: `No se puede rechazar una lista en estado '${needsList.status}'` },
        { status: 400 }
      );
    }

    // Buscar la aprobación pendiente para el departamento del usuario
    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('needs_list_approvals')
      .select('*')
      .eq('needs_list_id', needsListId)
      .eq('department_id', user.department_id)
      .eq('status', 'pending')
      .single();

    if (approvalError || !approval) {
      return NextResponse.json(
        { success: false, error: "No hay una aprobación pendiente para tu departamento en esta lista" },
        { status: 404 }
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
        { success: false, error: "Error al verificar aprobaciones previas" },
        { status: 500 }
      );
    }

    const allPreviousApproved = previousApprovals?.every(a => a.status === 'approved') ?? true;

    if (!allPreviousApproved) {
      return NextResponse.json(
        { success: false, error: "Hay aprobaciones anteriores pendientes" },
        { status: 400 }
      );
    }

    // Actualizar la aprobación como rechazada
    const { error: updateApprovalError } = await supabaseAdmin
      .from('needs_list_approvals')
      .update({
        status: 'rejected',
        approver_id: session.userId,
        approved_at: new Date().toISOString(),
        comments: comments,
      })
      .eq('id', approval.id);

    if (updateApprovalError) {
      console.error('Error al actualizar aprobación:', updateApprovalError);
      return NextResponse.json(
        { success: false, error: "Error al rechazar la lista" },
        { status: 500 }
      );
    }

    // Actualizar estado de la lista a rechazada
    const { error: updateListError } = await supabaseAdmin
      .from('needs_lists')
      .update({ 
        status: 'rejected',
        is_definitive_rejection: is_definitive === true,
      })
      .eq('id', needsListId);

    if (updateListError) {
      console.error('Error al actualizar estado de la lista:', updateListError);
      return NextResponse.json(
        { success: false, error: "Error al actualizar el estado de la lista" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: is_definitive 
        ? "Lista rechazada definitivamente (no se puede editar)" 
        : "Lista rechazada (el solicitante puede editarla y reenviarla)",
      is_definitive: is_definitive === true,
    });

  } catch (error) {
    console.error("Error en POST /api/v1/needs-lists/[id]/reject:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
