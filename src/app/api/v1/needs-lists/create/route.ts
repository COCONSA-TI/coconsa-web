import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Department, NeedsListItem } from "@/types/database";



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

  // Buscar departamentos por código (sin filtrar por approval_order, 
  // ya que esos valores corresponden al flujo de órdenes de compra, no al de listas)
  const contabilidad = departments.find((d: Department) => d.code === 'contabilidad');
  const contraloria = departments.find((d: Department) => d.code === 'contraloria');
  const direccion = departments.find((d: Department) => d.code === 'direccion');

  if (isUrgent && isApplicantDeptHead) {
    // LISTA URGENTE: Solo jefes de departamento pueden crear urgentes
    // Flujo urgente: Contabilidad (2) → Contraloría (3) → Dirección (4)
    // Se salta: Gerencia (1)

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

    if (direccion) {
      approvalsToCreate.push({
        needs_list_id: needsListId,
        department_id: direccion.id,
        status: 'pending',
        approval_order: 4,
      });
    }
  } else {
    // LISTA NORMAL: Flujo completo Gerencia → Contabilidad → Contraloría → Dirección
    const applicantDept = departments.find((d: Department) => d.id === applicantDepartmentId);

    // Determinar si el solicitante es de una Gerencia (approval_order = 1 en la DB)
    const isFromGerencia = applicantDept && applicantDept.approval_order === 1;

    if (isFromGerencia) {
      // El solicitante es de una Gerencia
      // Flujo: Gerencia (1) → Contabilidad (2) → Contraloría (3) → Dirección (4)

      // 1. Aprobación del departamento del solicitante (gerencia)
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

      // 2. Contabilidad (needs list order = 2)
      if (contabilidad) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      // 3. Contraloría (needs list order = 3)
      if (contraloria) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contraloria.id,
          status: 'pending',
          approval_order: 3,
        });
      }

      // 4. Dirección (needs list order = 4)
      if (direccion) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: direccion.id,
          status: 'pending',
          approval_order: 4,
        });
      }
    } else {
      // El solicitante NO es de una Gerencia (ej: Contabilidad, Contraloría, otro)
      // Solo agregar los pasos que están "arriba" del solicitante en el flujo de necesidades
      
      // Si el solicitante NO es de Contabilidad, agregar Contabilidad
      if (contabilidad && applicantDept?.id !== contabilidad.id) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contabilidad.id,
          status: 'pending',
          approval_order: 2,
        });
      }

      // Si el solicitante NO es de Contraloría, agregar Contraloría
      if (contraloria && applicantDept?.id !== contraloria.id) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: contraloria.id,
          status: 'pending',
          approval_order: 3,
        });
      }

      // Dirección siempre se agrega (a menos que el solicitante sea de Dirección)
      if (direccion && applicantDept?.id !== direccion.id) {
        approvalsToCreate.push({
          needs_list_id: needsListId,
          department_id: direccion.id,
          status: 'pending',
          approval_order: 4,
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
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    // Obtener sesión del usuario
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Solo aceptar JSON (los archivos ya se subieron vía presigned URLs desde el frontend)
    const body = await request.json();

    const {
      bank_account_id: bankAccountId,
      store_name: storeName,
      store_id: storeId,
      currency = 'MXN',
      iva_percentage: ivaPercentageRaw,
      is_urgent: isUrgent = false,
      urgency_justification: urgencyJustification,
      items: rawItems,
    } = body;

    // Validar campos requeridos
    if (!bankAccountId) {
      return NextResponse.json(
        { success: false, error: "La cuenta bancaria es requerida" },
        { status: 400 }
      );
    }

    if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Debe incluir al menos un item" },
        { status: 400 }
      );
    }

    // Parsear items
    const items: NeedsListItem[] = rawItems;

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

      if (!item.evidencia_url) {
        return NextResponse.json(
          { success: false, error: `El item "${item.nombre}" debe incluir un archivo de evidencia` },
          { status: 400 }
        );
      }
    }

    const parsedIva = parseFloat(String(ivaPercentageRaw));
    const ivaPercentage = Number.isFinite(parsedIva) ? parsedIva : 16;

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

    // Las URLs de evidencia ya vienen del frontend (se subieron vía presigned URLs)
    const itemEvidenceUrls = items.map(item => item.evidencia_url || '').filter(Boolean);

    const itemsWithEvidence = items.map((item) => ({
      nombre: item.nombre,
      cantidad: item.cantidad,
      unidad: item.unidad,
      precioUnitario: item.precioUnitario,
      precioTotal: item.precioTotal,
      justificacion: item.justificacion?.trim() ?? "",
      evidencia_url: item.evidencia_url || undefined,
    }));

    // Crear la lista de necesidades
    const { data: needsListData, error: insertError } = await supabaseAdmin
      .from('needs_lists')
      .insert({
        applicant_id: session.userId,
        store_id: finalStoreId,
        bank_account_id: bankAccountId,
        date: new Date().toISOString().split('T')[0],
        items: JSON.stringify(itemsWithEvidence),
        justification: null,
        subtotal,
        iva,
        total,
        currency,
        iva_percentage: ivaPercentage,
        status: 'pending',
        is_urgent: isUrgent,
        urgency_justification: isUrgent ? urgencyJustification : null,
        evidence_urls: itemEvidenceUrls.length > 0 ? itemEvidenceUrls.join(',') : null,
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
