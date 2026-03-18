import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: department, error } = await supabaseAdmin
      .from('departments')
      .select('id, name, code, approval_order, requires_approval')
      .eq('id', id)
      .single();

    if (error || !department) {
      return NextResponse.json(
        { success: false, error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      department
    });
  } catch (error) {
    console.error('Error fetching department:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener departamento' },
      { status: 500 }
    );
  }
}
