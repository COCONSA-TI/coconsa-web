import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // Obtener sesión usando el sistema JWT de la app
    const session = await getSession();

    console.log('Session:', session ? 'válida' : 'no válida');
    console.log('User ID:', session?.userId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Sesión no válida. Por favor, cierra sesión y vuelve a iniciar sesión.' },
        { status: 401 }
      );
    }

    const { comments } = await request.json();
    const orderId = resolvedParams.id;

    // 1. Obtener usuario con departamento (usar admin client para queries)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, department:departments(*)')
      .eq('id', session.userId)
      .single();

    console.log('Usuario encontrado:', user);
    console.log('Error al buscar usuario:', userError);

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado en la base de datos' },
        { status: 404 }
      );
    }

    if (!user.is_department_head) {
      return NextResponse.json(
        { success: false, error: 'Solo los jefes de departamento pueden aprobar órdenes. Tu usuario no tiene el permiso is_department_head activado.' },
        { status: 403 }
      );
    }

    if (!user.department) {
      return NextResponse.json(
        { success: false, error: 'No tienes departamento asignado. Contacta al administrador para que te asigne a un departamento.' },
        { status: 403 }
      );
    }

    // 2. Obtener aprobaciones de esta orden
    const { data: approvals, error: approvalsError } = await supabaseAdmin
      .from('order_approvals')
      .select('*, department:departments(*)')
      .eq('order_id', orderId)
      .order('approval_order');

    if (approvalsError || !approvals || approvals.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada o sin aprobaciones configuradas' },
        { status: 404 }
      );
    }

    // 3. Encontrar la aprobación del usuario
    const myApproval = approvals.find((a: any) => a.department_id === user.department_id);

    if (!myApproval) {
      return NextResponse.json(
        { success: false, error: 'No tienes una aprobación pendiente para esta orden' },
        { status: 403 }
      );
    }

    if (myApproval.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Esta aprobación ya fue ${myApproval.status === 'approved' ? 'aprobada' : 'rechazada'}` },
        { status: 400 }
      );
    }

    // 4. Verificar que aprobaciones previas estén completadas
    const previousApprovals = approvals.filter((a: any) => a.approval_order < myApproval.approval_order);
    const allPreviousApproved = previousApprovals.every((a: any) => a.status === 'approved');

    if (!allPreviousApproved) {
      return NextResponse.json(
        { success: false, error: 'Faltan aprobaciones previas en el flujo de autorización' },
        { status: 400 }
      );
    }

    // 5. Aprobar
    const { error: updateError } = await supabaseAdmin
      .from('order_approvals')
      .update({
        status: 'approved',
        approver_id: session.userId,
        approved_at: new Date().toISOString(),
        comments: comments || null,
      })
      .eq('id', myApproval.id);

    if (updateError) {
      console.error('Error updating approval:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al aprobar la orden: ' + updateError.message },
        { status: 500 }
      );
    }

    // 6. Verificar si todas las aprobaciones están completas
    const { data: updatedApprovals, error: checkError } = await supabaseAdmin
      .from('order_approvals')
      .select('status')
      .eq('order_id', orderId);

    if (checkError) {
      console.error('Error checking approvals:', checkError);
    }

    const allApproved = updatedApprovals?.every((a: any) => a.status === 'approved');

    // 7. Si todas están aprobadas, cambiar estado de la orden
    if (allApproved) {
      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderUpdateError) {
        console.error('Error updating order status:', orderUpdateError);
      }
    } else {
      // Si no están todas aprobadas, actualizar estado a 'in_progress'
      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderUpdateError) {
        console.error('Error updating order status:', orderUpdateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Orden aprobada exitosamente',
      allApproved,
    });
  } catch (error) {
    console.error('Error in approve endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
