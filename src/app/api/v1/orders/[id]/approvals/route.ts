import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // Verificar sesión
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const orderId = resolvedParams.id;

    // Obtener aprobaciones
    const { data: approvals, error } = await supabaseAdmin
      .from('order_approvals')
      .select(`
        *,
        department:departments(*),
        approver:users(id, full_name, email)
      `)
      .eq('order_id', orderId)
      .order('approval_order');

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al obtener aprobaciones' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      approvals: approvals || [],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
