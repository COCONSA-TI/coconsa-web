import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const catalogoSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      clave: { type: SchemaType.STRING, description: "Clave o número identificador del concepto (ej. 1, 2, 3)" },
      descripcion: { type: SchemaType.STRING, description: "Descripción completa del concepto de obra" },
      unidad: { type: SchemaType.STRING, description: "Unidad de medida (M2, M3, M, PZA, etc.)" },
      cantidad_presupuestada: { type: SchemaType.NUMBER, description: "Cantidad presupuestada numerica" },
      precio_unitario: { type: SchemaType.NUMBER, description: "Precio unitario numerico" },
      importe_presupuestado: { type: SchemaType.NUMBER, description: "Importe total numerico = cantidad x precio" },
      cantidad_acumulada: { type: SchemaType.NUMBER, description: "Cantidad ejecutada acumulada" },
      importe_acumulado: { type: SchemaType.NUMBER, description: "Importe ejecutado acumulado" },
    },
    required: ["clave", "descripcion", "unidad", "cantidad_presupuestada", "precio_unitario", "importe_presupuestado"],
  },
};

function robustParseJSON(rawText: string): any {
  let cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Limpiar comas flotantes antes de llaves o corchetes de cierre
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  // 1. Intento parse directo
  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    // 2. Extraer subcadena JSON delimitada
    const firstBracket = cleaned.search(/[\[\{]/);
    if (firstBracket !== -1) {
      const openChar = cleaned[firstBracket];
      const closeChar = openChar === "[" ? "]" : "}";
      const lastBracket = cleaned.lastIndexOf(closeChar);

      if (lastBracket > firstBracket) {
        const substring = cleaned
          .substring(firstBracket, lastBracket + 1)
          .replace(/,(\s*[}\]])/g, "$1");
        try {
          return JSON.parse(substring);
        } catch {
          // Intentar cerrar arreglo trunco en la última llave completa
          const lastCloseObj = substring.lastIndexOf("}");
          if (lastCloseObj !== -1) {
            let truncated = substring.substring(0, lastCloseObj + 1);
            truncated += openChar === "[" ? "]" : "}";
            try {
              return JSON.parse(truncated);
            } catch {
              // Ignorar y lanzar error inicial
            }
          }
        }
      }
    }
    throw err1;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);
    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "La clave de API de Gemini no está configurada en el servidor" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let mimeType = "application/pdf";
    if (fileName.endsWith(".xlsx")) {
      mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (fileName.endsWith(".xls")) {
      mimeType = "application/vnd.ms-excel";
    } else if (fileName.endsWith(".csv")) {
      mimeType = "text/csv";
    }

    const systemPrompt = `Eres el asistente experto en construcción de COCONSA.
Analiza este archivo (PDF, Excel o CSV) y extrae la lista completa de conceptos del catálogo de conceptos y programa de obra.

Para cada concepto extrae:
- clave: número o código de concepto (1, 2, 3, etc.)
- descripcion: descripción del trabajo o concepto
- unidad: unidad de medida (M2, M3, M, PZA, etc.)
- cantidad_presupuestada: cantidad presupuestada (número sin $)
- precio_unitario: precio unitario (número sin $)
- importe_presupuestado: importe total (número sin $)
- cantidad_acumulada: cantidad ejecutada acumulada (si aparece, o 0)
- importe_acumulado: importe ejecutado acumulado (si aparece, o 0)

Extrae TODOS los conceptos sin omitir ningún renglón.`;

    const fileContentObj = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType,
      },
    };

    let textResponse = "";

    try {
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          // @ts-expect-error — responseSchema es válido pero los tipos del SDK lo marcan con advertencia
          responseSchema: catalogoSchema,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      });
      const result = await model.generateContent([systemPrompt, fileContentObj]);
      textResponse = result.response.text();
    } catch {
      // Fallback a gemini-1.5-flash
      const fallbackModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          // @ts-expect-error — responseSchema es válido pero los tipos del SDK lo marcan con advertencia
          responseSchema: catalogoSchema,
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
        },
      });
      const result = await fallbackModel.generateContent([systemPrompt, fileContentObj]);
      textResponse = result.response.text();
    }

    const parsedData = robustParseJSON(textResponse);

    const extractedList = Array.isArray(parsedData)
      ? parsedData
      : parsedData.conceptos || parsedData.concepts || parsedData.items || parsedData.catalog || [];

    return NextResponse.json({
      success: true,
      extractedConcepts: extractedList,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al procesar archivo PDF/Excel" },
      { status: 500 }
    );
  }
}
