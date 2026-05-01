import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * POST /api/v1/orders/[id]/payment-proof
 * Upload payment proof and mark order as completed.
 * Only accessible by department heads of 'contabilidad' or 'pagos'.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // 1. Authenticate
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // 2. Get user with department info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, department:departments(*)')
      .eq('id', session.userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // 3. Verify user is department head of contabilidad or pagos
    if (!user.is_department_head) {
      return NextResponse.json(
        { success: false, error: 'Solo los jefes de departamento pueden registrar comprobantes de pago' },
        { status: 403 }
      );
    }

    const deptCode = user.department?.code;
    if (deptCode !== 'contabilidad' && deptCode !== 'pagos') {
      return NextResponse.json(
        { success: false, error: 'Solo Contabilidad o Pagos pueden registrar comprobantes de pago' },
        { status: 403 }
      );
    }

    // 4. Verify order exists and is in 'approved' status
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    if (order.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden registrar comprobantes en órdenes aprobadas' },
        { status: 400 }
      );
    }

    // 5. Parse request body
    const body = await request.json();
    const { filesInfo, comments } = body;

    if (!filesInfo || !Array.isArray(filesInfo) || filesInfo.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe adjuntar al menos un comprobante de pago' },
        { status: 400 }
      );
    }

    // 6. Save file metadata to order_attachments
    const uploadedFileIds: string[] = [];
    const fileUrls: string[] = [];

    for (const file of filesInfo) {
      if (!file.name || !file.url || !file.path) {
        return NextResponse.json(
          { success: false, error: `Datos incompletos para archivo: ${file.name || 'desconocido'}` },
          { status: 400 }
        );
      }

      const { data: attachmentData, error: insertError } = await supabaseAdmin
        .from('order_attachments')
        .insert({
          order_id: orderId,
          uploaded_by: session.userId,
          file_name: file.name,
          file_size: file.size || 0,
          file_type: file.type || 'application/octet-stream',
          file_url: file.url,
          storage_path: file.path,
          description: 'Comprobante de pago',
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error inserting attachment:', insertError);
        return NextResponse.json(
          { success: false, error: `Error al registrar archivo ${file.name}` },
          { status: 500 }
        );
      }

      uploadedFileIds.push(attachmentData.id);
      fileUrls.push(file.url);
    }

    // 7. Update order: set payment_proof_url and status to 'completed'
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_proof_url: fileUrls.join(','),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar la orden' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comprobante de pago registrado. La orden ha sido marcada como completada.',
      filesUploaded: uploadedFileIds.length,
    });
  } catch (error) {
    console.error('Payment proof endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
