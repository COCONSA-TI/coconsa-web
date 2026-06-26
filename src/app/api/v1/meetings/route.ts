import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CreateMeetingRequest } from '@/types/database';

// ============================================================
// GET /api/v1/meetings — Listar reuniones del usuario autenticado
// ============================================================
export async function GET(request: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  let query = supabaseAdmin
    .from('meetings')
    .select('*')
    .eq('organizer_id', session!.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error: dbError, count } = await query;

  if (dbError) {
    console.error('[GET /api/v1/meetings]', dbError);
    return NextResponse.json({ error: 'Error al obtener las reuniones' }, { status: 500 });
  }

  return NextResponse.json({ meetings: data ?? [], total: count ?? 0 });
}

// ============================================================
// POST /api/v1/meetings — Crear nueva reunión
// ============================================================
export async function POST(request: NextRequest) {
  const { error, session } = await requireAuth();
  if (error) return error;

  let body: CreateMeetingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const { title, description, attendees } = body;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return NextResponse.json({ error: 'El título es requerido' }, { status: 400 });
  }

  if (title.trim().length > 200) {
    return NextResponse.json({ error: 'El título no puede superar 200 caracteres' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('meetings')
    .insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      organizer_id: session!.userId,
      attendees: attendees ?? [],
      status: 'draft',
    })
    .select()
    .single();

  if (dbError) {
    console.error('[POST /api/v1/meetings]', dbError);
    return NextResponse.json({ error: 'Error al crear la reunión' }, { status: 500 });
  }

  return NextResponse.json({ meeting: data }, { status: 201 });
}
