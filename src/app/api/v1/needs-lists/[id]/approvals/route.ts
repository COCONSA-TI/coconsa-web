import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/v1/needs-lists/[id]/approvals
 * Obtiene todas las aprobaciones de una lista de necesidades
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const needsListId = parseInt(id);

    if (isNaN(needsListId)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    // Verificar que la lista existe
    const { data: needsList, error: needsListError } = await supabaseAdmin
      .from('needs_lists')
      .select('id')
      .eq('id', needsListId)
      .single();

    if (needsListError || !needsList) {
      return NextResponse.json(
        { success: false, error: "Lista de necesidades no encontrada" },
        { status: 404 }
      );
    }

    // Obtener todas las aprobaciones con información relacionada
    const { data: approvals, error: approvalsError } = await supabaseAdmin
      .from('needs_list_approvals')
      .select(`
        *,
        department:departments (
          id,
          name,
          code
        ),
        approver:users!needs_list_approvals_approver_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('needs_list_id', needsListId)
      .order('approval_order', { ascending: true });

    if (approvalsError) {
      console.error('Error al obtener aprobaciones:', approvalsError);
      return NextResponse.json(
        { success: false, error: "Error al obtener las aprobaciones" },
        { status: 500 }
      );
    }

    // Calcular estadísticas
    const total = approvals?.length || 0;
    const approved = approvals?.filter(a => a.status === 'approved').length || 0;
    const rejected = approvals?.filter(a => a.status === 'rejected').length || 0;
    const pending = approvals?.filter(a => a.status === 'pending').length || 0;

    return NextResponse.json({
      success: true,
      approvals: approvals || [],
      stats: {
        total,
        approved,
        rejected,
        pending,
      },
    });

  } catch (error) {
    console.error("Error en GET /api/v1/needs-lists/[id]/approvals:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
