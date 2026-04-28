import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { OrderItem, Department } from "@/types/database";
import { calculateRetentions } from "@/types/database";

interface OrderItemDisplay {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  precioTotal: number;
  proveedor?: string;
  supplier_name?: string;
}

type DBOrderDetail = {
  id: string;
  created_at: string;
  store_id: number;
  supplier_id: number;
  total: number;
  currency: string;
  status: string;
  applicant_id: string;
  justification: string;
  justification_prove: string | null;
  retention: string | null;
  payment_type: string | null;
  tax_type: string | null;
  iva_percentage: number | null;
  iva: number | null;
  subtotal: number | null;
  items: string;
  is_urgent: boolean;
  urgency_justification: string | null;
  is_definitive_rejection: boolean;
  payment_proof_url: string | null;
};

// Función para recrear aprobaciones
async function recreateOrderApprovals(orderId: string, applicantId: string, isUrgent: boolean = false) {
  // Eliminar aprobaciones existentes
  await supabaseAdmin
    .from('order_approvals')
    .delete()
    .eq('order_id', orderId);

  // Obtener información del solicitante
  const { data: applicant, error: applicantError } = await supabaseAdmin
    .from('users')
    .select('is_department_head, department_id')
    .eq('id', applicantId)
    .single();

  if (applicantError || !applicant?.department_id) {
    throw new Error('Error al obtener información del solicitante');
  }

  const isApplicantDeptHead = applicant.is_department_head;
  const applicantDepartmentId = applicant.department_id;

  // Obtener todos los departamentos que requieren aprobación
  const { data: departments, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('requires_approval', true)
    .order('approval_order');

  if (deptError || !departments) {
    throw new Error('Error al obtener departamentos');
  }

  // Crear aprobaciones para cada departamento
  const approvalsToCreate = [];

  if (isUrgent && isApplicantDeptHead) {
    // ORDEN URGENTE: Solo crear aprobaciones para Dirección (3), Contabilidad (4) y Pagos (5)
    const urgentDepartments = departments.filter(
      (d: Department) => d.approval_order && d.approval_order >= 3
    );

    for (const dept of urgentDepartments) {
      approvalsToCreate.push({
        order_id: orderId,
        department_id: dept.id,
        status: 'pending',
        approval_order: dept.approval_order,
      });
    }
  } else {
    // ORDEN NORMAL: Determinar flujo según el departamento del solicitante
    const applicantDept = departments.find((d: Department) => d.id === applicantDepartmentId);
    const applicantApprovalOrder = applicantDept?.approval_order ?? 0;

    if (applicantApprovalOrder >= 2) {
      // El solicitante pertenece a un departamento del flujo de aprobación (Contraloría, Dirección, Contabilidad, Pagos).
      // NO se incluye Gerencia (step 1) porque no tienen gerente que les apruebe.
      // NO se auto-aprueba su propio paso para evitar conflictos de interés.
      // Flujo: Contraloría (2) → Dirección (3) → Contabilidad (4) → Pagos (5)
      const flowDepartments = departments.filter(
        (d: Department) => d.approval_order && d.approval_order >= 2
      );

      for (const dept of flowDepartments) {
        approvalsToCreate.push({
          order_id: orderId,
          department_id: dept.id,
          status: 'pending',
          approval_order: dept.approval_order,
        });
      }
    } else {
      // El solicitante es de una Gerencia (approval_order = 1) o no tiene departamento en el flujo.
      // Flujo completo: Gerencia (1) → Contraloría (2) → Dirección (3) → Contabilidad (4) → Pagos (5)

      // 1. Aprobación del departamento del solicitante
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

      // 2. Aprobaciones para el resto del flujo
      const subsequentDepartments = departments.filter(
        (d: Department) => d.approval_order && d.approval_order > 1 && d.id !== applicantDepartmentId
      );

      for (const dept of subsequentDepartments) {
        approvalsToCreate.push({
          order_id: orderId,
          department_id: dept.id,
          status: 'pending',
          approval_order: dept.approval_order,
        });
      }
    }
  }

  const { error: insertError } = await supabaseAdmin
    .from('order_approvals')
    .insert(approvalsToCreate);

  if (insertError) {
    throw new Error('Error al crear aprobaciones: ' + insertError.message);
  }

  // Determinar si la orden debe empezar en 'in_progress':
  // - Orden urgente (sin gerencia ni contraloría)
  // - Dept head de gerencia (auto-aprobó step 1)
  // - Solicitante de depto con approval_order >= 2 (sin gerencia en el flujo)
  const applicantDeptForStatus = departments.find((d: Department) => d.id === applicantDepartmentId);
  const applicantApprovalOrder = applicantDeptForStatus?.approval_order ?? 0;
  return isUrgent || (isApplicantDeptHead && applicantApprovalOrder === 1) || applicantApprovalOrder >= 2;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos de visualización
    const { error } = await requirePermission('orders', 'view');
    if (error) return error;

    const { id } = await params;
    const orderId = id;

    // Obtener detalles de la orden
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    const typedOrder = order as DBOrderDetail & { payment_proof_url?: string | null };

    // Obtener datos relacionados
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', typedOrder.store_id)
      .single();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', typedOrder.applicant_id)
      .single();

    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('commercial_name')
      .eq('id', typedOrder.supplier_id)
      .single();

    // Obtener las aprobaciones pendientes para saber en qué departamento está la orden (la de menor approval_order)
    const { data: pendingApprovals } = await supabaseAdmin
      .from('order_approvals')
      .select('department_id, approval_order')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .order('approval_order', { ascending: true })
      .limit(1);

    let currentDepartmentName = null;
    if (pendingApprovals && pendingApprovals.length > 0) {
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', pendingApprovals[0].department_id)
        .single();
      currentDepartmentName = dept?.name || null;
    }

    // Mapear status de español a inglés (soporta ambos formatos)
    const statusMap: Record<string, string> = {
      // Español
      'PENDIENTE': 'pending',
      'APROBADA': 'approved',
      'RECHAZADA': 'rejected',
      'EN_PROCESO': 'in_progress',
      'COMPLETADA': 'completed',
      // Inglés (ya en formato correcto)
      'pending': 'pending',
      'approved': 'approved',
      'rejected': 'rejected',
      'in_progress': 'in_progress',
      'completed': 'completed'
    };

    let itemsArray: OrderItem[] = [];
    try {
      // Parsear items si es string JSON
      if (typeof typedOrder.items === 'string' && typedOrder.items.trim()) {
        itemsArray = JSON.parse(typedOrder.items) as OrderItem[];
      }
    } catch {
      itemsArray = [];
    }

    const supplierName = supplier?.commercial_name || 'N/A';

    // Formatear respuesta
    const orderDetails = {
      id: typedOrder.id,
      created_at: typedOrder.created_at,
      store_name: store?.name || 'N/A',
      supplier_name: supplierName,
      total: typedOrder.total,
      currency: typedOrder.currency,
      status: statusMap[typedOrder.status] || 'pending',
      applicant_name: user?.full_name || 'N/A',
      applicant_email: user?.email || 'N/A',
      justification: typedOrder.justification,
      justification_prove: typedOrder.justification_prove,
      retention: typedOrder.retention,
      payment_type: typedOrder.payment_type,
      tax_type: typedOrder.tax_type,
      iva_percentage: typedOrder.iva_percentage,
      iva: typedOrder.iva,
      subtotal: typedOrder.subtotal,
      is_urgent: typedOrder.is_urgent || false,
      urgency_justification: typedOrder.urgency_justification,
      is_definitive_rejection: typedOrder.is_definitive_rejection || false,
      payment_proof_url: typedOrder.payment_proof_url || null,
      current_department_name: currentDepartmentName,
      items: itemsArray.map((item, index: number) => ({
        id: `${typedOrder.id}-${index}`,
        name: item.nombre || 'N/A',
        quantity: item.cantidad || 0,
        unit: item.unidad || 'N/A',
        unit_price: item.precioUnitario || 0,
        subtotal: item.precioTotal || (item.cantidad * item.precioUnitario) || 0,
        supplier_name: supplierName
      }))
    };

    return NextResponse.json({
      success: true,
      order: orderDetails
    });

  } catch (error) {
    console.error('[orders/GET] Error inesperado:', error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar orden rechazada
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, session } = await requirePermission('orders', 'edit');
    if (authError) return authError;

    const { id } = await params;
    const orderId = id;

    // Obtener la orden actual
    const { data: existingOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, status, applicant_id, is_urgent, is_definitive_rejection')
      .eq('id', orderId)
      .single();

    if (orderError || !existingOrder) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que la orden esté rechazada (puede venir en español o inglés)
    const isRejected = existingOrder.status === 'RECHAZADA' || existingOrder.status === 'rejected';
    if (!isRejected) {
      return NextResponse.json(
        { error: "Solo se pueden editar órdenes rechazadas" },
        { status: 400 }
      );
    }

    // Verificar que no sea un rechazo definitivo
    if (existingOrder.is_definitive_rejection) {
      return NextResponse.json(
        { error: "Esta orden fue rechazada de forma definitiva y no puede ser editada ni reenviada" },
        { status: 400 }
      );
    }

    // Verificar que el usuario sea el solicitante original o admin
    if (existingOrder.applicant_id !== session!.userId && session!.role !== 'admin') {
      return NextResponse.json(
        { error: "Solo el solicitante original puede editar esta orden" },
        { status: 403 }
      );
    }

    // Procesar el body
    const contentType = request.headers.get('content-type') || '';
    let body: {
      items: OrderItem[];
      justification?: string;
      store_name?: string;
      currency?: string;
      retention?: string;
      payment_type?: string;
      tax_type?: string;
      iva_percentage?: number;
      evidenceUrls?: string[];
    };
    let evidenceFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const orderDataString = formData.get('orderData');
      
      if (typeof orderDataString === 'string') {
        body = JSON.parse(orderDataString);
      } else {
        return NextResponse.json(
          { error: 'Datos de orden inválidos' },
          { status: 400 }
        );
      }
      
      const evidenceEntries = formData.getAll('evidence');
      evidenceFiles = evidenceEntries.filter((entry): entry is File => entry instanceof File);
    } else {
      body = await request.json();
    }

    const { items, justification, store_name, currency = 'MXN', retention, payment_type, tax_type, iva_percentage, evidenceUrls = [] } = body;

    // Validaciones
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "La orden debe tener al menos un artículo" },
        { status: 400 }
      );
    }

    // Validar estructura de items
    const invalidItems = items.filter((item: OrderItem) => 
      !item.nombre || 
      !item.cantidad || 
      !item.unidad || 
      !item.precioUnitario ||
      !item.proveedor ||
      parseFloat(String(item.cantidad)) <= 0 ||
      item.precioUnitario <= 0
    );

    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "Algunos artículos tienen datos incompletos o inválidos" },
        { status: 400 }
      );
    }

    // Buscar el almacén si se proporcionó
    let storeIdToUse = null;
    if (store_name) {
      const { data: storeData } = await supabaseAdmin
        .from('stores')
        .select('id')
        .ilike('name', `%${store_name}%`)
        .limit(1)
        .single();
      
      if (storeData) {
        storeIdToUse = storeData.id;
      }
    }

    // Buscar el proveedor del primer item
    const supplierName = items[0].supplier_name || items[0].proveedor;
    let supplierId = items[0].supplier_id;
    
    if (!supplierId && supplierName) {
      const { data: supplierData } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .ilike('commercial_name', `%${supplierName}%`)
        .limit(1)
        .single();
      
      if (supplierData) {
        supplierId = supplierData.id;
      }
    }

    // Calcular totales
    const subtotal = items.reduce((sum: number, item: OrderItem) => {
      const cantidad = parseFloat(String(item.cantidad)) || 0;
      const precio = item.precioUnitario || 0;
      return sum + (cantidad * precio);
    }, 0);

    // Handle legacy 'retencion' tax_type -> treat as 'con_iva'
    const effectiveTaxType = tax_type === 'retencion' ? 'con_iva' : tax_type;

    // Calcular IVA solo si tax_type es 'con_iva' (or legacy 'retencion')
    const effectiveIvaPercentage = effectiveTaxType === 'con_iva' ? (iva_percentage || 16) : 0;
    const iva = effectiveTaxType === 'con_iva' ? subtotal * (effectiveIvaPercentage / 100) : 0;
    
    // Calcular retenciones
    let retentionTotal = 0;
    if (retention && effectiveTaxType === 'con_iva') {
      try {
        const retentionKeys = JSON.parse(retention);
        if (Array.isArray(retentionKeys) && retentionKeys.length > 0) {
          const retResult = calculateRetentions(retentionKeys, subtotal, iva);
          retentionTotal = retResult.totalRetention;
        }
      } catch {
        // Legacy free-text retention - no calculation
      }
    }
    
    const total = subtotal + iva - retentionTotal;
    const totalQuantity = items.reduce((sum: number, item: OrderItem) => 
      sum + parseFloat(String(item.cantidad)), 0
    );

    // Preparar items con precio total
    const itemsWithTotal = items.map((item: OrderItem) => ({
      nombre: item.nombre,
      cantidad: parseFloat(String(item.cantidad)),
      unidad: item.unidad,
      precioUnitario: item.precioUnitario,
      precioTotal: parseFloat(String(item.cantidad)) * item.precioUnitario,
      proveedor: item.supplier_name || item.proveedor
    }));

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      items: JSON.stringify(itemsWithTotal),
      quantity: totalQuantity,
      price_excluding_iva: subtotal,
      price_with_iva: total,
      subtotal: subtotal,
      iva: iva,
      total: total,
      currency: currency,
      payment_type: payment_type || '',
      tax_type: effectiveTaxType || 'sin_iva',
      iva_percentage: effectiveIvaPercentage || null,
      status: 'PENDIENTE', // Cambiar estado a pendiente
      updated_at: new Date().toISOString(),
    };

    if (justification) {
      updateData.justification = justification;
    }

    if (storeIdToUse) {
      updateData.store_id = storeIdToUse;
    }

    if (supplierId) {
      updateData.supplier_id = supplierId;
    }

    if (retention !== undefined) {
      updateData.retention = retention;
    }

    // Manejar archivos de evidencia de FormData (fallback) y URLs presignadas
    const finalEvidenceUrls = [...evidenceUrls];
    if (evidenceFiles.length > 0) {
      const BUCKET_NAME = "Coconsa";
      
      for (const file of evidenceFiles) {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `orders/${orderId}/evidence/${timestamp}_${sanitizedName}`;
        
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const { error: uploadError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false
          });
        
        if (!uploadError) {
          const { data: urlData } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
          
          if (urlData?.publicUrl) {
            finalEvidenceUrls.push(urlData.publicUrl);
          }
        }
      }
    }
    
    if (finalEvidenceUrls.length > 0) {
      updateData.justification_prove = finalEvidenceUrls.join(',');
    }

    // Actualizar la orden
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('[orders/PUT] Error al actualizar orden:', updateError);
      return NextResponse.json(
        { error: "Error al actualizar la orden" },
        { status: 500 }
      );
    }

    // Recrear el flujo de aprobaciones
    try {
      const isAutoApproved = await recreateOrderApprovals(orderId, existingOrder.applicant_id, existingOrder.is_urgent || false);
      
      // Si se auto-aprobó el primer nivel, actualizar estado
      if (isAutoApproved) {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'EN_PROCESO' })
          .eq('id', orderId);
      }
    } catch (approvalError) {
      console.error('Error recreando aprobaciones:', approvalError);
      // No fallar la actualización si falla la creación de aprobaciones
    }

    return NextResponse.json({
      success: true,
      message: "Orden actualizada y reenviada para aprobación",
      order: updatedOrder
    });

  } catch (error) {
    console.error('[orders/PUT] Error inesperado:', error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
