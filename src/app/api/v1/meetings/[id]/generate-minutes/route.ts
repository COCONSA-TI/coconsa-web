import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { requireAuth } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { MeetingMinutes } from '@/types/database';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY ?? '');
const MODEL = 'gemini-2.5-flash';

type RouteContext = { params: Promise<{ id: string }> };

// ─── Prompts ──────────────────────────────────────────────────────────────────

const TRANSCRIPTION_PROMPT = `Eres un experto transcriptor de audio en español.
Transcribe con exactitud el audio de esta reunión de negocios.

REGLAS:
- Transcribe TODO lo que se dice, incluyendo nombres y términos técnicos de construcción.
- Si hay partes inaudibles, escribe [inaudible].
- No agregues resúmenes ni comentarios. Solo la transcripción literal.
- Usa puntuación natural para facilitar la lectura.
- Responde ÚNICAMENTE con el texto transcrito, sin encabezados ni explicaciones.`;

const MINUTES_SYSTEM_PROMPT = `Eres un secretario ejecutivo experto en documentación corporativa de empresas de construcción en México.
Tu tarea es generar minutas de reunión formales, claras y estructuradas a partir de transcripciones.

INSTRUCCIONES CRÍTICAS:
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto adicional, sin markdown, sin bloques de código.
- Si la transcripción está incompleta o es difícil de entender, infiere lo mejor que puedas, PERO si la transcripción es solo una prueba corta, ruido (ej. "hola hola"), o no tiene sustancia, NO inventes información. Pon en objetivo: "Prueba de audio. No se registraron temas reales." y devuelve arrays vacíos.
- Usa el contexto de COCONSA (empresa constructora) para interpretar términos técnicos, solo si se mencionan explícitamente.
- Todos los textos deben estar en español formal.
- Las fechas deben estar en formato DD/MM/YYYY cuando sea posible.
- Si no se mencionó algo en la transcripción, usa null o array vacío según corresponda.

FORMATO JSON REQUERIDO (sin variaciones):
{
  "fecha": "string — fecha de la reunión en formato DD/MM/YYYY",
  "participantes": ["array de nombres de participantes mencionados"],
  "objetivo": "string — objetivo principal de la reunión (1-2 oraciones)",
  "puntos_tratados": [
    {
      "titulo": "string — título conciso del punto tratado",
      "detalle": "string — resumen del punto con detalles relevantes"
    }
  ],
  "acuerdos": ["array de acuerdos y decisiones tomadas, cada uno como string"],
  "tareas": [
    {
      "responsable": "string — nombre del responsable",
      "tarea": "string — descripción de la tarea asignada",
      "fecha_compromiso": "string en formato DD/MM/YYYY o null si no se especificó"
    }
  ],
  "proxima_reunion": "string con fecha/hora de próxima reunión o null si no se acordó"
}`;

// ─── Helper: obtener MIME type del audio ──────────────────────────────────────

function getMimeType(audioPath: string): string {
  const ext = audioPath.split('.').pop()?.toLowerCase() ?? 'webm';
  const mimeMap: Record<string, string> = {
    webm: 'audio/webm',
    mp4:  'audio/mp4',
    m4a:  'audio/mp4',
    ogg:  'audio/ogg',
    wav:  'audio/wav',
    mp3:  'audio/mpeg',
  };
  return mimeMap[ext] ?? 'audio/webm';
}

// ─── Helper: limpiar respuesta JSON de Gemini ─────────────────────────────────

function extractJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

// ─── Helper: Retry wrapper para manejar 503 Service Unavailable y 429 ─────────

