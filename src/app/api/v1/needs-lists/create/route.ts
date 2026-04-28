import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Department, NeedsListItem } from "@/types/database";

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
  needsListId: string,
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

// Función para crear aprobaciones de lista de necesidades en el servidor
async function createNeedsListApprovalsServer(
  needsListId: number, 
  applicantDepartmentId: string, 
  applicantId: string, 
  isUrgent: boolean = false
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

  const approvalsToCreate = [];

  if (isUrgent && isApplicantDeptHead) {
    // LISTA URGENTE: Solo jefes de departamento pueden crear urgentes
    // Flujo urgente: Contabilidad (2) → Contraloría (3)
    // Se salta: Gerencia (1)
    
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
    // LISTA NORMAL: Flujo completo Gerencia → Contabilidad → Contraloría
    const applicantDept = departments.find((d: Department) => d.id === applicantDepartmentId);
    const applicantApprovalOrder = applicantDept?.approval_order ?? 0;

    if (applicantApprovalOrder === 1) {
      // El solicitante es de una Gerencia (approval_order = 1)
      // Flujo: Gerencia (1) → Contabilidad (2) → Contraloría (3)

      // 1. Aprobación del departamento del solicitante (gerencia)
      if (applicantDept) {
        // Si el solicitante ES el jefe de su departamento, auto-aprobar su nivel
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: applicantDept.id,
          status: isApplicantDeptHead ? 'approved' : 'pending',
          approval_order: 1,
          ...(isApplicantDeptHead && {
            approver_id: applicantId,
            approved_at: new Date().toISOString(),
            comments: 'Auto-aprobado por jefe de departamento',
          }),
        });
      }

      // 2. Contabilidad (order=2)
      const contabilidad = departments.find((d: Department) => d.code === 'contabilidad' && d.approval_order === 2);
      if (contabilidad) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      // 3. Contraloría (order=3)
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
      // El solicitante es de Contabilidad, Contraloría u otro departamento
      // Flujo simplificado según el departamento
      
      const contabilidad = departments.find((d: Department) => d.code === 'contabilidad' && d.approval_order === 2);
      const contraloria = departments.find((d: Department) => d.code === 'contraloria' && d.approval_order === 3);

      // Agregar departamentos superiores al del solicitante
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

export async function POST(request: Request) {
  try {
    // Verificar permisos
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    // Obtener sesión del usuario
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    await supabaseAdmin.storage.listBuckets();

    // Parsear FormData
    const formData = await request.formData();
    
    // Extraer campos del formulario
    const storeName = formData.get('store_name') as string;
    const storeId = formData.get('store_id') as string;
    const bankAccountId = formData.get('bank_account_id') as string;
    const itemsStr = formData.get('items') as string;
    const currency = (formData.get('currency') as string) || 'MXN';
    const ivaPercentageStr = formData.get('iva_percentage') as string;
    const isUrgentStr = formData.get('is_urgent') as string;
    const urgencyJustification = formData.get('urgency_justification') as string;

    // Validar campos requeridos
    if (!bankAccountId) {
      return NextResponse.json(
        { success: false, error: "La cuenta bancaria es requerida" },
        { status: 400 }
      );
    }

    if (!itemsStr) {
      return NextResponse.json(
        { success: false, error: "Los items son requeridos" },
        { status: 400 }
      );
    }

    // Parsear items
    let items: NeedsListItem[];
    try {
      items = JSON.parse(itemsStr);
    } catch {
      return NextResponse.json(
        { success: false, error: "Formato inválido de items" },
        { status: 400 }
      );
    }

    // Validar items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Debe incluir al menos un item" },
        { status: 400 }
      );
    }

    // Validar estructura de cada item
    for (const item of items) {
      if (!item.nombre || typeof item.nombre !== 'string') {
        return NextResponse.json(
          { success: false, error: "Todos los items deben tener un nombre válido" },
          { status: 400 }
        );
      }
      if (!item.cantidad || item.cantidad <= 0) {
        return NextResponse.json(
          { success: false, error: `El item "${item.nombre}" debe tener una cantidad válida mayor a 0` },
          { status: 400 }
        );
      }
      if (!item.unidad || typeof item.unidad !== 'string') {
        return NextResponse.json(
          { success: false, error: `El item "${item.nombre}" debe tener una unidad válida` },
          { status: 400 }
        );
      }
      if (!item.precioUnitario || item.precioUnitario <= 0) {
        return NextResponse.json(
          { success: false, error: `El item "${item.nombre}" debe tener un precio unitario válido mayor a 0` },
          { status: 400 }
        );
      }

      if (!item.justificacion || typeof item.justificacion !== 'string' || item.justificacion.trim().length < 10) {
        return NextResponse.json(
          { success: false, error: `El item "${item.nombre}" debe incluir una justificación de al menos 10 caracteres` },
          { status: 400 }
        );
      }
    }

    const isUrgent = isUrgentStr === 'true';
    const ivaPercentage = parseFloat(ivaPercentageStr) || 16;

    // Validar órdenes urgentes
    if (isUrgent) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('is_department_head')
        .eq('id', session.userId)
        .single();

      if (userError || !userData?.is_department_head) {
        return NextResponse.json(
          { success: false, error: "Solo los jefes de departamento pueden crear listas urgentes" },
          { status: 403 }
        );
      }

      if (!urgencyJustification || urgencyJustification.trim().length < 10) {
        return NextResponse.json(
          { success: false, error: "Las listas urgentes requieren una justificación de al menos 10 caracteres" },
          { status: 400 }
        );
      }
    }

    if (!storeId && (!storeName || storeName.trim() === '')) {
      return NextResponse.json(
        { success: false, error: "El centro de costos es requerido" },
        { status: 400 }
      );
    }

    // Verificar que la cuenta bancaria existe y pertenece al usuario
    const { data: bankAccount, error: bankAccountError } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .single();

    if (bankAccountError || !bankAccount) {
      return NextResponse.json(
        { success: false, error: "Cuenta bancaria no encontrada o inactiva" },
        { status: 404 }
      );
    }

    // Obtener información del usuario para el departamento
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('department_id, full_name, is_department_head')
      .eq('id', session.userId)
      .single();

    if (userError || !user?.department_id) {
      return NextResponse.json(
        { success: false, error: "Usuario no tiene departamento asignado" },
        { status: 400 }
      );
    }

    // Buscar o validar el almacén/obra
    let finalStoreId: number | null = null;

    if (storeId && !isNaN(parseInt(storeId))) {
      finalStoreId = parseInt(storeId);
    } else if (storeName && storeName.trim() !== '') {
      const { data: storeData, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id')
        .ilike('name', storeName.trim())
        .single();

      if (!storeError && storeData) {
        finalStoreId = storeData.id;
      }
    }

    // Calcular totales
    let subtotal = 0;
    for (const item of items) {
      const itemTotal = item.cantidad * item.precioUnitario;
      item.precioTotal = Math.round(itemTotal * 100) / 100;
      subtotal += item.precioTotal;
    }
    subtotal = Math.round(subtotal * 100) / 100;

    const iva = Math.round(subtotal * (ivaPercentage / 100) * 100) / 100;
    const total = Math.round((subtotal + iva) * 100) / 100;

    // Procesar evidencia por item (obligatoria)
    const itemEvidenceFiles = items.map((_, index) => {
      const file = formData.get(`item_evidence_${index}`);
      return file instanceof File && file.size > 0 ? file : null;
    });

    for (let i = 0; i < itemEvidenceFiles.length; i += 1) {
      if (!itemEvidenceFiles[i]) {
        return NextResponse.json(
          { success: false, error: `Falta archivo de justificación para el item ${i + 1}` },
          { status: 400 }
        );
      }
    }

    // Crear la lista de necesidades
    const { data: needsListData, error: insertError } = await supabaseAdmin
      .from('needs_lists')
      .insert({
        applicant_id: session.userId,
        store_id: finalStoreId,
        bank_account_id: bankAccountId,
        date: new Date().toISOString().split('T')[0],
        items: JSON.stringify(items),
        justification: null,
        subtotal,
        iva,
        total,
        currency,
        iva_percentage: ivaPercentage,
        status: 'pending',
        is_urgent: isUrgent,
        urgency_justification: isUrgent ? urgencyJustification : null,
        evidence_urls: null,
      })
      .select()
      .single();

    if (insertError || !needsListData) {
      console.error('Error al crear lista de necesidades:', insertError);
      return NextResponse.json(
        { success: false, error: insertError?.message || "Error al crear la lista de necesidades" },
        { status: 500 }
      );
    }

    const itemEvidenceUrls: string[] = [];
    for (let i = 0; i < itemEvidenceFiles.length; i += 1) {
      const file = itemEvidenceFiles[i];
      if (!file) continue;
      const uploadedUrl = await uploadItemEvidenceFile(file, needsListData.id.toString(), i);
      itemEvidenceUrls.push(uploadedUrl);
    }

    const itemsWithEvidence = items.map((item, index) => {
      const itemJustificacion = item.justificacion?.trim() ?? "";
      return {
        ...item,
        justificacion: itemJustificacion,
        evidencia_url: itemEvidenceUrls[index],
      };
    });

    const { error: updateNeedsListError } = await supabaseAdmin
      .from('needs_lists')
      .update({
        items: JSON.stringify(itemsWithEvidence),
        evidence_urls: itemEvidenceUrls.join(','),
      })
      .eq('id', needsListData.id);

    if (updateNeedsListError) {
      await supabaseAdmin
        .from('needs_lists')
        .delete()
        .eq('id', needsListData.id);

      return NextResponse.json(
        { success: false, error: "Error al guardar justificaciones por item" },
        { status: 500 }
      );
    }

    // Crear flujo de aprobaciones
    try {
      await createNeedsListApprovalsServer(
        needsListData.id,
        user.department_id,
        session.userId,
        isUrgent
      );
    } catch (approvalError) {
      console.error('Error al crear aprobaciones:', approvalError);
      // Eliminar la lista si no se pueden crear las aprobaciones
      await supabaseAdmin
        .from('needs_lists')
        .delete()
        .eq('id', needsListData.id);

      return NextResponse.json(
        { success: false, error: "Error al crear el flujo de aprobaciones" },
        { status: 500 }
      );
    }

    // Si el solicitante es jefe de departamento y no es urgente, actualizar estado
    if (user.is_department_head && !isUrgent) {
      await supabaseAdmin
        .from('needs_lists')
        .update({ status: 'in_progress' })
        .eq('id', needsListData.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: needsListData.id,
        folio: needsListData.folio,
        status: user.is_department_head && !isUrgent ? 'in_progress' : 'pending',
        evidenceUrls: itemEvidenceUrls,
      },
    });

  } catch (error) {
    console.error("Error en POST /api/v1/needs-lists/create:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
