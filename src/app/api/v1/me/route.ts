import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { UserRoleRelation } from "@/types/database";

export async function GET() {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener información completa del usuario desde la base de datos
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id, 
        email, 
        full_name,
        is_department_head,
        department_id,
        department:departments(
          code,
          name
        ),
        roles (
          name
        )
      `)
      .eq('id', session.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const userRoles = userData.roles as UserRoleRelation | UserRoleRelation[] | null;
    const roleName = Array.isArray(userRoles) ? userRoles[0]?.name : userRoles?.name || 'user';
    const department = Array.isArray(userData.department) ? userData.department[0] : userData.department;
    const departmentCode = department?.code || null;
    const departmentCodeLower = (department?.code || '').toLowerCase();
    const departmentNameLower = (department?.name || '').toLowerCase();
    const isDirectionDepartment = departmentCodeLower === 'direccion' || departmentNameLower.includes('direccion');
    const canManageSuppliers =
      roleName === 'admin' ||
      (Boolean(userData.is_department_head) && isDirectionDepartment);

    return NextResponse.json({ 
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        role: roleName,
        is_department_head: userData.is_department_head || false,
        department_id: userData.department_id || null,
        department_code: departmentCode,
        can_manage_suppliers: canManageSuppliers,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
