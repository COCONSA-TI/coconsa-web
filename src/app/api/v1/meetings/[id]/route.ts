import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { UpdateMeetingRequest } from '@/types/database';

type RouteContext = { params: Promise<{ id: string }> };

// ============================================================
// GET /api/v1/meetings/[id] — Detalle de una reunión
// ============================================================
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  const { data, error: dbError } = await supabaseAdmin
    .from('meetings')
    .select('*')
    .eq('id', id)
    .eq('organizer_id', session!.userId)
    .single();

  if (dbError || !data) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ meeting: data });
}

// ============================================================
// PATCH /api/v1/meetings/[id] — Actualizar reunión
// ============================================================
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Verificar que la reunión pertenece al usuario
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('meetings')
    .select('id, organizer_id')
    .eq('id', id)
    .eq('organizer_id', session!.userId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  let body: UpdateMeetingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  // Campos permitidos para actualización
  const allowedFields: (keyof UpdateMeetingRequest)[] = [
    'title', 'description', 'attendees', 'started_at', 'ended_at',
    'duration_seconds', 'transcript', 'minutes_structured',
    'audio_path', 'audio_size_bytes', 'status',
  ];

  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No se proporcionaron campos para actualizar' }, { status: 400 });
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (dbError) {
    console.error('[PATCH /api/v1/meetings/:id]', dbError);
    return NextResponse.json({ error: 'Error al actualizar la reunión' }, { status: 500 });
  }

  return NextResponse.json({ meeting: data });
}

// ============================================================
// DELETE /api/v1/meetings/[id] — Eliminar reunión y su audio
// ============================================================
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Obtener la reunión para recuperar la ruta del audio
  const { data: meeting, error: fetchError } = await supabaseAdmin
    .from('meetings')
    .select('id, organizer_id, audio_path')
    .eq('id', id)
    .eq('organizer_id', session!.userId)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  // Eliminar el audio del storage si existe
  if (meeting.audio_path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from('meeting-audios')
      .remove([meeting.audio_path]);

    if (storageError) {
      console.warn('[DELETE /api/v1/meetings/:id] storage error:', storageError.message);
      // No falla el delete si el storage falla — el archivo puede ya no existir
    }
  }

  const { error: dbError } = await supabaseAdmin
    .from('meetings')
    .delete()
    .eq('id', id);

  if (dbError) {
    console.error('[DELETE /api/v1/meetings/:id]', dbError);
    return NextResponse.json({ error: 'Error al eliminar la reunión' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
