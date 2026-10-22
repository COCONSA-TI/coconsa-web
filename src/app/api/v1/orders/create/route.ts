import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Department, OrderItem, CreateOrderRequest } from "@/types/database";
import { calculateRetentions, RETENTION_OPTIONS } from "@/types/database";

const BUCKET_NAME = "Coconsa";

const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_EVIDENCE_FILES = 5;

// Función para subir archivos a Supabase Storage
async function uploadEvidenceFiles(files: File[], orderId: string): Promise<string[]> {
  const uploadedUrls: string[] = [];

  if (files.length > MAX_EVIDENCE_FILES) {
    throw new Error(`Se permiten máximo ${MAX_EVIDENCE_FILES} archivos de evidencia`);
  }

  // Verificar que el bucket existe
  await supabaseAdmin.storage.listBuckets();
  
  for (const file of files) {
    // Validar tipo MIME
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.type)) {
      throw new Error(`Tipo de archivo no permitido: "${file.type}". Solo se aceptan imágenes (JPEG, PNG, WebP, GIF) y PDFs.`);
    }

    // Validar tamaño
    if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
      throw new Error(`El archivo "${file.name}" excede el límite de 10 MB.`);
    }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const filePath = `orders/${orderId}/evidence/${timestamp}_evidence.${ext}`;
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const { error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (error) {
      continue;
    }
    
    // Obtener la URL pública del archivo
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    if (urlData?.publicUrl) {
      uploadedUrls.push(urlData.publicUrl);
    }
  }
  
  return uploadedUrls;
}

