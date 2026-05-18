import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * GET /api/v1/needs-lists/pending-balances?userId=xxx
 * Obtiene las listas verificadas de un usuario que tienen saldo pendiente (remaining_balance != 0).
 * Se usa para mostrar saldos arrastrados de listas anteriores.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || session.userId;

    const { data: lists, error } = await supabaseAdmin
      .from('needs_lists')
      .select('id, folio, total, remaining_balance, updated_at, currency')
      .eq('applicant_id', userId)
      .eq('status', 'verified')
      .not('remaining_balance', 'is', null)
      .neq('remaining_balance', 0)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending balances:', error);
      return NextResponse.json({ success: false, error: 'Error al obtener saldos' }, { status: 500 });
    }

    const totalPendingBalance = (lists || []).reduce(
      (sum: number, l: { remaining_balance: number }) => sum + Number(l.remaining_balance),
      0
    );

    return NextResponse.json({
      success: true,
      lists: lists || [],
      totalPendingBalance: Math.round(totalPendingBalance * 100) / 100,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
