import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/v1/needs-lists
 * Lista todas las listas de necesidades con filtros según el rol del usuario
 */
export async function GET(request: Request) {
  try {
    // Verificar autenticación
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.userId || !session?.role) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener información del usuario
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role, department_id, is_department_head')
      .eq('id', session.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Obtener el nombre del rol
    const { data: roleData } = await supabaseAdmin
      .from('roles')
      .select('name')
      .eq('id', userData.role)
      .single();

    const roleName = roleData?.name || '';

    // Parse query parameters
    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    let query = supabaseAdmin
      .from('needs_lists')
      .select(`
        id,
        folio,
        created_at,
        applicant_id,
        store_id,
        status,
        total,
        currency,
        iva_percentage,
        items,
        is_urgent,
        urgency_justification,
        is_definitive_rejection,
        applicant:users!needs_lists_applicant_id_fkey (
          full_name,
          email
        ),
        store:stores (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      if (statusFilter.includes(',')) {
        query = query.in('status', statusFilter.split(','));
      } else {
        query = query.eq('status', statusFilter);
      }
    }

    // Filtrar según el rol
    if (roleName === 'admin') {
      // Admin ve todas las listas
      // No aplicar filtros adicionales
    } else if (userData.is_department_head && userData.department_id) {
      // Jefe de departamento ve:
      // 1. Sus propias listas
      // 2. Listas de otros usuarios del mismo departamento
      // 3. Listas donde su departamento tiene una aprobación

      // Obtener todos los usuarios del mismo departamento
      const { data: deptUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('department_id', userData.department_id);

      const deptUserIds = deptUsers?.map(u => u.id).filter(Boolean) || [];

      const { data: approvals } = await supabaseAdmin
        .from('needs_list_approvals')
        .select('needs_list_id')
        .eq('department_id', userData.department_id);

      const needsListIds = approvals?.map(a => a.needs_list_id) || [];

      // Construir filtro OR
      const orFilters: string[] = [];

      if (deptUserIds.length > 0) {
        orFilters.push(`applicant_id.in.(${deptUserIds.join(',')})`);
      } else {
        orFilters.push(`applicant_id.eq.${userData.id}`);
      }

      if (needsListIds.length > 0) {
        orFilters.push(`id.in.(${needsListIds.join(',')})`);
      }

      query = query.or(orFilters.join(','));
    } else {
      // Usuario normal solo ve sus propias listas
      query = query.eq('applicant_id', userData.id);
    }

    const { data: needsLists, error: queryError } = await query;

    if (queryError) {
      console.error('Error al listar listas de necesidades:', queryError);
      return NextResponse.json(
        { success: false, error: "Error al obtener las listas de necesidades" },
        { status: 500 }
      );
    }

    if (!needsLists || needsLists.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
      });
    }

    // Batch: obtener TODAS las aprobaciones de todas las listas en un solo query
    const allListIds = needsLists.map(nl => nl.id);
    const { data: allApprovals } = await supabaseAdmin
      .from('needs_list_approvals')
      .select(`
        id,
        needs_list_id,
        department_id,
        status,
        approval_order,
        comments,
        approved_at,
        department:departments (
          name,
          code
        )
      `)
      .in('needs_list_id', allListIds)
      .order('approval_order');

    // Agrupar aprobaciones por needs_list_id
    const approvalsByListId = new Map<number, typeof allApprovals>();
    if (allApprovals) {
      for (const approval of allApprovals) {
        const listId = approval.needs_list_id;
        if (!approvalsByListId.has(listId)) {
          approvalsByListId.set(listId, []);
        }
        approvalsByListId.get(listId)!.push(approval);
      }
    }

    // Enriquecer datos sin queries adicionales
    const enrichedData = needsLists.map((needsList) => {
      // Parsear items
      let parsedItems: any[] = [];
      try {
        parsedItems = JSON.parse(needsList.items);
      } catch {
        parsedItems = [];
      }

      // Usar aprobaciones del batch
      const listApprovals = approvalsByListId.get(needsList.id) || [];

      // Determinar en qué departamento está actualmente
      const pendingApproval = listApprovals.find(a => a.status === 'pending');
      const pendingDept = pendingApproval?.department as { name: string; code: string } | { name: string; code: string }[] | null | undefined;
      const currentDepartment = (Array.isArray(pendingDept) ? pendingDept[0]?.name : pendingDept?.name) || null;

      // Verificar si el usuario puede aprobar esta lista
      let canApprove = false;
      if (userData.is_department_head && userData.department_id && pendingApproval) {
        canApprove = pendingApproval.department_id === userData.department_id;

        // Verificar que todas las aprobaciones anteriores estén completadas
        if (canApprove) {
          const previousApprovals = listApprovals.filter(
            a => a.approval_order < pendingApproval.approval_order
          );
          canApprove = previousApprovals.every(a => a.status === 'approved');
        }
      }

      // Determinar el estado de aprobación del departamento del usuario
      let myDepartmentStatus: string | null = null;
      if (userData.department_id) {
        const myApproval = listApprovals.find(
          (a: { department_id: string }) => a.department_id === userData.department_id
        );
        if (myApproval) {
          myDepartmentStatus = myApproval.status;
        }
      }

      return {
        ...needsList,
        date: needsList.created_at,
        items: parsedItems,
        itemCount: parsedItems.length,
        firstItem: parsedItems[0] || null,
        approvals: listApprovals,
        currentDepartment,
        canApprove,
        isOwnList: needsList.applicant_id === userData.id,
        my_department_status: myDepartmentStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: enrichedData,
      count: enrichedData.length,
    });

  } catch (error) {
    console.error("Error en GET /api/v1/needs-lists:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
