import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * POST /api/v1/needs-lists/[id]/verify
 * Maneja el flujo de estado de las comprobaciones de gastos:
 * - submit: Solicitante envía la comprobación a revisión (completed -> verifying)
 * - accept: Dirección acepta la comprobación (verifying -> verified), calcula y guarda remaining_balance
 * - reject: Dirección rechaza la comprobación (verifying -> completed)
 * - reopen: Reabre una lista verificada con saldo pendiente para agregar más comprobantes (verified -> completed)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: needsListId } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body as { action: 'submit' | 'accept' | 'reject' | 'reopen' };

    let newStatus = '';
    let currentStatusConditions: string[] = [];
    let message = '';

    if (action === 'submit') {
      newStatus = 'verifying';
      currentStatusConditions = ['completed'];
      message = 'Comprobantes enviados a revisión';
    } else if (action === 'accept') {
      // Validar que solo Dirección puede aceptar
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('department:departments(code)')
        .eq('id', session.userId)
        .single();
      
      const deptCode = user?.department?.code;
      if (deptCode !== 'direccion') {
        return NextResponse.json({ success: false, error: 'Solo Dirección puede aceptar comprobaciones' }, { status: 403 });
      }
      
      newStatus = 'verified';
      currentStatusConditions = ['verifying'];
      message = 'Comprobación aceptada';
    } else if (action === 'reject') {
      // Validar que solo Dirección puede rechazar
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('department:departments(code)')
        .eq('id', session.userId)
        .single();
      
      const deptCode = user?.department?.code;
      if (deptCode !== 'direccion') {
        return NextResponse.json({ success: false, error: 'Solo Dirección puede rechazar comprobaciones' }, { status: 403 });
      }
      
      newStatus = 'completed';
      currentStatusConditions = ['verifying'];
      message = 'Comprobación rechazada, el solicitante puede editarla';
    } else if (action === 'reopen') {
      newStatus = 'completed';
      currentStatusConditions = ['verified'];
      message = 'Lista reabierta para agregar más comprobantes';
    } else {
      return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
    }

    // Para "accept", calcular y guardar el remaining_balance
    if (action === 'accept') {
      // Obtener el total y el monto depositado de la lista
      const { data: needsList } = await supabaseAdmin
        .from('needs_lists')
        .select('total, deposit_amount')
        .eq('id', needsListId)
        .single();

      // Obtener la suma de todos los comprobantes de gastos
      const { data: proofs } = await supabaseAdmin
        .from('expense_proofs')
        .select('amount')
        .eq('needs_list_id', needsListId);

      const totalEntregado = needsList?.deposit_amount !== null && needsList?.deposit_amount !== undefined 
        ? Number(needsList.deposit_amount) 
        : (needsList?.total || 0);
      const totalComprobado = proofs?.reduce((sum: number, p: { amount: number }) => sum + Number(p.amount), 0) || 0;
      const remainingBalance = Math.round((totalEntregado - totalComprobado) * 100) / 100;

      const { error: updateError } = await supabaseAdmin
        .from('needs_lists')
        .update({
          status: newStatus,
          remaining_balance: remainingBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('id', needsListId)
        .in('status', currentStatusConditions);

      if (updateError) {
        console.error('Error al actualizar estado de comprobación:', updateError);
        return NextResponse.json({ success: false, error: 'Error al actualizar el estado' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message,
        remaining_balance: remainingBalance,
      });
    }

    // Para "reopen", limpiar el remaining_balance
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (action === 'reopen') {
      updateData.remaining_balance = null;
    }

    const { error: updateError } = await supabaseAdmin
      .from('needs_lists')
      .update(updateData)
      .eq('id', needsListId)
      .in('status', currentStatusConditions);

    if (updateError) {
      console.error('Error al actualizar estado de comprobación:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar el estado' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
