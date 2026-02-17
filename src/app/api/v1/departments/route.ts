import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

// GET - Obtener todos los departamentos (solo admin)
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data: departments, error } = await supabaseAdmin
      .from('departments')
      .select('id, name, code, requires_approval, approval_order')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener departamentos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      departments: departments || [],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
