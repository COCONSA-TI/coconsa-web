import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { InsumoCategoria } from "@/types/database";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Schema estructurado para que Gemini devuelva los insumos en JSON
const insumoSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      clave: { type: SchemaType.STRING, description: "Clave o código del insumo" },
      descripcion: { type: SchemaType.STRING, description: "Descripción del insumo o material" },
      unidad: { type: SchemaType.STRING, description: "Unidad de medida (pza, m3, kg, lto, jor, hora, etc.)" },
      cantidad: { type: SchemaType.NUMBER, description: "Cantidad presupuestada" },
      costoUnitario: { type: SchemaType.NUMBER, description: "Costo unitario en pesos MXN" },
      monto: { type: SchemaType.NUMBER, description: "Monto total = cantidad × costo unitario" },
      porcentaje: { type: SchemaType.NUMBER, description: "Porcentaje del total del reporte" },
      categoria: {
        type: SchemaType.STRING,
        description: "Categoría del insumo. Debe ser exactamente uno de: Materiales, Mano de Obra, Herramienta, Equipo",
        enum: ["Materiales", "Mano de Obra", "Herramienta", "Equipo"],
      },
    },
    required: ["clave", "descripcion", "unidad", "cantidad", "costoUnitario", "monto", "categoria"],
  },
};

interface GeminiInsumo {
  clave: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  costoUnitario: number;
  monto: number;
  porcentaje?: number;
  categoria: InsumoCategoria;
}

/**
 * Llama a Gemini Vision para extraer los insumos del PDF de presupuesto.
 * El PDF se pasa directamente como inline data (base64), ya que Gemini
 * soporta PDFs de forma nativa.
 */
async function extractInsumosFromPDF(pdfBuffer: Buffer, fileName: string): Promise<GeminiInsumo[]> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      // @ts-expect-error — responseSchema es válido pero los tipos del SDK lo marcan con advertencia
      responseSchema: insumoSchema,
      responseMimeType: "application/json",
    },
  });

  const pdfBase64 = pdfBuffer.toString("base64");

  const prompt = `Eres un asistente especializado en construcción y presupuestos.
  
Analiza este documento PDF de "Explosión de Insumos de Presupuesto" de una obra de construcción.

Extrae TODOS los insumos que aparecen en las tablas del documento, separados por categoría:
- "Materiales": materiales de construcción (cemento, arena, tubería, etc.)
- "Mano de Obra": personal (operadores, ayudantes, choferes, etc.)
- "Herramienta": herramientas y equipos menores (herramienta menor, equipo de seguridad)
- "Equipo": maquinaria y equipo mayor (camiones, retroexcavadoras, compactadoras, etc.)

Para cada insumo extrae:
- clave: el código o clave identificadora del insumo (ej. "ABRAZPVC4", "ACEITE", "DIESEL")
- descripcion: descripción completa del insumo (ej. "ABRAZADERA PVC HID 4\" X1/2\" ROSC. CONICA")
- unidad: unidad de medida exacta como aparece en el documento (pza, m3, kg, lto, jor, hora, ton, etc.)
- cantidad: la cantidad numérica presupuestada
- costoUnitario: costo unitario en pesos MXN (sin símbolo $)
- monto: monto total en pesos MXN (sin símbolo $)
- porcentaje: porcentaje del total del reporte (si aparece en el documento, si no usa 0)
- categoria: "Materiales", "Mano de Obra", "Herramienta" o "Equipo" según la sección donde aparezca

Devuelve ÚNICAMENTE el JSON array con todos los insumos encontrados. No incluyas los subtotales ni los totales del reporte.

El archivo procesado es: ${fileName}`;

  const result = await model.generateContent([
    {
      inlineData: {
        data: pdfBase64,
        mimeType: "application/pdf",
      },
    },
    prompt,
  ]);

  const text = result.response.text();

  // Gemini con responseMimeType="application/json" devuelve JSON limpio
  let parsed: GeminiInsumo[];
  try {
    parsed = JSON.parse(text);
  } catch {
    // Intentar limpiar el texto si no es JSON puro
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("La respuesta de Gemini no es un array válido de insumos");
  }

  return parsed;
}