// Función para crear aprobaciones en el servidor
async function createOrderApprovalsServer(
  orderId: string,
  applicantDepartmentId: string,
  applicantId: string,
  isUrgent: boolean = false,
  requiresExtraBudgetApproval: boolean = false,
  storeName?: string,
  storeTypeCode?: string | null
) {
  // Obtener información del solicitante
  const { data: applicant, error: applicantError } = await supabaseAdmin
    .from('users')
    .select('is_department_head, department_id')
    .eq('id', applicantId)
    .single();

  if (applicantError) {
    throw new Error('Error al obtener información del solicitante');
  }

  const isApplicantDeptHead = applicant?.is_department_head && applicant?.department_id === applicantDepartmentId;

  // Obtener todos los departamentos que requieren aprobación
  const { data: departments, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('requires_approval', true)
    .order('approval_order');

  if (deptError || !departments) {
    throw new Error('Error al obtener departamentos');
  }

  // Crear aprobaciones para cada departamento en el flujo
  const approvalsToCreate = [];

  if (isUrgent && isApplicantDeptHead && !requiresExtraBudgetApproval) {
    // ORDEN URGENTE: Solo crear aprobaciones para Dirección (3), Contabilidad (4) y Pagos (5)
    // Se saltan: Gerencia del solicitante (1) y Contraloría (2)
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

    await supabaseAdmin
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId);
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
      // OBRAS o AUTORIZACIÓN ESPECIAL: Siempre y estrictamente Gerencia de Construcción (NUNCA Finanzas u otro depto)
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
    // Siempre inicia en 'pending' para que Gerencia revise/autorice y la orden muestre la tag correcta en el dashboard (NO Contraloría)
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

  return true;
}

export async function POST(request: Request) {
  try {
    // Verificar permisos de creación
    const { error: authError, session } = await requirePermission('orders', 'create');
    if (authError) return authError;

    // Obtener el ID del solicitante siempre desde la sesión del servidor,
    // nunca desde el body del request (previene suplantación de identidad)
    const authenticatedUserId = session!.userId;

    // Solo aceptar JSON request con presigned URLs (evita payload gigante de Vercel)
    // Los archivos ya se subieron directamente a Supabase vía presigned URLs
    const body: CreateOrderRequest = await request.json();

    const {
      applicant_name,
      applicant_id: _applicant_id_ignored, // ignorado: siempre se usa la sesión del servidor
      store_name,
      machine_name,
      machine_id,
      store_id, // ID opcional desde el chatbot
      supplier_name, // Proveedor único para toda la orden (desde chatbot)
      supplier_id, // ID opcional del proveedor (desde chatbot)
      items,
      justification,
      currency = 'MXN',
      retention,
      payment_type,
      tax_type,
      iva_percentage,
      is_urgent = false,
      urgency_justification,
      is_piecework = false,
      evidenceUrls = [],
    } = body;

    // Validaciones básicas
    if (!store_name || !items || items.length === 0) {
      const missing = [];
      if (!store_name) missing.push('Centro de costos');
      if (!items || items.length === 0) missing.push('Artículos');
      
      return NextResponse.json(
        { error: `Faltan datos requeridos: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    if (store_name.trim().toLowerCase() === 'maquinaria' && (!machine_name || !machine_name.trim())) {
      return NextResponse.json(
        { error: 'Debes seleccionar una máquina cuando el centro de costos es Maquinaria.' },
        { status: 400 }
      );
    }

    let finalMachineId: number | undefined | null = machine_id;
    if (!finalMachineId && machine_name && store_name.trim().toLowerCase() === 'maquinaria') {
      const { data: machineData } = await supabaseAdmin
        .from('machines')
        .select('id')
        .ilike('name', `%${machine_name}%`)
        .limit(1)
        .single();
      if (machineData) {
        finalMachineId = machineData.id;
      }
    }

    // Validar que si es urgente, tenga justificación de urgencia
    if (is_urgent && (!urgency_justification || urgency_justification.trim().length < 10)) {
      return NextResponse.json(
        { error: 'Las órdenes urgentes requieren una justificación de urgencia de al menos 10 caracteres' },
        { status: 400 }
      );
    }

    // Validar estructura de items
    const invalidItems = items.filter((item: OrderItem) => 
      !item.nombre || 
      !item.cantidad || 
      !item.unidad || 
      !item.precioUnitario ||
      parseFloat(String(item.cantidad)) <= 0 ||
      item.precioUnitario <= 0
    );

    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "Algunos artículos tienen datos incompletos o inválidos" },
        { status: 400 }
      );
    }

    // Obtener datos del solicitante desde la DB usando el ID de la sesión (no el del body)
    const userId: string = authenticatedUserId;
    let userDepartmentId: string | null = null;
    let userIsDeptHead: boolean = false;

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, department_id, is_department_head')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'No se encontró el usuario en el sistema.' },
        { status: 404 }
      );
    }
    userDepartmentId = userData.department_id;
    userIsDeptHead = userData.is_department_head || false;
    // Validar que solo jefes de departamento pueden crear órdenes urgentes
    if (is_urgent && !userIsDeptHead) {
      return NextResponse.json(
        { error: 'Solo los jefes de departamento pueden crear órdenes de urgencia' },
        { status: 403 }
      );
    }

    // Buscar el almacén por ID proporcionado o por nombre
    let storeIdToUse = store_id;
    let storeRecord: any = null;

    if (storeIdToUse) {
      const { data, error } = await supabaseAdmin
        .from('stores')
        .select('id, name, store_type_id, store_type:store_types(id, code, name)')
        .eq('id', storeIdToUse)
        .single();
      if (!error && data) {
        storeRecord = data;
      } else {
        const { data: fallbackData } = await supabaseAdmin
          .from('stores')
          .select('id, name')
          .eq('id', storeIdToUse)
          .single();
        storeRecord = fallbackData;
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('stores')
        .select('id, name, store_type_id, store_type:store_types(id, code, name)')
        .ilike('name', `%${store_name}%`)
        .limit(1)
        .single();
      if (!error && data) {
        storeRecord = data;
      } else {
        const { data: fallbackData } = await supabaseAdmin
          .from('stores')
          .select('id, name')
          .ilike('name', `%${store_name}%`)
          .limit(1)
          .single();
        storeRecord = fallbackData;
      }
      if (storeRecord) {
        storeIdToUse = storeRecord.id;
      }
    }

    if (!storeRecord || !storeIdToUse) {
      return NextResponse.json(
        { error: `No se encontró el almacén u obra "${store_name}". Verifica que esté registrado en el sistema.` },
        { status: 404 }
      );
    }

    // Extraer código de tipo de almacén ('obra', 'maquinaria', 'otro')
    const rawStoreType = Array.isArray(storeRecord.store_type)
      ? storeRecord.store_type[0]
      : storeRecord.store_type;
    const storeTypeCode: string | null = rawStoreType?.code || null;

    // Determinar si es maquinaria u obra (priorizando store_types con fallback por compatibilidad)
    const isMaquinaria = storeTypeCode
      ? storeTypeCode === 'maquinaria'
      : (store_name.trim().toLowerCase() === 'maquinaria' || /^0*30\b/i.test(store_name.trim()));

    const isObra = storeTypeCode
      ? storeTypeCode === 'obra'
      : !isMaquinaria;

    // Resolver proveedor único para toda la orden
    // Se acepta supplier_id o supplier_name a nivel de orden, o como fallback del primer item
    let finalSupplierId: string | number | undefined = supplier_id;
    const resolvedSupplierName = supplier_name || items[0]?.supplier_name || items[0]?.proveedor || '';

    if (!finalSupplierId && resolvedSupplierName) {
      const { data: supplierData, error: supplierError } = await supabaseAdmin
        .from('suppliers')
        .select('id')
        .ilike('commercial_name', `%${resolvedSupplierName}%`)
        .limit(1)
        .single();

      if (supplierError || !supplierData) {
        return NextResponse.json(
          { error: `No se encontró el proveedor "${resolvedSupplierName}". Verifica que esté dado de alta en el sistema.` },
          { status: 404 }
        );
      }
      finalSupplierId = supplierData.id;
    }

    if (!finalSupplierId) {
      return NextResponse.json(
        { error: 'Se requiere un proveedor para la orden de compra.' },
        { status: 400 }
      );
    }

    // ── Validar presupuesto y fijar precio unitario para insumos vinculados ──
    let requiresExtraBudgetApproval = false;
    let extraBudgetItemsCount = 0;

    // ÚNICAMENTE las tiendas clasificadas como 'obra' pueden requerir autorización especial
    if (storeIdToUse && isObra) {
      // Verificar si la obra tiene presupuesto cargado (insumos comprables activos con cantidad presupuestada > 0)
      const { count: insumoCount } = await supabaseAdmin
        .from('store_insumos')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', storeIdToUse)
        .eq('activo', true)
        .gt('cantidad_presupuestada', 0)
        .in('categoria', ['Materiales', 'Herramienta', 'Equipo']);

      const storeHasBudget = (insumoCount ?? 0) > 0;

      if (storeHasBudget) {
        const itemsConClaveVal = items.filter((item: OrderItem) => item.insumo_clave?.trim());
        if (itemsConClaveVal.length > 0) {
          const claves = itemsConClaveVal.map((i: OrderItem) => i.insumo_clave!.trim());
          const { data: dbInsumos } = await supabaseAdmin
            .from('store_insumos')
            .select('clave, costo_unitario, costo_autorizado, cantidad_presupuestada, cantidad_solicitada, cantidad_comprada')
            .eq('store_id', storeIdToUse)
            .in('clave', claves);

          for (const item of itemsConClaveVal) {
            const matched = dbInsumos?.find((di) => di.clave.trim().toLowerCase() === item.insumo_clave!.trim().toLowerCase());
            if (matched) {
              // El precio unitario proviene estrictamente del presupuesto de la obra (no modificable)
              const precioPresupuestado = (matched.costo_autorizado != null && matched.costo_autorizado > 0)
                ? matched.costo_autorizado
                : matched.costo_unitario;
              if (precioPresupuestado != null) {
                item.precioUnitario = precioPresupuestado;
              }

              const disponible = matched.cantidad_presupuestada - matched.cantidad_solicitada - matched.cantidad_comprada;
              const requestedQty = parseFloat(String(item.cantidad)) || 0;
              if (disponible <= 0) {
                item.is_extra_budget = true;
                item.extra_budget_reason = 'agotado';
              } else if (disponible < 1) {
                item.is_extra_budget = true;
                item.extra_budget_reason = 'menor_a_1';
              } else if (requestedQty > disponible) {
                item.is_extra_budget = true;
                item.extra_budget_reason = 'excede_disponible';
              }
            } else {
              item.is_extra_budget = true;
              item.extra_budget_reason = 'fuera_catalogo';
            }
          }
        }

        // Marcar items sin clave como fuera de catálogo si la obra tiene presupuesto
        for (const item of items) {
          if (!item.insumo_clave?.trim()) {
            item.is_extra_budget = true;
            item.extra_budget_reason = 'fuera_catalogo';
          }
        }

        const specialAuthItems = items.filter((item: OrderItem) => item.is_extra_budget);
        if (specialAuthItems.length > 0) {
          requiresExtraBudgetApproval = true;
          extraBudgetItemsCount = specialAuthItems.length;
        }
      } else {
        // En obras sin presupuesto: NO hay autorización especial ni restricciones
        requiresExtraBudgetApproval = false;
        extraBudgetItemsCount = 0;
        for (const item of items) {
          delete item.is_extra_budget;
          delete item.extra_budget_reason;
        }
      }
    } else {
      // Maquinaria u otro sin storeId: sin restricciones de presupuesto
      requiresExtraBudgetApproval = false;
      extraBudgetItemsCount = 0;
      for (const item of items) {
        delete item.is_extra_budget;
        delete item.extra_budget_reason;
      }
    }

    // Calcular totales
    const subtotal = items.reduce((sum: number, item: OrderItem) => {
      const cantidad = parseFloat(String(item.cantidad)) || 0;
      const precio = item.precioUnitario || 0;
      return sum + (cantidad * precio);
    }, 0);

    // Manejar IVA - también aplica cuando hay retenciones (tax_type puede ser 'con_iva' o legado 'retencion')
    const effectiveTaxType = tax_type === 'retencion' ? 'con_iva' : (tax_type || 'sin_iva');
    const effectiveIvaPercentage = effectiveTaxType === 'con_iva' ? (iva_percentage || 16) : 0;
    const iva = effectiveTaxType === 'con_iva' ? subtotal * (effectiveIvaPercentage / 100) : 0;

    // Calcular retenciones
    let retentionKeys: string[] = [];
    let retentionTotal = 0;
    if (retention) {
      // Intentar parsear como JSON array (formato nuevo)
      try {
        const parsed = JSON.parse(retention);
        if (Array.isArray(parsed)) {
          // Validar que todos los keys existan
          retentionKeys = parsed.filter((k: string) => RETENTION_OPTIONS.some(o => o.key === k));
        }
      } catch {
        // Formato legado (texto libre) - se guarda tal cual sin calcular
      }

      if (retentionKeys.length > 0) {
        const retCalc = calculateRetentions(retentionKeys, subtotal, iva);
        retentionTotal = retCalc.totalRetention;
      }
    }

    const total = subtotal + iva - retentionTotal;
    const totalQuantity = items.reduce((sum: number, item: OrderItem) => 
      sum + parseFloat(String(item.cantidad)), 0
    );

    // Preparar los items con precio total calculado y flags de autorización especial
    const itemsWithTotal = items.map((item: OrderItem) => ({
      nombre: item.nombre,
      cantidad: parseFloat(String(item.cantidad)),
      unidad: item.unidad,
      precioUnitario: item.precioUnitario,
      precioTotal: parseFloat(String(item.cantidad)) * item.precioUnitario,
      proveedor: resolvedSupplierName,
      // Datos de presupuesto (pasados desde el frontend si la obra tiene presupuesto)
      ...(item.insumo_clave ? { insumo_clave: item.insumo_clave } : {}),
      ...(item.categoria ? { categoria: item.categoria } : {}),
      ...(item.is_extra_budget ? { is_extra_budget: true, extra_budget_reason: item.extra_budget_reason } : {}),
    }));

    // Crear la orden
    const orderData = {
      applicant_id: userId,
      store_id: storeIdToUse,
      machine_id: finalMachineId || null,
      date: new Date().toISOString().split('T')[0],
      supplier_id: finalSupplierId,
      items: JSON.stringify(itemsWithTotal),
      quantity: totalQuantity,
      unity: items[0]?.unidad || 'pza',
      price_excluding_iva: subtotal,
      price_with_iva: subtotal + iva,
      subtotal: subtotal,
      iva: iva,
      total: total,
      currency: currency,
      justification: justification || '',
      retention: retention || '',
      payment_type: payment_type || '',
      tax_type: effectiveTaxType,
      iva_percentage: effectiveIvaPercentage || null,
      status: 'pending',
      is_urgent: is_urgent || false,
      urgency_justification: is_urgent ? urgency_justification : null,
      is_piecework: is_piecework || false,
      // Campos de presupuesto extraordinario / autorización especial
      has_extra_budget_approval: requiresExtraBudgetApproval,
      extra_budget_items_count: extraBudgetItemsCount,
    };

    const { data: orderCreated, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      console.error('[orders/create] Error al insertar orden:', orderError);
      return NextResponse.json(
        { error: "Error al crear la orden" },
        { status: 500 }
      );
    }

    // Las URLs de evidencia ya vienen del frontend (se subieron vía presigned URLs directamente a Supabase)
    const finalEvidenceUrls = body.evidenceUrls || [];
    
    // Guardar URLs de evidencia en la orden
    if (finalEvidenceUrls.length > 0) {
      await supabaseAdmin
        .from('orders')
        .update({ 
          justification_prove: finalEvidenceUrls.join(',') 
        })
        .eq('id', orderCreated.id);
      
      orderCreated.justification_prove = finalEvidenceUrls.join(',');
    }

    // Crear el flujo de aprobaciones:
    // Inicia en Gerencia (paso 1: Construcción para obras, Maquinaria para taller/equipos) en 'pending'
    if (userDepartmentId) {
      try {
        await createOrderApprovalsServer(
          String(orderCreated.id),
          userDepartmentId,
          userId,
          is_urgent,
          requiresExtraBudgetApproval,
          store_name,
          storeTypeCode
        );
      } catch (err) {
        console.error('Error al crear flujo de aprobaciones:', err);
      }
    }

    // Reservar cantidades en store_insumos para los items que provienen del presupuesto
    // (insumo_clave enlaza el item con store_insumos.clave)
    const itemsConClave = items.filter((item: OrderItem) => item.insumo_clave?.trim());
    if (itemsConClave.length > 0) {
      try {
        for (const item of itemsConClave) {
          const cantidadPedida = parseFloat(String(item.cantidad)) || 0;
          if (cantidadPedida <= 0 || !item.insumo_clave) continue;

          // Intentar incremento atómico vía RPC (evita race conditions con órdenes concurrentes)
          const { error: rpcError } = await supabaseAdmin.rpc('increment_insumo_solicitado', {
            p_store_id: storeIdToUse,
            p_clave: item.insumo_clave.trim(),
            p_cantidad: cantidadPedida,
          });

          if (rpcError) {
            // Fallback: si el RPC no existe aún, hacer el incremento manualmente
            // (leer + sumar + escribir — no es atómico pero funciona en carga baja)
            const { data: insumoData } = await supabaseAdmin
              .from('store_insumos')
              .select('id, cantidad_solicitada')
              .eq('store_id', storeIdToUse)
              .eq('clave', item.insumo_clave.trim())
              .single();

            if (insumoData) {
              await supabaseAdmin
                .from('store_insumos')
                .update({
                  cantidad_solicitada: (insumoData.cantidad_solicitada || 0) + cantidadPedida,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', insumoData.id);
            }
          }
        }
      } catch {
        // No fallar la creación de la orden si falla la reserva de presupuesto
        console.warn('[orders/create] No se pudo reservar presupuesto para algunos insumos');
      }
    }


    return NextResponse.json({
      success: true,
      orders: [orderCreated],
      order: orderCreated,
      message: "Orden de compra creada exitosamente",
    });

  } catch (error: unknown) {
    console.error('[orders/create] Error inesperado:', error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
