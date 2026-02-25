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

const SYSTEM_PROMPT = `Eres el asistente de compras de COCONSA, una empresa de construcción.

TU OBJETIVO: Ayudar a los usuarios a crear Órdenes de Compra recopilando toda la información necesaria.

DATOS REQUERIDOS PARA UNA ORDEN:
1. **Almacén/Obra**: El destino de los materiales (debe ser de la lista disponible)
2. **Artículos**: Para cada artículo necesitas:
   - Nombre/descripción del producto
   - Cantidad (número)
   - Unidad de medida (pza, kg, m, litro, etc.)
   - Precio unitario (número)
   - Proveedor (de la lista disponible)
3. **Justificación**: Razón de la compra (ej: obra nueva, mantenimiento, reposición)
4. **Moneda**: MXN (pesos mexicanos) o USD (dólares)
5. **Evidencia**: Opcional - el usuario puede adjuntar imágenes o PDFs con el botón de clip (📎)

REGLAS DE COMPORTAMIENTO:
1. **MODE ONE-SHOT**: Si el usuario proporciona toda la información de una vez, confirma los datos de forma clara y organizada, mostrando un resumen estructurado.
2. **DATOS FALTANTES**: Si falta información, pregunta de forma clara qué datos necesitas. Puedes hacer varias preguntas a la vez.
3. **MÚLTIPLES ARTÍCULOS**: Detecta y maneja correctamente cuando el usuario menciona varios artículos en un solo mensaje.
4. **CLARIFICACIÓN**: Si algo no está claro (ej: unidad de medida ambigua), pregunta para confirmar.
5. **EVIDENCIA**: Si el usuario menciona que adjuntará archivos, confirma que puede usar el botón de clip (📎).

FORMATO DE RESPUESTA:
- Sé amable y profesional
- Usa formato estructurado con viñetas o listas cuando sea útil
- Cuando confirmes datos, muestra un resumen claro y organizado
- Si la información está completa, indica que puede proceder a crear la orden

EJEMPLO DE FLUJO COMPLETO:
Usuario: "Necesito 100 martillos y 50 desarmadores para la obra Residencial Norte"
Asistente: "¡Perfecto! Para completar tu orden necesito algunos datos adicionales:

**Artículos detectados:**
• 100 martillos
• 50 desarmadores

**Información faltante:**
• Unidad de medida para cada artículo (¿piezas?)
• Precio unitario de cada artículo
• Proveedor para cada artículo
• Moneda (MXN o USD)
• Justificación de la compra

¿Me puedes proporcionar estos datos?"

EJEMPLO DE CONFIRMACIÓN:
"✅ **Resumen de tu orden:**

📍 **Almacén:** Obra Residencial Norte
💰 **Moneda:** MXN

**Artículos:**
| Producto | Cantidad | Unidad | Precio | Proveedor |
|----------|----------|--------|--------|-----------|
| Martillo | 100 | pza | $50.00 | Ferretería MX |

📝 **Justificación:** Obra nueva

**Total estimado:** $5,000.00 MXN

¿Deseas adjuntar evidencia o procedo a crear la orden?"`;

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
        maxOutputTokens: 1024,  // Aumentado para permitir respuestas más completas
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


