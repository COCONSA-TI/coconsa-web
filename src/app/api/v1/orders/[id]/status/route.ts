import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Endpoint para aprobar o rechazar órdenes de compra
 * Solo accesible para administradores
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Verificar que el usuario sea admin
    const { error: authError, session } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body; // action: 'approve' | 'reject'

    console.log(`Usuario ${session!.userId} intenta ${action} la orden ${id}`);

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: "Acción inválida. Usa 'approve' o 'reject'" },
        { status: 400 }
      );
    }

    // Verificar que la orden existe y está pendiente
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

    if (order.status !== 'PENDIENTE') {
      return NextResponse.json(
        { error: `No se puede ${action === 'approve' ? 'aprobar' : 'rechazar'} una orden que no está pendiente` },
        { status: 400 }
      );
    }

    // Actualizar el estado de la orden
    // Cuando se aprueba, pasa directamente a EN_PROCESO
    const newStatus = action === 'approve' ? 'EN_PROCESO' : 'RECHAZADA';
    
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
      console.error('Error actualizando orden:', updateError);
      return NextResponse.json(
        { error: "Error al actualizar la orden" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Orden ${action === 'approve' ? 'aprobada y en progreso' : 'rechazada'} exitosamente`,
      order: {
        id,
        status: newStatus.toLowerCase()
      }
    });

  } catch (error) {
    console.error('Error en PATCH /orders/[id]/status:', error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
