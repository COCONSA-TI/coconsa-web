import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatbotMessageSchema } from "@/lib/schemas";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Store, Supplier, ApiError } from "@/types/database";

interface UserData {
  id: string;
  full_name: string | null;
}

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const SYSTEM_PROMPT = `Eres el asistente de compras de COCONSA.
META: Recopilar datos para Orden de Compra:
- Almacén (de lista)
- Artículos (nombre, cantidad, unidad, precio, proveedor)
- Justificación
- Moneda (MXN/USD)
- Evidencia (opcional, el usuario puede adjuntar archivos con el botón de clip)

REGLAS:
1. ONE-SHOT: Si el usuario da toda la info de golpe, confirma y pregunta si crear la orden. No hagas preguntas extras.
2. FALTANTES: Si falta algo, pregunta SOLO lo faltante.
3. MULTI-ITEM: Detecta múltiples artículos en un mensaje.
4. ARCHIVOS: Si el usuario menciona que adjuntará evidencia, confirma que puede usar el botón de clip (📎).
5. ESTILO: Conciso, eficiente, amable. Máx 2-3 líneas.

EJEMPLO:
Usuario: "100 martillos, almacén Norte, AcerosMX, $50, obra nueva, MXN"
Asistente: "Listo: 100 martillos, Norte, AcerosMX, $50 MXN. Justificación: obra nueva. ¿Adjuntas evidencia o creo la orden?"`;

export async function POST(request: Request) {
  try {
    // Obtener sesión del usuario
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado. Debes iniciar sesión." },
        { status: 401 }
      );
    }

    // Obtener datos del usuario desde la base de datos
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('id', session.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { 
          error: "No se pudieron obtener los datos de tu usuario",
          details: userError?.message || 'Usuario no encontrado'
        },
        { status: 500 }
      );
    }

    // Obtener lista de almacenes disponibles
    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .order('name');

    // Obtener lista de proveedores disponibles
    const { data: suppliers } = await supabaseAdmin
      .from('suppliers')
      .select('id, commercial_name')
      .order('commercial_name');

    const body = await request.json();
    
    // Validar el request
    const validatedFields = ChatbotMessageSchema.safeParse(body);
    
    if (!validatedFields.success) {
      return NextResponse.json(
        { 
          error: "Datos inválidos",
          details: validatedFields.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { message, conversationHistory = [] } = validatedFields.data;

    // Verificar que la API key esté configurada
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Configuración del servidor incompleta" },
        { status: 500 }
      );
    }

    // Obtener el modelo
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Construir el historial de conversación
    const history = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido. Actuaré como asistente virtual amigable de COCONSA y ayudaré a los usuarios a proporcionar su información de manera natural y conversacional." }],
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      })),
    ];

    // Iniciar chat con historial
    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 200,
        temperature: 0.7,
      },
    });

    // Enviar el mensaje del usuario
    let botMessage: string;
    try {
      const result = await chat.sendMessage(message);
      const response = result.response;
      botMessage = response.text();
    } catch (geminiError: unknown) {
      const apiError = geminiError as ApiError;
      throw new Error(`Error de Gemini API: ${apiError?.message || 'Error desconocido'}`);
    }

    // Extraer información estructurada usando IA (segunda pasada) para mayor precisión
    const fullHistory = [...conversationHistory, { role: "user", content: message }, { role: "assistant", content: botMessage }];
    const extractedData = await extractOrderDataWithAI(
      fullHistory,
      userData,
      (stores || []) as Store[],
      (suppliers || []) as Supplier[]
    );

    return NextResponse.json({
      success: true,
      message: botMessage,
      extractedData,
      availableStores: stores || [],
      availableSuppliers: suppliers || [],
      conversationHistory: [
        ...conversationHistory,
        { role: "user", content: message },
        { role: "assistant", content: botMessage },
      ],
    });

  } catch (error: unknown) {
    const apiError = error as ApiError;
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: apiError?.message || 'Error desconocido',
      },
      { status: 500 }
    );
  }
}

/**
 * Extrae información estructurada usando una llamada dedicada a la IA.
 * Esto es mucho más robusto que Regex para estructuras complejas como arrays de items.
 */
async function extractOrderDataWithAI(
  conversationHistory: Array<{ role: string; content: string }>,
  userData: UserData,
  stores: Store[],
  suppliers: Supplier[]
) {
  try {
    const extractionModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1, // Baja temperatura para mayor determinismo en JSON
      }
    });

    // Convertir conversación a texto plano para el prompt
    const conversationText = conversationHistory
      .map((msg) => `${msg.role === 'user' ? 'USUARIO' : 'ASISTENTE'}: ${msg.content}`)
      .join("\n");

    const extractionPrompt = `
      Analiza la siguiente conversación entre un asistente de compras y un usuario.
      Tu objetivo es extraer los datos de la Orden de Compra en formato JSON ESTRICTO.

      INFORMACIÓN DE CONTEXTO:
      - Solicitante: ${userData.full_name} (ID: ${userData.id})
      - Almacenes disponibles: ${JSON.stringify(stores.map(s => ({ id: s.id, name: s.name })))}
      - Proveedores disponibles: ${JSON.stringify(suppliers.map(s => ({ id: s.id, commercial_name: s.commercial_name })))}

      INSTRUCCIONES:
      1. Extrae el nombre del almacén/obra. Intenta coincidir con la lista de disponibles. Si encuentras coincidencia, incluye el ID.
      2. Extrae la lista de artículos (items). Para cada uno: nombre, cantidad (número), unidad, precio unitario (número) y proveedor.
      3. Para el proveedor, intenta coincidir con la lista. Si encuentras coincidencia exacta o muy cercana, incluye el ID.
      4. Extrae la justificación, moneda (MXN/USD) y retención (si existe).
      5. Determina 'isComplete' como true SOLO SI tienes: almacén, justificación, moneda y AL MENOS un artículo completo (con todos sus campos: nombre, cantidad, unidad, precio, proveedor).

      FORMATO JSON ESPERADO:
      {
        "store_name": "Nombre extraído o null",
        "store_id": "UUID coincidente o null",
        "items": [
          {
            "nombre": "Nombre del artículo",
            "cantidad": 10,
            "unidad": "pza",
            "precioUnitario": 100.50,
            "proveedor": "Nombre proveedor",
            "proveedor_id": "UUID coincidente o null"
          }
        ],
        "justification": "Texto o null",
        "currency": "MXN",
        "retention": "Texto o null",
        "applicant_name": "${userData.full_name}",
        "applicant_id": "${userData.id}",
        "isComplete": boolean
      }

      CONVERSACIÓN:
      ${conversationText}
    `;

    const result = await extractionModel.generateContent(extractionPrompt);
    const responseText = result.response.text();
    
    // Limpiar bloques de código markdown si existen (aunque responseMimeType ayuda, a veces añade ```json)
    const cleanedJson = responseText.replace(/```json\n?|\n?```/g, "").trim();
    
    return JSON.parse(cleanedJson);

  } catch {
    // Fallback básico para no romper el flujo si falla la IA de extracción
    return {
      store_name: null,
      items: [],
      isComplete: false,
      applicant_name: userData.full_name,
      applicant_id: userData.id
    };
  }
}


