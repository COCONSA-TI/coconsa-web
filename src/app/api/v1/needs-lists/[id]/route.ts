import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
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

  if (isUrgent && isApplicantDeptHead) {
    // LISTA URGENTE: Contabilidad (2) → Contraloría (3)
    const contabilidad = departments.find((d: Department) => d.code === 'contabilidad' && d.approval_order === 2);
    const contraloria = departments.find((d: Department) => d.code === 'contraloria' && d.approval_order === 3);

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
    const applicantApprovalOrder = applicantDept?.approval_order ?? 0;

    if (applicantApprovalOrder === 1) {
      // Gerencia
      if (applicantDept) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: applicantDept.id,
          status: isApplicantDeptHead ? 'approved' : 'pending',
          approval_order: 1,
          approver_id: isApplicantDeptHead ? applicantId : null,
          approved_at: isApplicantDeptHead ? new Date().toISOString() : null,
          comments: isApplicantDeptHead ? 'Auto-aprobado (solicitante es jefe de departamento)' : null,
        });
      }

      // Contabilidad
      const contabilidad = departments.find((d: Department) => d.code === 'contabilidad' && d.approval_order === 2);
      if (contabilidad) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      // Contraloría
      const contraloria = departments.find((d: Department) => d.code === 'contraloria' && d.approval_order === 3);
      if (contraloria) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contraloria.id,
          status: 'pending',
          approval_order: 3,
        });
      }
    } else {
      // Solicitante de Contabilidad, Contraloría u otros
      const contabilidad = departments.find((d: Department) => d.code === 'contabilidad' && d.approval_order === 2);
      const contraloria = departments.find((d: Department) => d.code === 'contraloria' && d.approval_order === 3);

      if (applicantApprovalOrder < 2 && contabilidad) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      if (applicantApprovalOrder < 3 && contraloria) {
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
    const { error: authError } = await requireAuth();
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

    // Parsear URLs de evidencia
    const evidenceUrls = needsList.evidence_urls 
      ? needsList.evidence_urls.split(',').filter((url: string) => url.trim() !== '')
      : [];

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
    const { error: authError } = await requireAuth();
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

    // Parsear el body - soporta JSON y FormData
    const contentType = request.headers.get('content-type') || '';
    let body: {
      items?: Array<{
        description: string;
        quantity: number;
        unit: string;
        unit_price: number;
      }>;
      justification?: string;
      store_id?: string;
      bank_account_id?: string;
      currency?: string;
      iva_percentage?: number;
      existing_evidence?: string[];
    };
    let evidenceFiles: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const listDataString = formData.get('listData');
      
      if (typeof listDataString === 'string') {
        body = JSON.parse(listDataString);
      } else {
        return NextResponse.json(
          { success: false, error: 'Datos de lista inválidos' },
          { status: 400 }
        );
      }
      
      const evidenceEntries = formData.getAll('evidence');
      evidenceFiles = evidenceEntries.filter((entry): entry is File => entry instanceof File);
    } else {
      body = await request.json();
    }

    const { 
      items, 
      justification, 
      store_id, 
      bank_account_id,
      currency,
      iva_percentage,
      existing_evidence = [],
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
        if (!item.description || !item.quantity || !item.unit || !item.unit_price) {
          return NextResponse.json(
            { success: false, error: "Todos los items deben tener descripción, cantidad, unidad y precio unitario" },
            { status: 400 }
          );
        }
        if (item.quantity <= 0 || item.unit_price <= 0) {
          return NextResponse.json(
            { success: false, error: "Cantidad y precio deben ser mayores a 0" },
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
      const processedItems = items.map(item => {
        const itemTotal = item.quantity * item.unit_price;
        subtotal += itemTotal;
        return {
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          subtotal: Math.round(itemTotal * 100) / 100,
        };
      });
      subtotal = Math.round(subtotal * 100) / 100;

      const ivaPerc = iva_percentage ?? existingList.iva_percentage ?? 16;
      const iva = Math.round(subtotal * (ivaPerc / 100) * 100) / 100;
      const total = Math.round((subtotal + iva) * 100) / 100;

      updateData.items = JSON.stringify(processedItems);
      updateData.subtotal = subtotal;
      updateData.iva = iva;
      updateData.total = total;
      updateData.iva_percentage = ivaPerc;
    }

    if (justification !== undefined) {
      updateData.justification = justification;
    }

    if (store_id !== undefined) {
      updateData.store_id = store_id;
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

    // Manejar archivos de evidencia
    const finalEvidenceUrls = [...existing_evidence];
    
    if (evidenceFiles.length > 0) {
      const BUCKET_NAME = "Coconsa";
      
      for (const file of evidenceFiles) {
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `needs-lists/${needsListId}/evidence/${timestamp}_${sanitizedName}`;
        
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
      updateData.evidence_urls = finalEvidenceUrls.join(',');
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
