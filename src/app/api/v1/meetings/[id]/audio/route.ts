import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';

type RouteContext = { params: Promise<{ id: string }> };

const BUCKET = 'meeting-audios';

// ============================================================
// POST /api/v1/meetings/[id]/audio
// Sube el audio de la reunión a Supabase Storage
// ============================================================
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Verificar propiedad de la reunión
  const { data: meeting, error: fetchError } = await supabaseAdmin
    .from('meetings')
    .select('id, organizer_id')
    .eq('id', id)
    .eq('organizer_id', session!.userId)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  // Leer el archivo de audio del body
  let audioBuffer: Buffer;
  let contentType: string;
  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo de audio' }, { status: 400 });
    }

    const allowedTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de archivo no permitido: ${file.type}` },
        { status: 400 }
      );
    }

    // Límite de 200MB por reunión
    if (file.size > 200 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo supera el límite de 200MB' }, { status: 400 });
    }

    audioBuffer = Buffer.from(await file.arrayBuffer());
    contentType = file.type;
  } catch {
    return NextResponse.json({ error: 'Error al leer el archivo de audio' }, { status: 400 });
  }

  // Ruta en Storage: {userId}/{meetingId}.webm
  const ext = contentType.split('/')[1] ?? 'webm';
  const audioPath = `${session!.userId}/${id}.${ext}`;

  // Subir a Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(audioPath, audioBuffer, {
      contentType,
      upsert: true, // Reemplazar si ya existe (por ejemplo, si se graba de nuevo)
    });

  if (uploadError) {
    console.error('[POST /audio] Storage upload error:', uploadError);
    return NextResponse.json({ error: 'Error al subir el audio' }, { status: 500 });
  }

  // Actualizar la reunión con la ruta del audio
  const { error: updateError } = await supabaseAdmin
    .from('meetings')
    .update({
      audio_path: audioPath,
      audio_size_bytes: audioBuffer.length,
    })
    .eq('id', id);

  if (updateError) {
    console.error('[POST /audio] DB update error:', updateError);
    // El audio ya se subió, así que devolvemos éxito igual
  }

  return NextResponse.json({
    success: true,
    audio_path: audioPath,
    audio_size_bytes: audioBuffer.length,
  });
}

// ============================================================
// GET /api/v1/meetings/[id]/audio
// Genera URL firmada para descargar el audio
// ============================================================
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Verificar propiedad y obtener la ruta del audio
  const { data: meeting, error: fetchError } = await supabaseAdmin
    .from('meetings')
    .select('id, organizer_id, audio_path')
    .eq('id', id)
    .eq('organizer_id', session!.userId)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  if (!meeting.audio_path) {
    return NextResponse.json({ error: 'Esta reunión no tiene audio grabado' }, { status: 404 });
  }

  // Generar URL firmada válida por 1 hora
  const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(meeting.audio_path, 3600);

  if (urlError || !signedUrl) {
    console.error('[GET /audio] Signed URL error:', urlError);
    return NextResponse.json({ error: 'Error al generar la URL de descarga' }, { status: 500 });
  }

  return NextResponse.json({ url: signedUrl.signedUrl, expires_in: 3600 });
}
