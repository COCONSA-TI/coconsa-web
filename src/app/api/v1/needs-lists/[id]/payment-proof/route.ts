import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * POST /api/v1/needs-lists/[id]/payment-proof
 * Upload payment proof and mark needs list as completed.
 * Only accessible by department heads of 'contabilidad' or 'pagos'.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: needsListId } = await params;

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

    // 4. Verify needs list exists and is in 'approved' status
    const { data: needsList, error: needsListError } = await supabaseAdmin
      .from('needs_lists')
      .select('id, status')
      .eq('id', needsListId)
      .single();

    if (needsListError || !needsList) {
      return NextResponse.json(
        { success: false, error: 'Lista de necesidades no encontrada' },
        { status: 404 }
      );
    }

    if (needsList.status !== 'approved') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden registrar comprobantes en listas aprobadas' },
        { status: 400 }
      );
    }

    // 5. Parse request body
    const body = await request.json();
    const { filesInfo } = body;

    if (!filesInfo || !Array.isArray(filesInfo) || filesInfo.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe adjuntar al menos un comprobante de pago' },
        { status: 400 }
      );
    }

    // 6. Collect file URLs
    const fileUrls: string[] = [];

    for (const file of filesInfo) {
      if (!file.name || !file.url) {
        return NextResponse.json(
          { success: false, error: `Datos incompletos para archivo: ${file.name || 'desconocido'}` },
          { status: 400 }
        );
      }
      fileUrls.push(file.url);
    }

    // 7. Update needs list: set payment_proof_url and status to 'completed'
    const { error: updateError } = await supabaseAdmin
      .from('needs_lists')
      .update({
        payment_proof_url: fileUrls.join(','),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', needsListId);

    if (updateError) {
      console.error('Error updating needs list:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar la lista de necesidades' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Comprobante de pago registrado. La lista ha sido marcada como completada.',
      filesUploaded: fileUrls.length,
    });
  } catch (error) {
    console.error('Payment proof endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
