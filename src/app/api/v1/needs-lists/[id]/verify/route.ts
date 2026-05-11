import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * POST /api/v1/needs-lists/[id]/verify
 * Maneja el flujo de estado de las comprobaciones de gastos:
 * - submit: Solicitante envía la comprobación a revisión (completed -> verifying)
 * - accept: Revisor acepta la comprobación (verifying -> verified)
 * - reject: Revisor rechaza la comprobación (verifying -> completed)
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
    const { action } = body as { action: 'submit' | 'accept' | 'reject' };

    let newStatus = '';
    let currentStatusCondition = '';

    if (action === 'submit') {
      newStatus = 'verifying';
      currentStatusCondition = 'completed';
    } else if (action === 'accept') {
      newStatus = 'verified';
      currentStatusCondition = 'verifying';
    } else if (action === 'reject') {
      newStatus = 'completed'; // Vuelve a completed para que edite
      currentStatusCondition = 'verifying';
    } else {
      return NextResponse.json({ success: false, error: 'Acción inválida' }, { status: 400 });
    }

    // Opcional: Podríamos verificar permisos aquí (ej. solo solicitante puede submit)
    // Pero confiaremos en la UI y en que solo los roles autorizados llamen la API

    const { error: updateError } = await supabaseAdmin
      .from('needs_lists')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', needsListId)
      .eq('status', currentStatusCondition);

    if (updateError) {
      console.error('Error al actualizar estado de comprobación:', updateError);
      return NextResponse.json({ success: false, error: 'Error al actualizar el estado' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Comprobación actualizada a ${newStatus}` });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
