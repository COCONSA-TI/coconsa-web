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

    let query = supabaseAdmin
      .from('needs_lists')
      .select(`
        *,
        applicant:users!needs_lists_applicant_id_fkey (
          full_name,
          email
        ),
        store:stores (
          name
        ),
        bank_account:user_bank_accounts (
          bank_name,
          account_number,
          clabe
        )
      `)
      .order('created_at', { ascending: false });

    // Filtrar según el rol
    if (roleName === 'admin') {
      // Admin ve todas las listas
      // No aplicar filtros adicionales
    } else if (userData.is_department_head && userData.department_id) {
      // Jefe de departamento ve:
      // 1. Sus propias listas
      // 2. Listas donde su departamento tiene una aprobación (pendiente, aprobada o rechazada)
      const { data: approvals } = await supabaseAdmin
        .from('needs_list_approvals')
        .select('needs_list_id')
        .eq('department_id', userData.department_id);

      const needsListIds = approvals?.map(a => a.needs_list_id) || [];

      // Filtrar por listas propias o con aprobación en su departamento
      if (needsListIds.length > 0) {
        query = query.or(`applicant_id.eq.${userData.id},id.in.(${needsListIds.join(',')})`);
      } else {
        // Si no hay listas con aprobaciones, solo mostrar las propias
        query = query.eq('applicant_id', userData.id);
      }
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

    // Para cada lista, obtener información adicional de aprobaciones
    const enrichedData = await Promise.all(
      (needsLists || []).map(async (needsList) => {
        // Parsear items
        let parsedItems: any[] = [];
        try {
          parsedItems = JSON.parse(needsList.items);
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
            )
          `)
          .eq('needs_list_id', needsList.id)
          .order('approval_order');

        // Determinar en qué departamento está actualmente
        const pendingApproval = approvals?.find(a => a.status === 'pending');
        const currentDepartment = pendingApproval?.department?.name || null;

        // Verificar si el usuario puede aprobar esta lista
        let canApprove = false;
        if (userData.is_department_head && userData.department_id && pendingApproval) {
          canApprove = pendingApproval.department_id === userData.department_id;
          
          // Verificar que todas las aprobaciones anteriores estén completadas
          if (canApprove && approvals) {
            const previousApprovals = approvals.filter(
              a => a.approval_order < pendingApproval.approval_order
            );
            canApprove = previousApprovals.every(a => a.status === 'approved');
          }
        }

        // Determinar el estado de aprobación del departamento del usuario
        let myDepartmentStatus: string | null = null;
        if (userData.department_id && approvals) {
          const myApproval = approvals.find(
            (a: { department_id: string }) => a.department_id === userData.department_id
          );
          if (myApproval) {
            myDepartmentStatus = myApproval.status;
          }
        }

        return {
          ...needsList,
          items: parsedItems,
          itemCount: parsedItems.length,
          firstItem: parsedItems[0] || null,
          approvals: approvals || [],
          currentDepartment,
          canApprove,
          isOwnList: needsList.applicant_id === userData.id,
          my_department_status: myDepartmentStatus,
        };
      })
    );

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
