import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

/**
 * GET /api/v1/needs-lists/[id]/expense-proofs
 * Obtiene todas las comprobaciones de gastos para una lista de necesidades
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: needsListId } = await params;

    const { data: proofs, error } = await supabaseAdmin
      .from('expense_proofs')
      .select(`
        *,
        uploader:users!expense_proofs_uploaded_by_fkey(
          full_name,
          email
        )
      `)
      .eq('needs_list_id', needsListId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, proofs });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * POST /api/v1/needs-lists/[id]/expense-proofs
 * Sube una nueva comprobación de gasto
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: needsListId } = await params;
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { description, amount, files } = body;

    if (!description || amount === undefined || !files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 });
    }

    // Por cada archivo, insertamos un registro en expense_proofs
    const proofsToInsert = files.map((file: any) => ({
      needs_list_id: needsListId,
      uploaded_by: session.userId,
      description,
      amount, // El monto total del gasto se puede repetir si hay múltiples archivos (ej. xml y pdf) o dividir. Idealmente suben 1 comprobante por gasto.
      file_name: file.name,
      file_url: file.url,
      file_type: file.type,
      file_size: file.size,
      storage_path: file.path,
    }));

    const { data, error } = await supabaseAdmin
      .from('expense_proofs')
      .insert(proofsToInsert)
      .select();

    if (error) {
      console.error('Error insertando expense_proofs:', error);
      return NextResponse.json({ success: false, error: 'Error al guardar la comprobación' }, { status: 500 });
    }

    return NextResponse.json({ success: true, proofs: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
