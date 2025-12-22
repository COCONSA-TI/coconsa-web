import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatbotMessageSchema } from "@/lib/schemas";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Prompt del sistema para el asistente
const SYSTEM_PROMPT = `Eres un asistente virtual amigable de COCONSA, una empresa líder en construcción industrial y comercial en México.

Tu objetivo es ayudar a los usuarios a crear órdenes de compra de manera conversacional y eficiente.

FLUJO DE CONVERSACIÓN:
1. SALUDO INICIAL: Saluda al usuario por su nombre (ya lo tienes) y pregunta si desea crear una orden de compra
2. SI ELIGE ORDEN DE COMPRA: Recopila la siguiente información de forma natural y conversacional:

INFORMACIÓN REQUERIDA:
- Almacén u obra (se le mostrará una lista de opciones disponibles)
- Para CADA artículo:
  * Nombre del artículo
  * Cantidad y unidad
  * Precio unitario (sin IVA)
  * Proveedor (se le mostrarán opciones disponibles)
- Justificación de la compra
- Moneda (MXN o USD)
- Retención (opcional)

NOTA IMPORTANTE: 
- NO preguntes el nombre del solicitante, ya lo tienes del sistema
- Cuando preguntes por el almacén, menciona que verá una lista de opciones
- Cada artículo puede tener un proveedor diferente
- Pregunta el proveedor ESPECÍFICO para cada artículo

INSTRUCCIONES IMPORTANTES:
1. Sé conversacional y amigable, no parezcas un robot
2. Pregunta de manera natural, máximo 2 campos a la vez
3. Para CADA artículo pregunta: nombre, cantidad, unidad, precio Y proveedor
4. Confirma la información antes de que el usuario cree la orden
5. Siempre responde en español
6. Mantén respuestas cortas (máximo 2-3 líneas)
7. Permite agregar múltiples artículos
8. Al finalizar, confirma que toda la información está lista

EJEMPLOS DE BUENAS RESPUESTAS:
- "¡Hola [Nombre]! ¿Necesitas crear una orden de compra?"
- "Perfecto. ¿Para qué almacén u obra es esta compra? (Verás las opciones disponibles)"
- "Excelente. Dime el primer artículo: nombre, cantidad y unidad."
- "¿Cuál es el precio unitario (sin IVA)?"
- "¿De qué proveedor será este artículo?"
- "¿Deseas agregar otro artículo? (sí/no)"
- "¿Cuál es la justificación de esta compra?"
- "¿En qué moneda? (MXN o USD)"

NO uses listas numeradas ni bullet points. Habla naturalmente.`;

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
      console.error('Error obteniendo usuario:', userError);
      return NextResponse.json(
        { 
          error: "No se pudieron obtener los datos de tu usuario",
          details: userError?.message || 'Usuario no encontrado'
        },
        { status: 500 }
      );
    }

    // Obtener lista de almacenes disponibles
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .order('name');

    // Obtener lista de proveedores disponibles
    const { data: suppliers, error: suppliersError } = await supabaseAdmin
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
      console.error("GEMINI_API_KEY no está configurada");
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
      console.log('✅ Gemini response:', botMessage);
    } catch (geminiError: any) {
      console.error('❌ Error de Gemini:', geminiError);
      throw new Error(`Error de Gemini API: ${geminiError?.message || 'Error desconocido'}`);
    }

    // Extraer información estructurada de la conversación completa
    let extractedData;
    try {
      extractedData = await extractInformation(
        [...conversationHistory, { role: "user", content: message }, { role: "assistant", content: botMessage }],
        userData,
        stores || [],
        suppliers || []
      );
      console.log('✅ Datos extraídos:', extractedData);
    } catch (extractError: any) {
      console.error('❌ Error al extraer información:', extractError);
      throw new Error(`Error al extraer información: ${extractError?.message || 'Error desconocido'}`);
    }

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

  } catch (error: any) {
    console.error("Error en el chatbot:", error);
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: error?.message || 'Error desconocido',
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Extrae información estructurada de la conversación para orden de compra
 */
async function extractInformation(
  conversationHistory: Array<{ role: string; content: string }>,
  userData: any,
  stores: any[],
  suppliers: any[]
) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Crear prompt para extraer información
    const conversationText = conversationHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const extractionPrompt = `Analiza la siguiente conversación y extrae SOLO la información que el usuario haya proporcionado explícitamente para crear una orden de compra. Si no mencionó algo, déjalo como null.

NOTA: NO extraigas el nombre del solicitante, se obtiene automáticamente del sistema.

Conversación:
${conversationText}

Extrae y devuelve SOLO un objeto JSON con esta estructura (sin texto adicional, sin markdown, solo el JSON):
{
  "store_name": "nombre del almacén u obra o null",
  "items": [
    {
      "nombre": "nombre del artículo",
      "cantidad": cantidad_numerica,
      "unidad": "unidad (pza, kg, m, etc)",
      "precioUnitario": precio_sin_iva_numerico,
      "proveedor": "nombre del proveedor para ESTE artículo o null"
    }
  ],
  "justification": "justificación de la compra o null",
  "currency": "MXN o USD o null",
  "retention": "retención si la mencionó o null",
  "isComplete": true o false
}

REGLAS ESTRICTAS PARA isComplete:
isComplete debe ser true SOLO SI SE CUMPLEN TODAS estas condiciones:
1. store_name no es null Y tiene al menos 3 caracteres
2. items es un array con AL MENOS 1 elemento
3. CADA item del array tiene:
   - nombre (string no vacío)
   - cantidad (número mayor a 0)
   - unidad (string no vacío)
   - precioUnitario (número mayor a 0)
   - proveedor (string no vacío) ← IMPORTANTE: cada artículo debe tener su proveedor
4. justification no es null Y tiene al menos 10 caracteres
5. currency es "MXN" o "USD" (no null)

NOTA: NO se valida applicant_name porque se obtiene automáticamente del usuario logueado.

Si falta CUALQUIERA de estos datos, isComplete debe ser false.

IMPORTANTE: 
- Solo extrae información explícitamente mencionada
- items debe ser un array, aunque esté vacío []
- cantidad y precioUnitario deben ser NÚMEROS, no strings
- CADA item debe tener su propio proveedor
- No inventes información
- Retorna SOLO el objeto JSON, sin explicaciones ni formato markdown`;

    const result = await model.generateContent(extractionPrompt);
    const response = result.response;
    let extractedText = response.text().trim();
    console.log('Texto extraído raw:', extractedText.substring(0, 200));

    // Limpiar el texto de posibles markdown code blocks
    extractedText = extractedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    console.log('Texto limpio:', extractedText.substring(0, 200));

    // Parsear el JSON
    let extracted;
    try {
      extracted = JSON.parse(extractedText);
      console.log('✅ JSON parseado:', extracted);
    } catch (parseError: any) {
      console.error('❌ Error parseando JSON:', parseError);
      console.error('Texto que causó el error:', extractedText);
      throw new Error(`Error al parsear JSON de Gemini: ${parseError?.message}`);
    }

    // Limpiar valores null string a null real
    Object.keys(extracted).forEach((key) => {
      if (extracted[key] === "null" || extracted[key] === "") {
        extracted[key] = null;
      }
    });

    // Agregar automáticamente el nombre del usuario logueado
    extracted.applicant_name = userData.full_name;
    extracted.applicant_id = userData.id;

    // Intentar encontrar el store_id si el usuario proporcionó el nombre
    if (extracted.store_name) {
      const matchingStore = stores.find(s => 
        s.name.toLowerCase().includes(extracted.store_name.toLowerCase()) ||
        extracted.store_name.toLowerCase().includes(s.name.toLowerCase())
      );
      if (matchingStore) {
        extracted.store_id = matchingStore.id;
      }
    }

    // Para cada item, intentar encontrar el supplier_id
    if (Array.isArray(extracted.items)) {
      extracted.items = extracted.items.map((item: any) => {
        if (item.proveedor) {
          const matchingSupplier = suppliers.find(s => 
            s.commercial_name.toLowerCase().includes(item.proveedor.toLowerCase()) ||
            item.proveedor.toLowerCase().includes(s.commercial_name.toLowerCase())
          );
          if (matchingSupplier) {
            item.supplier_id = matchingSupplier.id;
            item.supplier_name = matchingSupplier.commercial_name;
          } else {
            item.supplier_name = item.proveedor;
          }
        }
        return item;
      });
    }

    // Validación estricta de isComplete en el servidor
    const hasValidApplicant = true; // Siempre true porque viene del usuario logueado
    const hasValidStore = extracted.store_name !== null && extracted.store_name.length >= 3;
    const hasValidJustification = extracted.justification && extracted.justification.length >= 10;
    const hasValidCurrency = extracted.currency === 'MXN' || extracted.currency === 'USD';
    
    const hasValidItems = Array.isArray(extracted.items) && 
      extracted.items.length > 0 &&
      extracted.items.every((item: any) => 
        item.nombre && 
        item.nombre.trim().length > 0 &&
        typeof item.cantidad === 'number' && 
        item.cantidad > 0 &&
        item.unidad && 
        item.unidad.trim().length > 0 &&
        typeof item.precioUnitario === 'number' && 
        item.precioUnitario > 0 &&
        item.proveedor &&
        item.proveedor.trim().length > 0
      );

    // Sobreescribir isComplete con validación del servidor
    extracted.isComplete = hasValidApplicant && 
                          hasValidStore && 
                          hasValidJustification && 
                          hasValidCurrency &&
                          hasValidItems;

    console.log('Datos extraídos validados:', {
      hasValidApplicant,
      hasValidStore,
      hasValidJustification,
      hasValidCurrency,
      hasValidItems,
      isComplete: extracted.isComplete,
      itemsCount: extracted.items?.length || 0
    });

    return extracted;
  } catch (error: any) {
    console.error("❌ Error al extraer información:", error);
    console.error("Stack trace:", error?.stack);
    // Re-lanzar el error en lugar de retornar objeto vacío
    throw new Error(`Error en extractInformation: ${error?.message || 'Error desconocido'}`);
  }
}