/**
 * POST /api/v1/stores/[id]/budget
 * Carga y procesa el PDF de Explosión de Insumos de Presupuesto para una obra.
 * - Recibe el PDF (multipart/form-data)
 * - Lo procesa con Gemini para extraer los insumos
 * - Reemplaza todos los insumos de la obra en store_insumos
 * - Guarda un registro de auditoría en store_budget_uploads
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, session } = await requirePermission("orders", "create");
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    // Verificar que el store existe
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: "Centro de Costos no encontrado" }, { status: 404 });
    }

    // Leer el archivo PDF del request (multipart/form-data)
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Se requiere el archivo PDF (campo 'pdf')" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "El archivo debe ser un PDF. Tipo recibido: " + file.type },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `El archivo excede el límite de 20 MB (tamaño: ${Math.round(file.size / 1024 / 1024)} MB)` },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "La clave de API de Gemini no está configurada en el servidor" },
        { status: 500 }
      );
    }

    // Convertir el archivo a Buffer para Gemini
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Subir el PDF a Supabase Storage para auditoría
    let fileUrl: string | null = null;
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const storagePath = `presupuestos/${storeId}/${timestamp}_${safeName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("order-attachments")
      .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

    if (!uploadError) {
      const { data: urlData } = supabaseAdmin.storage
        .from("order-attachments")
        .getPublicUrl(storagePath);
      fileUrl = urlData?.publicUrl ?? null;
    }

    // Procesar el PDF con Gemini para extraer los insumos
    let geminiInsumos: GeminiInsumo[];
    try {
      geminiInsumos = await extractInsumosFromPDF(pdfBuffer, file.name);
    } catch (geminiError: unknown) {
      const errMsg = geminiError instanceof Error ? geminiError.message : "Error desconocido";
      return NextResponse.json(
        { error: `Error al procesar el PDF con IA: ${errMsg}` },
        { status: 500 }
      );
    }

    if (geminiInsumos.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron insumos en el PDF. Verifica que sea un documento de Explosión de Insumos." },
        { status: 422 }
      );
    }

    // Calcular totales por categoría
    const totales = { Materiales: 0, "Mano de Obra": 0, Herramienta: 0, Equipo: 0 };
    for (const insumo of geminiInsumos) {
      const cat = insumo.categoria as keyof typeof totales;
      if (cat in totales) totales[cat] += insumo.monto || 0;
    }
    const totalReporte = Object.values(totales).reduce((a, b) => a + b, 0);

    // ── MERGE INTELIGENTE POR CLAVE ──────────────────────────────────────────
    // En lugar de borrar y reinsertar, hacemos:
    //   1. Obtener todas las claves existentes en la BD para esta obra.
    //   2. Para cada insumo del PDF:
    //      - Si ya existe (misma clave) → UPDATE solo campos del PDF, PRESERVAR
    //        costo_autorizado, cantidad_solicitada, cantidad_comprada.
    //      - Si es nuevo → INSERT completo.
    //   3. Claves que existían pero no están en el PDF → marcar activo = false.
    // ─────────────────────────────────────────────────────────────────────────

    // Paso 1: Obtener registros actuales de la obra
    const { data: existingInsumos, error: fetchExistingError } = await supabaseAdmin
      .from("store_insumos")
      .select("id, clave, costo_autorizado, cantidad_solicitada, cantidad_comprada")
      .eq("store_id", storeId);

    if (fetchExistingError) {
      return NextResponse.json(
        { error: "Error al leer el presupuesto existente: " + fetchExistingError.message },
        { status: 500 }
      );
    }

    // Mapa clave → registro existente para lookup O(1)
    const existingMap = new Map(
      (existingInsumos ?? []).map((ins) => [ins.clave.trim(), ins])
    );

    // Claves que llegan en el nuevo PDF
    const newClaves = new Set(geminiInsumos.map((i) => i.clave?.trim() || "SIN_CLAVE"));

    // Paso 2a: Separar en actualizaciones e inserciones
    const toUpdate: Array<{ id: number; fields: Record<string, unknown> }> = [];
    const toInsert: Array<Record<string, unknown>> = [];

    for (const insumo of geminiInsumos) {
      const clave = insumo.clave?.trim() || "SIN_CLAVE";
      const existing = existingMap.get(clave);

      if (existing) {
        // El insumo ya existe: actualizar solo los campos que vienen del PDF.
        // Preservar: costo_autorizado, cantidad_solicitada, cantidad_comprada.
        toUpdate.push({
          id: existing.id,
          fields: {
            descripcion: insumo.descripcion?.trim() || "",
            unidad: insumo.unidad?.trim() || "pza",
            cantidad_presupuestada: Number(insumo.cantidad) || 0,
            costo_unitario: Number(insumo.costoUnitario) || 0,
            monto_presupuestado: Number(insumo.monto) || 0,
            porcentaje: Number(insumo.porcentaje) || 0,
            categoria: insumo.categoria || "Materiales",
            activo: true,
            updated_at: new Date().toISOString(),
          },
        });
      } else {
        // Insumo nuevo: insertar completo
        toInsert.push({
          store_id: storeId,
          clave,
          descripcion: insumo.descripcion?.trim() || "",
          unidad: insumo.unidad?.trim() || "pza",
          cantidad_presupuestada: Number(insumo.cantidad) || 0,
          costo_unitario: Number(insumo.costoUnitario) || 0,
          monto_presupuestado: Number(insumo.monto) || 0,
          porcentaje: Number(insumo.porcentaje) || 0,
          categoria: insumo.categoria || "Materiales",
          cantidad_solicitada: 0,
          cantidad_comprada: 0,
          costo_autorizado: null,
          activo: true,
        });
      }
    }

    // Paso 2b: Ejecutar updates individuales (Supabase no soporta batch update por ID variable)
    let updatedCount = 0;
    const updateErrors: string[] = [];
    for (const { id, fields } of toUpdate) {
      const { error: upErr } = await supabaseAdmin
        .from("store_insumos")
        .update(fields)
        .eq("id", id);
      if (upErr) {
        updateErrors.push(`ID ${id}: ${upErr.message}`);
      } else {
        updatedCount++;
      }
    }

    // Paso 2c: Insertar nuevos insumos
    let insertedInsumos: Array<{ id: number }> | null = null;
    let insertError: { message: string } | null = null;

    if (toInsert.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("store_insumos")
        .insert(toInsert)
        .select("id");
      insertedInsumos = data;
      insertError = error;
    }

    if (insertError) {
      return NextResponse.json(
        { error: "Error al guardar nuevos insumos: " + insertError.message },
        { status: 500 }
      );
    }

    // Paso 3: Marcar como inactivos los insumos que ya no están en el PDF
    const orphanIds = (existingInsumos ?? [])
      .filter((ins) => !newClaves.has(ins.clave.trim()))
      .map((ins) => ins.id);

    if (orphanIds.length > 0) {
      await supabaseAdmin
        .from("store_insumos")
        .update({ activo: false, updated_at: new Date().toISOString() })
        .in("id", orphanIds);
    }

    // Total de insumos activos después del merge
    const totalActivos = updatedCount + (insertedInsumos?.length ?? 0);

    // Guardar registro de auditoría de la carga
    const sessionData = await getSession();
    await supabaseAdmin.from("store_budget_uploads").insert({
      store_id: storeId,
      uploaded_by: sessionData?.userId || session?.userId || "unknown",
      file_name: file.name,
      file_url: fileUrl,
      total_materiales: totales["Materiales"],
      total_mano_obra: totales["Mano de Obra"],
      total_herramienta: totales["Herramienta"],
      total_equipo: totales["Equipo"],
      total_reporte: totalReporte,
      insumos_count: totalActivos,
    });

    return NextResponse.json({
      success: true,
      message: `Presupuesto actualizado exitosamente para la obra "${store.name}"`,
      store: { id: storeId, name: store.name },
      resumen: {
        totalInsumos: totalActivos,
        actualizados: updatedCount,
        nuevos: insertedInsumos?.length ?? 0,
        inactivados: orphanIds.length,
        totalReporte,
        ...(updateErrors.length > 0 && { advertencias: updateErrors }),
        totalesPorCategoria: {
          materiales: totales["Materiales"],
          manoDeObra: totales["Mano de Obra"],
          herramienta: totales["Herramienta"],
          equipo: totales["Equipo"],
        },
      },
    });
  } catch (error: unknown) {
    console.error("[stores/budget] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error al procesar la solicitud: " + errMsg }, { status: 500 });
  }
}

/**
 * GET /api/v1/stores/[id]/budget
 * Devuelve el resumen del presupuesto activo de una obra
 * y el historial de cargas.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requirePermission("orders", "create");
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    // Obtener el store
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (!store) {
      return NextResponse.json({ error: "Centro de Costos no encontrado" }, { status: 404 });
    }

    // Conteo y totales por categoría
    const { data: insumos } = await supabaseAdmin
      .from("store_insumos")
      .select("categoria, monto_presupuestado, cantidad_presupuestada, cantidad_solicitada, cantidad_comprada")
      .eq("store_id", storeId);

    const hasPresupuesto = (insumos?.length ?? 0) > 0;
    const resumen = {
      Materiales: { monto: 0, count: 0 },
      "Mano de Obra": { monto: 0, count: 0 },
      Herramienta: { monto: 0, count: 0 },
      Equipo: { monto: 0, count: 0 },
    } as Record<string, { monto: number; count: number }>;

    for (const ins of insumos ?? []) {
      const cat = ins.categoria as string;
      if (resumen[cat]) {
        resumen[cat].monto += ins.monto_presupuestado || 0;
        resumen[cat].count += 1;
      }
    }
    const totalReporte = Object.values(resumen).reduce((a, b) => a + b.monto, 0);

    // Última carga
    const { data: ultimaCarga } = await supabaseAdmin
      .from("store_budget_uploads")
      .select("file_name, created_at, insumos_count, total_reporte")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      store: { id: storeId, name: store.name },
      hasPresupuesto,
      totalInsumos: insumos?.length ?? 0,
      totalReporte,
      resumenPorCategoria: resumen,
      ultimaCarga: ultimaCarga ?? null,
    });
  } catch (error: unknown) {
    console.error("[stores/budget GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener el presupuesto" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/stores/[id]/budget
 * Elimina todos los insumos del presupuesto de la obra para permitir
 * cargar un PDF nuevo. No elimina el historial de cargas (store_budget_uploads).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requirePermission("orders", "create");
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);

    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .single();

    if (!store) {
      return NextResponse.json({ error: "Centro de Costos no encontrado" }, { status: 404 });
    }

    const { error: deleteError, count } = await supabaseAdmin
      .from("store_insumos")
      .delete({ count: "exact" })
      .eq("store_id", storeId);

    if (deleteError) {
      return NextResponse.json(
        { error: "Error al eliminar el presupuesto: " + deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Presupuesto de "${store.name}" eliminado correctamente`,
      insumosEliminados: count ?? 0,
    });
  } catch (error: unknown) {
    console.error("[stores/budget DELETE] Error:", error);
    return NextResponse.json({ error: "Error al eliminar el presupuesto" }, { status: 500 });
  }
}