async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.response?.status;
      // Solo reintentar en 503 (Unavailable) o 429 (Too Many Requests)
      if (status === 503 || status === 429 || error?.message?.includes('503') || error?.message?.includes('429')) {
        const delay = baseDelayMs * Math.pow(2, i);
        console.warn(`[withRetry] Intento ${i + 1} falló con ${status}. Reintentando en ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Lanzar inmediatamente si es otro tipo de error
      }
    }
  }
  throw lastError;
}

// ─── Step 1: Transcribir audio con Gemini ─────────────────────────────────────

async function transcribeAudioWithGemini(
  audioPath: string,
  meetingTitle: string,
): Promise<{ transcript: string; error?: string }> {
  // Descargar audio desde Supabase Storage
  const { data: audioBlob, error: dlError } = await supabaseAdmin.storage
    .from('meeting-audios')
    .download(audioPath);

  if (dlError || !audioBlob) {
    console.error('[transcribeAudio] Storage download error:', dlError);
    return { transcript: '', error: 'No se pudo descargar el audio desde el servidor.' };
  }

  const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
  const mimeType = getMimeType(audioPath);

  // Generar un nombre único para el archivo temporal en Gemini
  const displayName = `meeting_audio_${Date.now()}`;

  let uploadedFile;
  try {
    // Subir el buffer directamente usando File Manager API
    const uploadResult = await fileManager.uploadFile(audioBuffer, {
      mimeType,
      displayName,
    });
    uploadedFile = uploadResult.file;
  } catch (err) {
    console.error('[transcribeAudio] Gemini File Manager error:', err);
    return { transcript: '', error: 'Error al subir el audio a los servidores de IA.' };
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await withRetry(() => 
      model.generateContent([
        {
          fileData: {
            mimeType: uploadedFile.mimeType,
            fileUri: uploadedFile.uri,
          },
        },
        `${TRANSCRIPTION_PROMPT}\n\nContexto: Esta es la grabación de la reunión "${meetingTitle}" de la empresa COCONSA.`,
      ])
    );

    const transcript = result.response.text().trim();
    return { transcript };
  } catch (err) {
    console.error('[transcribeAudio] Gemini GenerateContent error:', err);
    return { transcript: '', error: 'Error al transcribir el audio con IA.' };
  } finally {
    // Siempre intentar eliminar el archivo de los servidores de Google al terminar (o fallar)
    if (uploadedFile?.name) {
      try {
        await fileManager.deleteFile(uploadedFile.name);
      } catch (delErr) {
        console.warn('[transcribeAudio] No se pudo borrar el archivo temporal en Gemini:', delErr);
      }
    }
  }
}

// ─── Step 2: Generar minuta desde transcripción ───────────────────────────────

async function generateMinutesFromTranscript(
  transcript: string,
  context: { title: string; attendees: string[]; started_at: string | null },
): Promise<{ minutes: MeetingMinutes | null; error?: string }> {
  const meetingContext = [
    `Título de la reunión: ${context.title}`,
    context.started_at
      ? `Fecha/hora de inicio: ${new Date(context.started_at).toLocaleString('es-MX')}`
      : '',
    context.attendees.length
      ? `Participantes registrados: ${context.attendees.join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const userPrompt = `CONTEXTO DE LA REUNIÓN:\n${meetingContext}\n\nTRANSCRIPCIÓN COMPLETA:\n${transcript}\n\nGenera la minuta en el formato JSON especificado.`;

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: MINUTES_SYSTEM_PROMPT,
  });

  try {
    const result = await withRetry(() => model.generateContent(userPrompt));
    const rawText = result.response.text().trim();
    const cleaned = extractJson(rawText);

    const minutes = JSON.parse(cleaned) as MeetingMinutes;
    return { minutes };
  } catch (err: any) {
    console.error('[generate-minutes] Error generating/parsing minutes:', err);
    return { minutes: null, error: err.message?.includes('503') ? 'Servicio de IA saturado. Intenta de nuevo en unos minutos.' : 'La IA devolvió un formato inesperado o falló. Intenta nuevamente.' };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

// POST /api/v1/meetings/[id]/generate-minutes
export async function POST(request: NextRequest, { params }: RouteContext) {
  const { error, session } = await requireAuth();
  if (error) return error;

  const { id } = await params;

  // Obtener la reunión (incluyendo audio_path para el fallback)
  const { data: meeting, error: fetchError } = await supabaseAdmin
    .from('meetings')
    .select('id, organizer_id, transcript, title, attendees, started_at, audio_path')
    .eq('id', id)
    .eq('organizer_id', session!.userId)
    .single();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  }

  // El frontend puede enviar la transcripción del state (más reciente que la BD)
  let body: { transcript?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Body vacío — se usará la transcripción de la BD o el audio
  }

  let transcript = (body.transcript ?? meeting.transcript ?? '').trim();
  let transcribedByAI = false;

  // ── Si no hay transcripción de texto, intentar transcribir el audio con Gemini ──
  if (!transcript) {
    if (!meeting.audio_path) {
      return NextResponse.json(
        { error: 'No hay transcripción ni audio disponible. Graba la reunión primero.' },
        { status: 400 }
      );
    }

    console.log('[generate-minutes] Sin transcripción de texto — transcribiendo audio con Gemini...');
    const { transcript: aiTranscript, error: transcribeError } = await transcribeAudioWithGemini(
      meeting.audio_path,
      meeting.title,
    );

    if (transcribeError || !aiTranscript) {
      return NextResponse.json(
        { error: transcribeError ?? 'No se pudo transcribir el audio.' },
        { status: 422 }
      );
    }

    transcript = aiTranscript;
    transcribedByAI = true;

    // Guardar la transcripción generada por IA en la BD para futura referencia
    await supabaseAdmin
      .from('meetings')
      .update({ transcript })
      .eq('id', id);
  }

  // ── Generar la minuta desde la transcripción ──────────────────────────────────
  let minutes: MeetingMinutes;
  try {
    const { minutes: generated, error: minutesError } = await generateMinutesFromTranscript(
      transcript,
      {
        title: meeting.title,
        attendees: meeting.attendees ?? [],
        started_at: meeting.started_at,
      }
    );

    if (minutesError || !generated) {
      return NextResponse.json(
        { error: minutesError ?? 'Error al generar la minuta.' },
        { status: 502 }
      );
    }

    minutes = generated;
  } catch (aiError) {
    console.error('[generate-minutes] Gemini error:', aiError);
    return NextResponse.json(
      { error: 'Error al comunicarse con el servicio de IA. Intenta nuevamente.' },
      { status: 503 }
    );
  }

  // ── Actualizar la base de datos ───────────────────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from('meetings')
    .update({ minutes_structured: minutes, transcript, status: 'completed' })
    .eq('id', id);

  if (updateError) {
    console.error('[generate-minutes] DB update error:', updateError);
    return NextResponse.json({ error: 'Error al guardar la minuta en la base de datos.' }, { status: 500 });
  }

  return NextResponse.json({
    minutes,
    transcript,
    transcribedByAI
  });
}
