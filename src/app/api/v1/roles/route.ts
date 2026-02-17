import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

// GET - Obtener todos los roles (solo admin)
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data: roles, error } = await supabaseAdmin
      .from('roles')
      .select('id, name, description')
      .order('id', { ascending: true });

    if (error) {
      console.error('Error fetching roles:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener roles' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      roles: roles || [],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
