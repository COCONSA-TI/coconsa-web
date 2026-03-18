import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { OrderApprovalWithRelations, ApprovalStatus } from '@/types/database';

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
    
    // Parsear request - puede ser JSON o FormData
    let comments = '';
    const files: File[] = [];
    
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('multipart/form-data')) {
      // Manejar FormData (con archivos)
      const formData = await request.formData();
      comments = formData.get('comments') as string || '';
      
      // Extraer archivos
      for (const [key, value] of formData) {
        if (key.startsWith('file_') && value instanceof File) {
          files.push(value);
        }
      }
    } else {
      // Manejar JSON
      const body = await request.json();
      comments = body.comments || '';
    }

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

    // 5. Subir archivos a Supabase Storage si existen
    const uploadedFileIds: string[] = [];
    if (files.length > 0) {
      for (const file of files) {
        try {
          // Validar tamaño (máx 10MB)
          if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json(
              { success: false, error: `Archivo ${file.name} excede el límite de 10MB` },
              { status: 400 }
            );
          }

          // Validar tipo MIME
          const allowedMimes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          ];
          
          if (!allowedMimes.includes(file.type)) {
            return NextResponse.json(
              { success: false, error: `Tipo de archivo no permitido: ${file.type}` },
              { status: 400 }
            );
          }

          // Convertir File a Buffer
          const buffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(buffer);
          
          // Crear ruta: order-attachments/{orderId}/{timestamp}_{filename}
          const timestamp = Date.now();
          const storagePath = `${orderId}/${timestamp}_${file.name}`;
          
          // Subir a Storage
          const { error: uploadError } = await supabaseAdmin
            .storage
            .from('order-attachments')
            .upload(storagePath, uint8Array, {
              contentType: file.type,
              upsert: false,
            });

          if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return NextResponse.json(
              { success: false, error: `Error al subir archivo ${file.name}: ${uploadError.message}` },
              { status: 500 }
            );
          }

          // Obtener URL pública del archivo
          const { data: { publicUrl } } = supabaseAdmin
            .storage
            .from('order-attachments')
            .getPublicUrl(storagePath);

          // Guardar metadata en order_attachments
          const { data: attachmentData, error: insertError } = await supabaseAdmin
            .from('order_attachments')
            .insert({
              order_id: orderId,
              uploaded_by: session.userId,
              file_name: file.name,
              file_size: file.size,
              file_type: file.type,
              file_url: publicUrl,
              storage_path: storagePath,
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
          console.error('Error processing file:', error);
          return NextResponse.json(
            { success: false, error: `Error procesando archivo ${file.name}` },
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

    // 7. Verificar si todas las aprobaciones están completas
    const { data: updatedApprovals, error: checkError } = await supabaseAdmin
      .from('order_approvals')
      .select('id, status, department_id, approval_order')
      .eq('order_id', orderId);

    if (checkError) {
      console.error('Error verificando aprobaciones:', checkError);
    }

    const allApproved = updatedApprovals?.every((a: { status: ApprovalStatus | null }) => a.status === 'approved');

    // 8. Si todas están aprobadas, cambiar estado de la orden
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
