import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * POST /api/v1/needs-lists/[id]/verify
 * Maneja el flujo de estado de las comprobaciones de gastos:
 * - submit: Solicitante envía la comprobación a revisión (completed -> verifying)
 * - accept: Revisor acepta la comprobación (verifying -> verified), incluso con saldo pendiente
 * - reject: Revisor rechaza la comprobación (verifying -> completed)
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
      newStatus = 'verified';
      currentStatusConditions = ['verifying'];
      message = 'Comprobación aceptada';
    } else if (action === 'reject') {
      newStatus = 'completed'; // Vuelve a completed para que edite
      currentStatusConditions = ['verifying'];
      message = 'Comprobación rechazada, el solicitante puede editarla';
    } else if (action === 'reopen') {
      // Permite reabrir una lista verificada para agregar más comprobantes
      // (por ejemplo, para comprobar saldo pendiente)
      newStatus = 'completed';
      currentStatusConditions = ['verified'];
      message = 'Lista reabierta para agregar más comprobantes';
    } else {
      return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('needs_lists')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
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
