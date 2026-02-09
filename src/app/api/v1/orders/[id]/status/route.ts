import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Endpoint para aprobar o rechazar órdenes de compra
 * Solo accesible para administradores
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar que el usuario sea admin
    const { error: authError, session } = await requireAdmin();
    if (authError) return authError;

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await request.json();
    const { action } = body; // action: 'approve' | 'reject' | 'complete'
    // Note: 'reason' field available for rejection logging when needed

    if (!action || !['approve', 'reject', 'complete'].includes(action)) {
      return NextResponse.json(
        { error: "Acción inválida. Usa 'approve', 'reject' o 'complete'" },
        { status: 400 }
      );
    }

    // Verificar que la orden existe
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Validar transiciones de estado
    if (action === 'approve' && order.status !== 'PENDIENTE') {
      return NextResponse.json(
        { error: 'Solo se pueden aprobar órdenes pendientes' },
        { status: 400 }
      );
    }

    if (action === 'reject' && order.status !== 'PENDIENTE') {
      return NextResponse.json(
        { error: 'Solo se pueden rechazar órdenes pendientes' },
        { status: 400 }
      );
    }

    if (action === 'complete' && order.status !== 'EN_PROCESO') {
      return NextResponse.json(
        { error: 'Solo se pueden completar órdenes que están en proceso' },
        { status: 400 }
      );
    }

    // Actualizar el estado de la orden
    let newStatus: string;
    if (action === 'approve') {
      newStatus = 'EN_PROCESO'; // Cuando se aprueba, pasa directamente a EN_PROCESO
    } else if (action === 'reject') {
      newStatus = 'RECHAZADA';
    } else {
      newStatus = 'COMPLETADA'; // action === 'complete'
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString(),
        // Opcionalmente puedes guardar quién aprobó/rechazó y el motivo
        // approved_by: session!.userId,
        // rejection_reason: action === 'reject' ? reason : null
      })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json(
        { error: "Error al actualizar la orden" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: action === 'approve' 
        ? 'Orden aprobada y en progreso exitosamente' 
        : action === 'reject'
        ? 'Orden rechazada exitosamente'
        : 'Orden completada exitosamente',
      order: {
        id,
        status: newStatus.toLowerCase()
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
