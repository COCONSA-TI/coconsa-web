import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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
        { error: "La clave de API de Gemini no está configurada" },
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `Eres el sistema inteligente de extracción de datos financieros de reportes de obra de COCONSA.
Tu objetivo es analizar el contenido de la plantilla o reporte semanal adjunto (Excel, CSV o PDF) y extraer los valores financieros de la semana.

REGLAS DE EXTRACCIÓN (MUY ESTRICTAS):
1. Devuelve ÚNICAMENTE un objeto JSON válido (sin Markdown, sin triples comillas \`\`\`json).
2. Si un concepto no viene especificado o es 0, asígnalo como 0.
3. Formato de fechas: "YYYY-MM-DD" (Año-Mes-Día).
4. El objeto JSON resultante DEBE tener la siguiente estructura exacta:

{
  "semana_numero": 1,
  "fecha_inicio": "2026-06-01",
  "fecha_fin": "2026-06-07",
  "importe_generado": 150000.00,
  "egreso_maquinaria_equipo": 12000.00,
  "egreso_nomina_directa": 45000.00,
  "egreso_seguro_nomina_directa": 5000.00,
  "egreso_destajos": 30000.00,
  "egreso_materiales": 60000.00,
  "egreso_diesel": 8000.00,
  "egreso_nomina_indirecta": 10000.00,
  "egreso_seguro_nomina_indirecta": 2000.00,
  "egreso_gastos_indirectos": 5000.00,
  "pct_avance_programa": 15.5,
  "comments": "Extracción automática vía IA"
}`;

    let textContent = "";
    if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
      textContent = buffer.toString("utf-8");
    }

    const parts: any[] = [systemPrompt];

    if (textContent) {
      parts.push(`CONTENIDO DEL ARCHIVO CSV:\n${textContent}`);
    } else {
      parts.push({
        inlineData: {
          data: buffer.toString("base64"),
          mimeType,
        },
      });
    }

    const result = await model.generateContent(parts);
    const rawText = result.response.text().trim();

    const cleanedJsonStr = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const extractedData = JSON.parse(cleanedJsonStr);

    return NextResponse.json({
      success: true,
      message: "Reporte semanal extraído con éxito por la IA",
      extractedData,
    });
  } catch (error: unknown) {
    console.error("[parse-excel API] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido al procesar el archivo";
    return NextResponse.json({ error: "Error al procesar el archivo con IA: " + errMsg }, { status: 500 });
  }
}
