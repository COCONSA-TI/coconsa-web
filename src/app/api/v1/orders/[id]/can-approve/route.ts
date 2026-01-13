import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { id: orderId } = await params;
    const userId = session.userId;

    // 1. Obtener usuario con departamento
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        is_department_head,
        department_id,
        department:departments(
          id,
          name,
          code,
          approval_order
        )
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'Usuario no encontrado'
      });
    }

    if (!user.is_department_head) {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'No eres jefe de departamento'
      });
    }

    if (!user.department) {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'No tienes departamento asignado'
      });
    }

    // 2. Obtener aprobaciones de esta orden
    const { data: approvals, error: approvalsError } = await supabaseAdmin
      .from('order_approvals')
      .select(`
        *,
        department:departments(
          id,
          name,
          code,
          approval_order
        )
      `)
      .eq('order_id', orderId)
      .order('approval_order');

    if (approvalsError || !approvals) {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'Error al obtener aprobaciones'
      });
    }

    // 3. Encontrar la aprobación del usuario
    const myApproval = approvals.find((a: any) => a.department_id === user.department_id);

    if (!myApproval) {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'No tienes una aprobación pendiente para esta orden'
      });
    }

    if (myApproval.status !== 'pending') {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'Esta aprobación ya fue procesada'
      });
    }

    // 4. Verificar que aprobaciones previas estén completadas
    const previousApprovals = approvals.filter((a: any) => a.approval_order < myApproval.approval_order);
    const allPreviousApproved = previousApprovals.every((a: any) => a.status === 'approved');

    if (!allPreviousApproved) {
      return NextResponse.json({
        success: true,
        canApprove: false,
        reason: 'Faltan aprobaciones previas en el flujo'
      });
    }

    return NextResponse.json({
      success: true,
      canApprove: true,
      approval: myApproval
    });

  } catch (error) {
    console.error('Error en can-approve:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
