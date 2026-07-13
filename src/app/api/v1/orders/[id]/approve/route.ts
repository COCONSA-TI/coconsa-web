import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { OrderApprovalWithRelations, ApprovalStatus } from '@/types/database';
import type { Department } from '@/types/database';

// Lanza el flujo de aprobación normal después de que Dirección apruebe
// la autorización extraordinaria (paso 0).
async function launchNormalApprovalFlow(
  orderId: string,
  applicantId: string,
  isUrgent: boolean
) {
  const { data: applicant } = await supabaseAdmin
    .from('users')
    .select('is_department_head, department_id')
    .eq('id', applicantId)
    .single();

  const { data: departments } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('requires_approval', true)
    .order('approval_order');

  if (!departments || departments.length === 0) return;

  const applicantDeptId = applicant?.department_id;
  const isApplicantDeptHead = applicant?.is_department_head && applicant?.department_id === applicantDeptId;
  const applicantDept = departments.find((d: Department) => d.id === applicantDeptId);
  const applicantApprovalOrder = applicantDept?.approval_order ?? 0;

  const approvalsToCreate = [];

  if (isUrgent && isApplicantDeptHead) {
    // Urgente: solo Dirección(3)+
    for (const dept of departments.filter((d: Department) => (d.approval_order ?? 0) >= 3)) {
      approvalsToCreate.push({ order_id: orderId, department_id: dept.id, status: 'pending', approval_order: dept.approval_order });
    }
  } else if (applicantApprovalOrder >= 2) {
    // Depto del flujo: desde contraloría en adelante
    for (const dept of departments.filter((d: Department) => (d.approval_order ?? 0) >= 2)) {
      approvalsToCreate.push({ order_id: orderId, department_id: dept.id, status: 'pending', approval_order: dept.approval_order });
    }
  } else {
    // Gerencia: flujo completo
    if (applicantDept) {
      approvalsToCreate.push({
        order_id: orderId,
        department_id: applicantDept.id,
        status: isApplicantDeptHead ? 'approved' : 'pending',
        approval_order: applicantDept.approval_order,
        approver_id: isApplicantDeptHead ? applicantId : null,
        approved_at: isApplicantDeptHead ? new Date().toISOString() : null,
        comments: isApplicantDeptHead ? 'Auto-aprobado (solicitante es jefe de departamento)' : null,
      });
    }
    for (const dept of departments.filter((d: Department) => (d.approval_order ?? 0) > 1 && d.id !== applicantDeptId)) {
      approvalsToCreate.push({ order_id: orderId, department_id: dept.id, status: 'pending', approval_order: dept.approval_order });
    }
  }

  if (approvalsToCreate.length > 0) {
    await supabaseAdmin.from('order_approvals').insert(approvalsToCreate);
  }

  // Poner la orden en in_progress
  await supabaseAdmin
    .from('orders')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', orderId);
}

const ORDER_ATTACHMENTS_BUCKET = 'order-attachments';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // Obtener sesión usando el sistema JWT de la app
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado - Sesión no válida. Por favor, cierra sesión y vuelve a iniciar sesión.' },
        { status: 401 }
      );
    }

    const orderId = resolvedParams.id;
    
    // Solo aceptar JSON request con presigned URLs (evita payload gigante de Vercel)
    // Los archivos ya se subieron directamente a Supabase vía presigned URLs
    const body = await request.json();
    const comments = body.comments || '';
    const filesInfo: Array<{ name: string, size: number, type: string, url: string, path: string }> = body.filesInfo || [];

    // 1. Obtener usuario con departamento (usar admin client para queries)
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('*, department:departments(*)')
      .eq('id', session.userId)
      .single();

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
    const myApproval = approvals.find((a: OrderApprovalWithRelations) => a.department_id === user.department_id);

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
    const previousApprovals = approvals.filter((a: OrderApprovalWithRelations) => (a.approval_order ?? 0) < (myApproval.approval_order ?? 0));
    const allPreviousApproved = previousApprovals.every((a: OrderApprovalWithRelations) => a.status === 'approved');

    if (!allPreviousApproved) {
      return NextResponse.json(
        { success: false, error: 'Faltan aprobaciones previas en el flujo de autorización' },
        { status: 400 }
      );
    }

    // Las URLs de evidencia ya vienen del frontend (se subieron vía presigned URLs directamente a Supabase)
    const uploadedFileIds: string[] = [];
    
    // Procesar filesInfo (presigned URLs) - registrar metadata en BD
    if (filesInfo.length > 0) {
      for (const file of filesInfo) {
        try {
          const { data: attachmentData, error: insertError } = await supabaseAdmin
            .from('order_attachments')
            .insert({
              order_id: orderId,
              uploaded_by: session.userId,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              file_url: file.url,
              storage_path: file.path,
              description: null,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Database insert error:', insertError);
            return NextResponse.json(
              { success: false, error: `Error al registrar archivo ${file.name}` },
              { status: 500 }
            );
          }

          uploadedFileIds.push(attachmentData.id);
        } catch (error) {
          console.error('Error procesando info del archivo:', error);
          return NextResponse.json(
             { success: false, error: `Error procesando metadata del archivo ${file.name}` },
             { status: 500 }
          );
        }
      }
    }

    // 6. Aprobar
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
      return NextResponse.json(
        { success: false, error: 'Error al aprobar la orden: ' + updateError.message },
        { status: 500 }
      );
    }

    // 7. Si se aprobó el paso 0 (autorización extraordinaria de Dirección),
    //    lanzar el flujo de aprobación normal completo.
    if ((myApproval.approval_order ?? -1) === 0) {
      // Obtener el solicitante de la orden para recrear el flujo correcto
      const { data: orderData } = await supabaseAdmin
        .from('orders')
        .select('applicant_id, is_urgent')
        .eq('id', orderId)
        .single();

      if (orderData?.applicant_id) {
        try {
          await launchNormalApprovalFlow(
            orderId,
            orderData.applicant_id,
            orderData.is_urgent || false
          );
        } catch (e) {
          console.error('[approve] Error lanzando flujo normal tras autorización extraordinaria:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Autorización extraordinaria aprobada. El flujo de aprobación normal ha comenzado.',
        allApproved: false,
        extraordinaryApproved: true,
        filesUploaded: uploadedFileIds.length,
      });
    }

    // 8. Verificar si todas las aprobaciones (flujo normal) están completas
    const { data: updatedApprovals, error: checkError } = await supabaseAdmin
      .from('order_approvals')
      .select('id, status, department_id, approval_order')
      .eq('order_id', orderId)
      .gt('approval_order', 0); // Excluir el paso 0 ya aprobado

    if (checkError) {
      console.error('Error verificando aprobaciones:', checkError);
    }

    const allApproved = updatedApprovals?.every((a: { status: ApprovalStatus | null }) => a.status === 'approved');

    // 9. Si todas están aprobadas, cambiar estado de la orden
    if (allApproved) {
      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderUpdateError) {
        console.error('Error actualizando orden a approved:', orderUpdateError);
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
        console.error('Error actualizando orden a in_progress:', orderUpdateError);
      }
    }

    return NextResponse.json({
      success: true,
      message: allApproved ? 'Orden completamente aprobada' : 'Aprobacion registrada exitosamente',
      allApproved,
      filesUploaded: uploadedFileIds.length,
    });
  } catch (error) {
    console.error('Approve endpoint error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
