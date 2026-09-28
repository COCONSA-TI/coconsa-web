import { NextResponse } from 'next/server';
import { requireSupplierCreation } from '@/lib/api-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: Request) {
  try {
    const { error: authError } = await requireSupplierCreation();
    if (authError) return authError;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'La clave de API de Gemini no está configurada en las variables de entorno' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo para analizar' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let mimeType = 'application/pdf';
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (fileName.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (fileName.endsWith('.webp')) {
      mimeType = 'image/webp';
    } else if (!fileName.endsWith('.pdf')) {
      mimeType = file.type || 'image/jpeg';
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Eres el asistente contable y de compras de la empresa constructora COCONSA en México.
Tu tarea es analizar detalladamente el documento adjunto (carátula bancaria, estado de cuenta, constancia de situación fiscal del SAT, factura o identificación oficial) y extraer los datos requeridos para dar de alta al proveedor.

Debes devolver un JSON con la siguiente estructura exacta:
{
  "commercial_name": "Nombre comercial del proveedor",
  "social_reason": "Razón social fiscal oficial o nombre completo del contribuyente",
  "rfc": "RFC oficial o identificador temporal generado",
  "address": "Dirección fiscal o comercial completa en mayúsculas",
  "phone": "Teléfono de contacto o 'XXXX'",
  "clabe": "CLABE interbancaria de 18 dígitos o 'XXXX'",
  "bank": "Nombre del banco o 'XXXX'",
  "contact": "Nombre del contacto / representante o 'XXXX'",
  "category": "Categoría sugerida del proveedor o 'XXXX'"
}

REGLAS ESTRICTAS DE EXTRACCIÓN Y VALORES POR DEFECTO:
1. RFC:
   - Si encuentras el RFC oficial mexicano (12 caracteres para personas morales o 13 caracteres para personas físicas), devuélvelo en MAYÚSCULAS sin espacios ni guiones.
   - Si NO aparece el RFC o no es legible, GENERA UN RFC TEMPORAL con el prefijo "TEMP-" seguido del nombre principal en mayúsculas sin espacios ni caracteres especiales (ej: si el proveedor se llama DIEGO ALEJANDRO HERRERO SALAS, genera "TEMP-DIEGO-HERRERO"; si es ACEROS GUADALUPE SA DE CV, genera "TEMP-ACEROS-GUADALUPE").
2. Razón Social y Nombre Comercial:
   - "social_reason": Razón social legal completa (ej. "DIEGO ALEJANDRO HERRERO SALAS" o "MATERIALES Y TRITURADOS DEL NORTE S.A. DE C.V.").
   - "commercial_name": Nombre comercial comúnmente usado. Si el documento no especifica uno diferente, usa el mismo valor de "social_reason".
3. CLABE Interbancaria:
   - Busca una CLABE de 18 dígitos numéricos.
   - Si NO está disponible en el documento, pon EXACTAMENTE "XXXX".
4. Banco:
   - Deduce el banco emisor de la carátula o de los primeros 3 dígitos de la CLABE (012: BBVA, 002: BANAMEX, 014: SANTANDER, 072: BANORTE, 021: HSBC, 044: SCOTIABANK, 058: BANREGIO, 036: INBURSA, 137: BANCOPPEL, 127: BANCO AZTECA, 042: MIFEL, etc.).
   - Si no se encuentra ni se deduce, pon EXACTAMENTE "XXXX".
5. Contacto:
   - Si es persona física y no hay otro contacto explícito, usa el mismo nombre de la persona ("social_reason").
   - Si es persona moral, extrae el nombre del representante o persona de contacto; si no hay, pon EXACTAMENTE "XXXX".
6. Dirección:
   - Dirección fiscal o comercial completa en MAYÚSCULAS en una sola línea (ej. "C LIENZO CHARRO 114, FRACC VILLAS CENTENARIO, TORREON, COA, MEXICO").
   - Si no está presente, pon EXACTAMENTE "XXXX".
7. Teléfono:
   - Número telefónico a 10 dígitos o formato legible. Si no hay, pon EXACTAMENTE "XXXX".
8. Categoría:
   - Clasifica al proveedor según su giro en una de estas categorías típicas de construcción: "Materiales", "Servicios", "Fletes", "Maquinaria", "Ferretería", "Acero", "Concreto", "Subcontratista", "Combustible", "Papelería", "Mantenimiento", "Seguridad".
   - Si no es posible determinarlo con certeza, pon EXACTAMENTE "XXXX".`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: buffer.toString('base64'),
          mimeType,
        },
      },
    ]);

    const rawText = result.response.text().trim();
    const cleanedJsonStr = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const extractedData = JSON.parse(cleanedJsonStr);

    // Saneamiento de seguridad con los fallbacks del usuario
    const sanitizedData = {
      commercial_name: extractedData.commercial_name?.trim() || 'PROVEEDOR PENDIENTE',
      social_reason: extractedData.social_reason?.trim() || extractedData.commercial_name?.trim() || 'PROVEEDOR PENDIENTE',
      rfc: (extractedData.rfc?.trim() || 'TEMP-PROVEEDOR').toUpperCase(),
      address: extractedData.address?.trim() || 'XXXX',
      phone: extractedData.phone?.trim() || 'XXXX',
      clabe: extractedData.clabe?.trim() || 'XXXX',
      bank: (extractedData.bank?.trim() || 'XXXX').toUpperCase(),
      contact: extractedData.contact?.trim() || extractedData.commercial_name?.trim() || 'XXXX',
      category: extractedData.category?.trim() || 'XXXX',
    };

    return NextResponse.json({
      success: true,
      message: 'Datos del proveedor extraídos correctamente con Gemini 2.5-flash',
      data: sanitizedData,
    });
  } catch (error: unknown) {
    console.error('[parse-cover API] Error:', error);
    const errMsg = error instanceof Error ? error.message : 'Error desconocido al procesar carátula con IA';
    return NextResponse.json(
      { error: 'Error al analizar la carátula con IA: ' + errMsg },
      { status: 500 }
    );
  }
}
