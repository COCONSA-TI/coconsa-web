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
async function createOrderApprovalsServer(orderId: string, applicantDepartmentId: string, applicantId: string, isUrgent: boolean = false) {
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

  if (isUrgent && isApplicantDeptHead) {
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

      // 1. Aprobación del departamento del solicitante (gerencia)
      if (applicantDept) {
        // Si el solicitante ES el jefe de su departamento, auto-aprobar su nivel
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

      // 2. Aprobaciones para el resto del flujo (contraloría, dirección, contabilidad, pagos)
      // Solo incluir departamentos con approval_order > 1 que NO sean otras gerencias
      // Evitamos duplicar el departamento del solicitante
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

  // Si se auto-aprobó el primer nivel (orden normal con dept head de gerencia), actualizar estado a in_progress
  // Si es orden urgente, también ponerla en in_progress ya que se saltó gerencia y contraloría
  // Si el solicitante pertenece a un depto con approval_order >= 2, también in_progress porque no hay step 1
  const applicantDept = departments.find((d: Department) => d.id === applicantDepartmentId);
  const applicantApprovalOrder = applicantDept?.approval_order ?? 0;
  const shouldBeInProgress = isUrgent || (isApplicantDeptHead && applicantApprovalOrder === 1) || applicantApprovalOrder >= 2;

  if (shouldBeInProgress) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId);
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

    // Detectar tipo de contenido para manejar FormData o JSON
    const contentType = request.headers.get('content-type') || '';
    let body: CreateOrderRequest;
    let evidenceFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      // Procesar FormData (desde el formulario manual)
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
      
      // Obtener archivos de evidencia
      const evidenceEntries = formData.getAll('evidence');
      evidenceFiles = evidenceEntries.filter((entry): entry is File => entry instanceof File);
      
    } else {
      // Procesar JSON (desde el chatbot u otras fuentes)
      body = await request.json();
    }

    const {
      applicant_name,
      applicant_id: _applicant_id_ignored, // ignorado: siempre se usa la sesión del servidor
      store_name,
      machine_name,
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

    // Buscar el almacén por nombre o usar el ID proporcionado
    let storeIdToUse = store_id;
    
    if (!storeIdToUse) {
      const { data: storeData, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id')
        .ilike('name', `%${store_name}%`)
        .limit(1)
        .single();

      if (storeError || !storeData) {
        return NextResponse.json(
          { error: `No se encontró el almacén u obra "${store_name}". Verifica que esté registrado en el sistema.` },
          { status: 404 }
        );
      }
      storeIdToUse = storeData.id;
    }

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

    // Preparar los items con precio total calculado
    const itemsWithTotal = items.map((item: OrderItem) => ({
      nombre: item.nombre,
      cantidad: parseFloat(String(item.cantidad)),
      unidad: item.unidad,
      precioUnitario: item.precioUnitario,
      precioTotal: parseFloat(String(item.cantidad)) * item.precioUnitario,
      proveedor: resolvedSupplierName
    }));

    // Crear la orden
    const orderData = {
      applicant_id: userId,
      store_id: storeIdToUse,
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

    // Manejar archivos de evidencia de FormData (fallback) y URLs presignadas
    let finalEvidenceUrls = [...evidenceUrls];
    if (evidenceFiles.length > 0) {
      try {
        const uploadedUrls = await uploadEvidenceFiles(evidenceFiles, String(orderCreated.id));
        finalEvidenceUrls = [...finalEvidenceUrls, ...uploadedUrls];
      } catch (uploadError: unknown) {
        // Si el error es de validación (tipo/tamaño), rechazar la orden con 400
        const msg = uploadError instanceof Error ? uploadError.message : 'Error al subir archivos';
        if (msg.includes('no permitido') || msg.includes('excede') || msg.includes('máximo')) {
          return NextResponse.json({ error: msg }, { status: 400 });
        }
        console.error('[orders/create] Error uploading evidence files:', msg);
      }
    }
    
    if (finalEvidenceUrls.length > 0) {
      await supabaseAdmin
        .from('orders')
        .update({ 
          justification_prove: finalEvidenceUrls.join(',') 
        })
        .eq('id', orderCreated.id);
      
      orderCreated.justification_prove = finalEvidenceUrls.join(',');
    }
    
    // Crear el flujo de aprobaciones automáticamente
    if (userDepartmentId) {
      try {
        await createOrderApprovalsServer(String(orderCreated.id), userDepartmentId, userId, is_urgent);
      } catch {
        // No fallar la creación de la orden si falla la creación de aprobaciones
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
