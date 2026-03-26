import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const supplierSchema = z.object({
  commercial_name: z.string().min(2, 'El nombre comercial requiere al menos 2 caracteres'),
  social_reason: z.string().min(2, 'La razón social requiere al menos 2 caracteres'),
  rfc: z.string().min(12, 'El RFC debe tener 12 o 13 caracteres').max(13, 'El RFC no puede exceder 13 caracteres').toUpperCase(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  clabe: z.string().length(18, 'La CLABE interbancaria debe tener exactamente 18 dígitos'),
  bank: z.string().min(2, 'El nombre del banco es requerido'),
  contact: z.string().nullable().optional(),
  category: z.string().min(2, 'La categoría es requerida'),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;

  try {
    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, supplier });
  } catch (error) {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await request.json();
    const validatedData = supplierSchema.parse(body);

    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Supplier PUT] Error:', error);
      return NextResponse.json({ error: 'Error al actualizar: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Proveedor actualizado', supplier });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Error de validación', 
        details: (error as any).errors.map((e: any) => e.message) 
      }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;

  try {
    // IMPORTANTE: Un proveedor podría estar atado a ordenes ('supplier_id').
    // Si la integridad referencial (foreign keys) está activa, esto lanzará un error si tiene ordenes asociadas.
    const { error } = await supabaseAdmin
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Supplier DELETE] Error:', error);
      if (error.code === '23503') { // Postgres foreign key violation
        return NextResponse.json({ error: 'No se puede eliminar el proveedor porque tiene órdenes de compra asociadas.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Error al eliminar: ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Proveedor eliminado permanentemente' });
  } catch (error) {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 });
  }
}
