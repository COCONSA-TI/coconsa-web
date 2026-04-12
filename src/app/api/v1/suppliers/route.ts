import { NextResponse } from 'next/server';
import { requireDepartmentHead } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

// Esquema de validación usando Zod (buenas prácticas)
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

export async function GET(request: Request) {
  const { error: authError } = await requireDepartmentHead();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');

  try {
    let query = supabaseAdmin
      .from('suppliers')
      .select('*')
      .order('commercial_name', { ascending: true });

    if (search) {
      query = query.or(`commercial_name.ilike.%${search}%,rfc.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data: suppliers, error } = await query;

    if (error) {
      console.error('[Suppliers GET] Error:', error);
      return NextResponse.json({ error: 'Error al obtener proveedores' }, { status: 500 });
    }

    return NextResponse.json({ success: true, suppliers });
  } catch (error) {
    return NextResponse.json({ error: 'Error inesperado' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error: authError } = await requireDepartmentHead();
  if (authError) return authError;

  try {
    const body = await request.json();
    
    // Sanitización y validación con Zod
    const validatedData = supplierSchema.parse(body);

    // Utilizando UPSERT: Si el RFC ya existe, lo actualiza, de lo contrario lo crea
    // Tal cual lo solicitado en la query SQL del usuario
    const { data: supplier, error } = await supabaseAdmin
      .from('suppliers')
      .upsert(validatedData, {
        onConflict: 'rfc',
      })
      .select()
      .single();

    if (error) {
      console.error('[Suppliers POST] Upsert error:', error);
      // Extraer error si se viola alguna restricción de base de datos extra
      return NextResponse.json({ error: 'Error al guardar el proveedor. ' + error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Proveedor guardado exitosamente',
      supplier 
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Error de validación de datos', 
        details: (error as any).errors.map((e: any) => e.message) 
      }, { status: 400 });
    }
    
    console.error('[Suppliers POST] Inesperado:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
