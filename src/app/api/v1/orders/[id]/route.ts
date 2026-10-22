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
  insumo_clave?: string | null;
  is_extra_budget?: boolean;
  extra_budget_reason?: string | null;
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
  is_piecework: boolean;
  has_extra_budget_approval?: boolean | null;
  extra_budget_items_count?: number | null;
};

// Función para recrear aprobaciones
async function recreateOrderApprovals(
  orderId: string,
  applicantId: string,
  isUrgent: boolean = false,
  requiresExtraBudgetApproval: boolean = false,
  storeName?: string,
  storeTypeCode?: string | null
) {
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

  if (isUrgent && isApplicantDeptHead && !requiresExtraBudgetApproval) {
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

    return true; // in_progress
  } else {
    // Determinar la gerencia responsable (Paso 1)
    const isMaquinaria = storeTypeCode
      ? storeTypeCode === 'maquinaria'
      : (storeName ? (storeName.trim().toLowerCase() === 'maquinaria' || /^0*30\b/i.test(storeName.trim())) : false);
    const isObra = storeTypeCode
      ? storeTypeCode === 'obra'
      : !isMaquinaria;

    let initialDept: Department | undefined;

    if (requiresExtraBudgetApproval || isObra) {
      // OBRAS o AUTORIZACIÓN ESPECIAL: Siempre y estrictamente Gerencia de Construcción (NUNCA Finanzas)
      initialDept = departments.find((d: Department) => d.code === 'gerencia_construccion') ||
        departments.find((d: Department) => d.code?.includes('construccion')) ||
        departments.find((d: Department) => d.name?.toLowerCase().includes('construcci'));
    } else if (isMaquinaria) {
      initialDept = departments.find((d: Department) => d.code === 'gerencia_maquinaria') ||
        departments.find((d: Department) => d.name?.toLowerCase().includes('maquinaria'));
    } else {
      // 'otro' (gastos generales, oficinas, etc.)
      const applicantDept = departments.find((d: Department) => d.id === applicantDepartmentId);
      if (applicantDept && applicantDept.approval_order === 1) {
        initialDept = applicantDept;
      } else {
        initialDept = departments.find((d: Department) => d.code === 'gerencia_construccion') ||
          departments.find((d: Department) => d.code?.includes('construccion')) ||
          departments.find((d: Department) => d.name?.toLowerCase().includes('construcci'));
      }
    }

    // 1. Aprobación del primer paso (Gerencia):
    // Siempre inicia en 'pending' para que Gerencia revise/autorice y la orden muestre la tag correcta en el dashboard
    if (initialDept) {
      approvalsToCreate.push({
        order_id: orderId,
        department_id: initialDept.id,
        status: 'pending',
        approval_order: initialDept.approval_order || 1,
        approver_id: null,
        approved_at: null,
        comments: requiresExtraBudgetApproval
          ? 'Autorización especial requerida: conceptos fuera de presupuesto o agotados'
          : null,
      });
    }

    // 2. Aprobaciones para el resto del flujo (Contraloría 2, Dirección 3, Contabilidad 4, Pagos 5)
    const subsequentDepartments = departments.filter(
      (d: Department) => d.approval_order && d.approval_order > 1 && d.id !== initialDept?.id
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

  const { error: insertError } = await supabaseAdmin
    .from('order_approvals')
    .insert(approvalsToCreate);

  if (insertError) {
    throw new Error('Error al crear aprobaciones: ' + insertError.message);
  }

  return false;
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

    const typedOrder = order as DBOrderDetail & { payment_proof_url?: string | null, machine_id?: number | null };

    // Obtener datos relacionados (con store_type)
    let store: any = null;
    const { data: storeWithTypes, error: storeTypesErr } = await supabaseAdmin
      .from('stores')
      .select('name, store_type_id, store_type:store_types(code)')
      .eq('id', typedOrder.store_id)
      .single();

    if (!storeTypesErr && storeWithTypes) {
      store = storeWithTypes;
    } else {
      const { data: storeFallback } = await supabaseAdmin
        .from('stores')
        .select('name')
        .eq('id', typedOrder.store_id)
        .single();
      store = storeFallback;
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('full_name, email, department_id')
      .eq('id', typedOrder.applicant_id)
      .single();

    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('commercial_name')
      .eq('id', typedOrder.supplier_id)
      .single();

    let machineName: string | null = null;
    if (typedOrder.machine_id) {
      const { data: machine } = await supabaseAdmin
        .from('machines')
        .select('name')
        .eq('id', typedOrder.machine_id)
        .single();
      machineName = machine?.name || null;
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

    const normalizedStatus = statusMap[typedOrder.status] || 'pending';

    // Obtener las aprobaciones pendientes para saber en qué departamento está la orden (la de menor approval_order)
    const { data: pendingApprovals } = await supabaseAdmin
      .from('order_approvals')
      .select('department_id, approval_order')
      .eq('order_id', orderId)
      .in('status', ['pending', 'PENDIENTE'])
      .order('approval_order', { ascending: true })
      .limit(1);

    let currentDepartmentName: string | null = null;
    if (pendingApprovals && pendingApprovals.length > 0) {
      const { data: dept } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', pendingApprovals[0].department_id)
        .single();
      currentDepartmentName = dept?.name || null;
    }

    const rawStoreType = Array.isArray(store?.store_type)
      ? store?.store_type[0]
      : store?.store_type;
    const storeTypeCode: string | null = rawStoreType?.code || null;

    // Si la orden está pendiente o en proceso pero no tiene aprobación pendiente registrada,
    // resolver de forma inteligente para garantizar que esté etiquetada al 100% de las veces
    if ((normalizedStatus === 'pending' || normalizedStatus === 'in_progress') && !currentDepartmentName) {
      if (normalizedStatus === 'in_progress') {
        currentDepartmentName = 'Contraloría';
      } else if (storeTypeCode === 'maquinaria' || (store?.name && (store.name.toLowerCase().includes('maquinaria') || typedOrder.machine_id))) {
        currentDepartmentName = 'Maquinaria';
      } else if (storeTypeCode === 'obra' || store?.name) {
        currentDepartmentName = 'Construcción';
      } else if (user?.department_id) {
        const { data: uDept } = await supabaseAdmin
          .from('departments')
          .select('name, approval_order, code')
          .eq('id', user.department_id)
          .single();
        if (uDept && (uDept.approval_order === 1 || uDept.code?.startsWith('gerencia'))) {
          currentDepartmentName = uDept.name;
        } else {
          currentDepartmentName = 'Construcción';
        }
      } else {
        currentDepartmentName = 'Construcción';
      }
    } else if (normalizedStatus !== 'pending' && normalizedStatus !== 'in_progress') {
      currentDepartmentName = null;
    }

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
      is_piecework: typedOrder.is_piecework || false,
      payment_proof_url: typedOrder.payment_proof_url || null,
      machine_id: typedOrder.machine_id || null,
      machine_name: machineName,
      current_department_name: currentDepartmentName,
      has_extra_budget_approval: Boolean(typedOrder.has_extra_budget_approval),
      extra_budget_items_count: typedOrder.extra_budget_items_count || 0,
      items: itemsArray.map((item, index: number) => ({
        id: `${typedOrder.id}-${index}`,
        name: item.nombre || 'N/A',
        quantity: item.cantidad || 0,
        unit: item.unidad || 'N/A',
        unit_price: item.precioUnitario || 0,
        subtotal: item.precioTotal || (item.cantidad * item.precioUnitario) || 0,
        supplier_name: supplierName,
        insumo_clave: item.insumo_clave || null,
        is_extra_budget: Boolean(item.is_extra_budget || (!item.insumo_clave && typedOrder.has_extra_budget_approval)),
        extra_budget_reason: item.extra_budget_reason || null,
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
      .select('id, status, applicant_id, is_urgent, is_definitive_rejection, store_id, has_extra_budget_approval')
      .eq('id', orderId)
      .single();

    if (orderError || !existingOrder) {
      return NextResponse.json(
        { error: "Orden no encontrada" },
        { status: 404 }
      );
    }

    // Consultar información del usuario autenticado para verificar permisos gerenciales
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, email, is_department_head, department:departments(id, code, name)')
      .eq('id', session!.userId)
      .single();

    const userDept = Array.isArray(userData?.department) ? userData?.department[0] : userData?.department;
    const deptCode = (userDept?.code || '').toLowerCase();
    const isDirection = deptCode === 'direccion' || deptCode.includes('dir');
    const isConstruccionHead = Boolean(userData?.is_department_head) && (deptCode === 'gerencia_construccion' || deptCode.includes('construccion'));
    const isContraloriaHead = Boolean(userData?.is_department_head) && (deptCode === 'contraloria' || deptCode.includes('contralor'));
    const isAdminUser = session!.role === 'admin';

    // Permiso especial: Dirección, Gerente de Construcción, Gerente/Jefe de Contraloría y Admin pueden editar en cualquier momento
    const canSpecialEdit = isAdminUser || isDirection || isConstruccionHead || isContraloriaHead;

    if (!canSpecialEdit) {
      // Flujo normal: solo se pueden editar órdenes rechazadas que no sean definitivas y por el solicitante
      const isRejected = existingOrder.status === 'RECHAZADA' || existingOrder.status === 'rejected';
      if (!isRejected) {
        return NextResponse.json(
          { error: "Solo se pueden editar órdenes rechazadas" },
          { status: 400 }
        );
      }

      if (existingOrder.is_definitive_rejection) {
        return NextResponse.json(
          { error: "Esta orden fue rechazada de forma definitiva y no puede ser editada ni reenviada" },
          { status: 400 }
        );
      }

      if (existingOrder.applicant_id !== session!.userId) {
        return NextResponse.json(
          { error: "Solo el solicitante original puede editar esta orden" },
          { status: 403 }
        );
      }
    }

    // Procesar el body (JSON-only con presigned URLs)
    if (!request.headers.get('content-type')?.includes('application/json')) {
      return NextResponse.json(
        { error: 'El cuerpo debe ser JSON con evidenceUrls (presigned URLs)' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const { items, justification, store_name, currency = 'MXN', retention, payment_type, tax_type, iva_percentage, is_piecework, evidenceUrls = [] } = body;

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
      proveedor: item.supplier_name || item.proveedor,
      ...(item.insumo_clave ? { insumo_clave: item.insumo_clave } : {}),
      ...(item.is_extra_budget ? { is_extra_budget: true, extra_budget_reason: item.extra_budget_reason } : {}),
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
      updated_at: new Date().toISOString(),
    };

    // Si es edición normal del solicitante tras rechazo, cambiar estado a pendiente
    // Si es edición especial gerencial/dirección, se preserva el estado original
    if (!canSpecialEdit) {
      updateData.status = 'PENDIENTE';
    }

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

    if (is_piecework !== undefined) {
      updateData.is_piecework = is_piecework;
    }

    // Las URLs de evidencia ya vienen del frontend (presigned URLs)
    if (evidenceUrls.length > 0) {
      updateData.justification_prove = evidenceUrls.join(',');
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

    // Si NO es edición especial (es el solicitante original tras rechazo), recrear el flujo de aprobaciones
    if (!canSpecialEdit) {
      try {
        let orderStoreName: string | undefined;
        let orderStoreTypeCode: string | null = null;
        const targetStoreId = storeIdToUse || existingOrder.store_id;
        if (targetStoreId) {
          const { data: st, error: stErr } = await supabaseAdmin
            .from('stores')
            .select('name, store_type_id, store_type:store_types(code)')
            .eq('id', targetStoreId)
            .single();
          if (!stErr && st) {
            orderStoreName = st.name;
            const rType = Array.isArray(st.store_type) ? st.store_type[0] : st.store_type;
            orderStoreTypeCode = rType?.code || null;
          } else {
            const { data: stFallback } = await supabaseAdmin.from('stores').select('name').eq('id', targetStoreId).single();
            orderStoreName = stFallback?.name;
          }
        }

        const isAutoApproved = await recreateOrderApprovals(
          orderId,
          existingOrder.applicant_id,
          existingOrder.is_urgent || false,
          Boolean(updatedOrder?.has_extra_budget_approval ?? existingOrder.has_extra_budget_approval),
          orderStoreName,
          orderStoreTypeCode
        );
        
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
    }

    // Recalcular automáticamente el presupuesto de la obra para mantener consistencia
    const storeIdForRecalc = storeIdToUse || existingOrder.store_id;
    if (storeIdForRecalc) {
      try {
        await supabaseAdmin.rpc('recalcular_presupuesto_obra', { p_store_id: storeIdForRecalc });
      } catch (rpcErr) {
        console.warn('[orders/PUT] No se pudo recalcular presupuesto de obra:', rpcErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: canSpecialEdit ? "Orden de compra actualizada exitosamente" : "Orden actualizada y reenviada para aprobación",
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
