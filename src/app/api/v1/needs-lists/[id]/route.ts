import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Department } from "@/types/database";

interface NormalizedNeedsListItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  justificacion?: string;
  evidencia_url?: string;
}

const BUCKET_NAME = "Coconsa";
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);
const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

async function uploadItemEvidenceFile(
  file: File,
  needsListId: number,
  itemIndex: number
): Promise<string> {
  if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.type)) {
    throw new Error(`Tipo de archivo no permitido en item ${itemIndex + 1}: "${file.type}"`);
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE_BYTES) {
    throw new Error(`El archivo del item ${itemIndex + 1} excede el límite de 10 MB.`);
  }

  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `needs-lists/${needsListId}/items/${itemIndex + 1}/${timestamp}_${sanitizedName}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(`No se pudo subir evidencia del item ${itemIndex + 1}: ${error.message}`);
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  if (!urlData?.publicUrl) {
    throw new Error(`No se pudo obtener URL pública para evidencia del item ${itemIndex + 1}`);
  }

  return urlData.publicUrl;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/[$,\s]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeNeedsListItem(item: unknown, index: number): NormalizedNeedsListItem {
  const source = typeof item === 'object' && item !== null
    ? item as Record<string, unknown>
    : {};

  const quantity = toSafeNumber(source.quantity ?? source.cantidad);
  const unitPrice = toSafeNumber(source.unit_price ?? source.precioUnitario);
  const rawSubtotal = source.subtotal ?? source.precioTotal;
  const subtotal = rawSubtotal !== undefined
    ? toSafeNumber(rawSubtotal)
    : Math.round(quantity * unitPrice * 100) / 100;

  const description = String(source.description ?? source.nombre ?? source.descripcion ?? '').trim();

  return {
    id: String(source.id ?? `item-${index + 1}`),
    description: description || `Concepto ${index + 1}`,
    quantity,
    unit: String(source.unit ?? source.unidad ?? '').trim(),
    unit_price: unitPrice,
    subtotal,
    justificacion: typeof source.justificacion === 'string' ? source.justificacion : undefined,
    evidencia_url: typeof source.evidencia_url === 'string' ? source.evidencia_url : undefined,
  };
}

// Función para recrear aprobaciones de lista de necesidades
async function recreateNeedsListApprovals(
  needsListId: number,
  applicantId: string,
  isUrgent: boolean = false
) {
  // Eliminar aprobaciones existentes
  await supabaseAdmin
    .from('needs_list_approvals')
    .delete()
    .eq('needs_list_id', needsListId);

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

  const approvalsToCreate = [];

  // Buscar departamentos por código (sin filtrar por approval_order,
  // ya que esos valores corresponden al flujo de órdenes de compra, no al de listas)
  const contabilidad = departments.find((d: Department) => d.code === 'contabilidad');
  const contraloria = departments.find((d: Department) => d.code === 'contraloria');

  if (isUrgent && isApplicantDeptHead) {
    // LISTA URGENTE: Contabilidad (2) → Contraloría (3)

    if (contabilidad) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: contabilidad.id,
        status: 'pending',
        approval_order: 2,
      });
    }

    if (contraloria) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: contraloria.id,
        status: 'pending',
        approval_order: 3,
      });
    }
  } else {
    // LISTA NORMAL: Gerencia (1) → Contabilidad (2) → Contraloría (3)
    const applicantDept = departments.find((d: Department) => d.id === applicantDepartmentId);
    const isFromGerencia = applicantDept && applicantDept.approval_order === 1;

    if (isFromGerencia) {
      // Gerencia
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: applicantDept.id,
        status: isApplicantDeptHead ? 'approved' : 'pending',
        approval_order: 1,
        approver_id: isApplicantDeptHead ? applicantId : null,
        approved_at: isApplicantDeptHead ? new Date().toISOString() : null,
        comments: isApplicantDeptHead ? 'Auto-aprobado (solicitante es jefe de departamento)' : null,
      });

      // Contabilidad
      if (contabilidad) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      // Contraloría
      if (contraloria) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contraloria.id,
          status: 'pending',
          approval_order: 3,
        });
      }
    } else {
      // Solicitante NO es de Gerencia
      if (contabilidad && applicantDept?.id !== contabilidad.id) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      if (contraloria && applicantDept?.id !== contraloria.id) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contraloria.id,
          status: 'pending',
          approval_order: 3,
        });
      }
    }
  }

  if (approvalsToCreate.length === 0) {
    throw new Error('No se pudo crear el flujo de aprobaciones');
  }

  const { error: insertError } = await supabaseAdmin
    .from('needs_list_approvals')
    .insert(approvalsToCreate);

  if (insertError) {
    throw new Error('Error al crear aprobaciones: ' + insertError.message);
  }

  return true;
}

/**
 * GET /api/v1/needs-lists/[id]
 * Obtiene los detalles de una lista de necesidades específica
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const needsListId = parseInt(id);

    if (isNaN(needsListId)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    // Obtener detalles de la lista de necesidades
    const { data: needsList, error: needsListError } = await supabaseAdmin
      .from('needs_lists')
      .select(`
        *,
        applicant:users!needs_lists_applicant_id_fkey (
          full_name,
          email,
          department_id
        ),
        store:stores (
          name
        ),
        bank_account:user_bank_accounts (
          bank_name,
          account_number,
          clabe,
          account_type
        )
      `)
      .eq('id', needsListId)
      .single();

    if (needsListError || !needsList) {
      return NextResponse.json(
        { success: false, error: "Lista de necesidades no encontrada" },
        { status: 404 }
      );
    }

    // Parsear y normalizar items (soporta formato histórico y formato actual)
    let parsedItems: NormalizedNeedsListItem[] = [];
    try {
      const rawItems = JSON.parse(needsList.items);
      parsedItems = Array.isArray(rawItems)
        ? rawItems.map((item, index) => normalizeNeedsListItem(item, index))
        : [];
    } catch {
      parsedItems = [];
    }

    // Obtener aprobaciones
    const { data: approvals } = await supabaseAdmin
      .from('needs_list_approvals')
      .select(`
        *,
        department:departments (
          name,
          code
        ),
        approver:users!needs_list_approvals_approver_id_fkey (
          full_name,
          email
        )
      `)
      .eq('needs_list_id', needsListId)
      .order('approval_order');

    // Get current department name from pending approval
    const pendingApproval = (approvals || []).find((a: { status: string }) => a.status === 'pending');
    const currentDepartmentName = pendingApproval?.department?.name || null;

    // Get applicant department name
    let departmentName = null;
    if (needsList.applicant?.department_id) {
      const { data: deptData } = await supabaseAdmin
        .from('departments')
        .select('name')
        .eq('id', needsList.applicant.department_id)
        .single();
      departmentName = deptData?.name || null;
    }

    return NextResponse.json({
      success: true,
      needsList: {
        id: needsList.id,
        folio: needsList.folio,
        created_at: needsList.created_at,
        user_name: needsList.applicant?.full_name || 'Usuario desconocido',
        user_email: needsList.applicant?.email || '',
        total: needsList.total,
        status: needsList.status,
        store_id: needsList.store_id,
        store_name: needsList.store?.name || null,
        justification: needsList.justification,
        evidence_urls: needsList.evidence_urls,
        items: parsedItems,
        bank_account_id: needsList.bank_account_id,
        bank_account: needsList.bank_account ? {
          id: needsList.bank_account_id,
          bank_name: needsList.bank_account.bank_name,
          account_number: needsList.bank_account.account_number,
          clabe: needsList.bank_account.clabe || '',
          account_holder_name: needsList.applicant?.full_name || '',
        } : null,
        is_urgent: needsList.is_urgent,
        urgency_justification: needsList.urgency_justification,
        is_definitive_rejection: needsList.is_definitive_rejection,
        current_department_name: currentDepartmentName,
        department_name: departmentName,
      },
      approvals: approvals || [],
    });

  } catch (error) {
    console.error("Error en GET /api/v1/needs-lists/[id]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/needs-lists/[id]
 * Edita una lista de necesidades rechazada (no definitivamente)
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const needsListId = parseInt(id);

    if (isNaN(needsListId)) {
      return NextResponse.json(
        { success: false, error: "ID inválido" },
        { status: 400 }
      );
    }

    // Verificar que la lista existe y pertenece al usuario
    const { data: existingList, error: fetchError } = await supabaseAdmin
      .from('needs_lists')
      .select('*')
      .eq('id', needsListId)
      .single();

    if (fetchError || !existingList) {
      return NextResponse.json(
        { success: false, error: "Lista de necesidades no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que el usuario es el solicitante original
    if (existingList.applicant_id !== session.userId) {
      return NextResponse.json(
        { success: false, error: "No tienes permiso para editar esta lista" },
        { status: 403 }
      );
    }

    // Verificar que la lista está rechazada y no es rechazo definitivo
    if (existingList.status !== 'rejected') {
      return NextResponse.json(
        { success: false, error: "Solo se pueden editar listas rechazadas" },
        { status: 400 }
      );
    }

    if (existingList.is_definitive_rejection) {
      return NextResponse.json(
        { success: false, error: "Esta lista fue rechazada definitivamente y no puede ser editada" },
        { status: 400 }
      );
    }

    type UpdateNeedsListBody = {
      items?: Array<{
        nombre?: string;
        description?: string;
        cantidad?: number;
        quantity?: number;
        unidad?: string;
        unit?: string;
        precioUnitario?: number;
        unit_price?: number;
        justificacion?: string;
        evidencia_url?: string;
      }>;
      store_id?: string;
      store_name?: string;
      bank_account_id?: string;
      currency?: string;
      iva_percentage?: number;
    };

    // Parsear el body - soporta JSON y FormData
    const contentType = request.headers.get('content-type') || '';
    let body: UpdateNeedsListBody;
    let formData: FormData | null = null;

    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      const itemsStr = formData.get('items') as string;

      if (!itemsStr) {
        return NextResponse.json(
          { success: false, error: 'Los items son requeridos' },
          { status: 400 }
        );
      }

      let parsedItems: unknown;
      try {
        parsedItems = JSON.parse(itemsStr);
      } catch {
        return NextResponse.json(
          { success: false, error: 'Formato inválido de items' },
          { status: 400 }
        );
      }

      body = {
        items: Array.isArray(parsedItems) ? parsedItems as UpdateNeedsListBody['items'] : [],
        store_id: (formData.get('store_id') as string) || undefined,
        store_name: (formData.get('store_name') as string) || undefined,
        bank_account_id: (formData.get('bank_account_id') as string) || undefined,
        currency: (formData.get('currency') as string) || undefined,
        iva_percentage: (() => {
          const raw = formData?.get('iva_percentage') as string | null;
          if (!raw) return undefined;
          const parsed = Number(raw);
          return Number.isFinite(parsed) ? parsed : undefined;
        })(),
      };
    } else {
      body = await request.json();
    }

    const { 
      items, 
      store_id, 
      store_name,
      bank_account_id,
      currency,
      iva_percentage,
    } = body;

    // Validar items si se proporcionan
    if (items) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: "Debe incluir al menos un item" },
          { status: 400 }
        );
      }

      for (const item of items) {
        const description = (item.description ?? item.nombre ?? '').toString().trim();
        const quantity = Number(item.quantity ?? item.cantidad);
        const unit = (item.unit ?? item.unidad ?? '').toString().trim();
        const unitPrice = Number(item.unit_price ?? item.precioUnitario);
        const justificacion = (item.justificacion ?? '').toString().trim();

        if (!description || !quantity || !unit || !unitPrice) {
          return NextResponse.json(
            { success: false, error: "Todos los items deben tener descripción, cantidad, unidad y precio unitario" },
            { status: 400 }
          );
        }
        if (quantity <= 0 || unitPrice <= 0) {
          return NextResponse.json(
            { success: false, error: "Cantidad y precio deben ser mayores a 0" },
            { status: 400 }
          );
        }

        if (justificacion.length < 10) {
          return NextResponse.json(
            { success: false, error: `El item "${description}" debe incluir una justificación de al menos 10 caracteres` },
            { status: 400 }
          );
        }
      }
    }

    // Preparar datos para actualizar
    const updateData: Record<string, unknown> = {};

    if (items) {
      // Calcular totales
      let subtotal = 0;
      const processedItems = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const description = (item.description ?? item.nombre ?? '').toString().trim();
        const quantity = Number(item.quantity ?? item.cantidad);
        const unit = (item.unit ?? item.unidad ?? '').toString().trim();
        const unitPrice = Number(item.unit_price ?? item.precioUnitario);
        const itemJustificacion = (item.justificacion ?? '').toString().trim();
        const existingEvidenceUrl = (item.evidencia_url ?? '').toString().trim();

        let finalEvidenceUrl = existingEvidenceUrl;
        if (formData) {
          const uploadedFile = formData.get(`item_evidence_${index}`);
          if (uploadedFile instanceof File && uploadedFile.size > 0) {
            finalEvidenceUrl = await uploadItemEvidenceFile(uploadedFile, needsListId, index);
          }
        }

        if (!finalEvidenceUrl) {
          return NextResponse.json(
            { success: false, error: `Falta archivo de justificación para el item ${index + 1}` },
            { status: 400 }
          );
        }

        const itemTotal = quantity * unitPrice;
        subtotal += itemTotal;
        processedItems.push({
          description,
          quantity,
          unit,
          unit_price: unitPrice,
          subtotal: Math.round(itemTotal * 100) / 100,
          justificacion: itemJustificacion,
          evidencia_url: finalEvidenceUrl,
        });
      }
      subtotal = Math.round(subtotal * 100) / 100;

      const ivaPerc = iva_percentage ?? existingList.iva_percentage ?? 16;
      const iva = Math.round(subtotal * (ivaPerc / 100) * 100) / 100;
      const total = Math.round((subtotal + iva) * 100) / 100;

      updateData.items = JSON.stringify(processedItems);
      updateData.evidence_urls = processedItems
        .map((item) => item.evidencia_url)
        .filter((url) => typeof url === 'string' && url.trim() !== '')
        .join(',');
      updateData.justification = null;
      updateData.subtotal = subtotal;
      updateData.iva = iva;
      updateData.total = total;
      updateData.iva_percentage = ivaPerc;
    }

    if (!store_id && !store_name) {
      return NextResponse.json(
        { success: false, error: "El centro de costos es requerido" },
        { status: 400 }
      );
    }

    if (store_id !== undefined && store_id !== '') {
      updateData.store_id = Number(store_id);
    } else if (store_name !== undefined && store_name.trim() !== '') {
      const { data: storeData } = await supabaseAdmin
        .from('stores')
        .select('id')
        .ilike('name', store_name.trim())
        .single();

      if (storeData?.id) {
        updateData.store_id = storeData.id;
      }
    }

    if (bank_account_id !== undefined) {
      // Verificar que la cuenta bancaria pertenece al usuario
      const { data: bankAccount } = await supabaseAdmin
        .from('user_bank_accounts')
        .select('id')
        .eq('id', bank_account_id)
        .eq('user_id', session.userId)
        .eq('is_active', true)
        .single();

      if (!bankAccount) {
        return NextResponse.json(
          { success: false, error: "Cuenta bancaria no encontrada o inactiva" },
          { status: 404 }
        );
      }

      updateData.bank_account_id = bank_account_id;
    }

    if (currency !== undefined) {
      updateData.currency = currency;
    }

    // Cambiar estado a pending
    updateData.status = 'pending';
    updateData.is_definitive_rejection = false;

    // Actualizar la lista
    const { error: updateError } = await supabaseAdmin
      .from('needs_lists')
      .update(updateData)
      .eq('id', needsListId);

    if (updateError) {
      console.error('Error al actualizar lista:', updateError);
      return NextResponse.json(
        { success: false, error: "Error al actualizar la lista de necesidades" },
        { status: 500 }
      );
    }

    // Recrear flujo de aprobaciones
    try {
      await recreateNeedsListApprovals(
        needsListId,
        session.userId,
        existingList.is_urgent
      );
    } catch (approvalError) {
      console.error('Error al recrear aprobaciones:', approvalError);
      return NextResponse.json(
        { success: false, error: "Error al recrear el flujo de aprobaciones" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Lista de necesidades actualizada y reenviada para aprobación",
    });

  } catch (error) {
    console.error("Error en PUT /api/v1/needs-lists/[id]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
