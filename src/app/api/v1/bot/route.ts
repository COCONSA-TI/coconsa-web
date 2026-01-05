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

    // Extraer información estructurada usando parsing local (sin IA extra)
    const extractedData = extractInformationLocal(
      [...conversationHistory, { role: "user", content: message }, { role: "assistant", content: botMessage }],
      userData,
      stores || [],
      suppliers || []
    );
    console.log('✅ Datos extraídos:', extractedData);

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
 * Extrae información estructurada usando parsing local (SIN llamadas extra de IA)
 * Esto reduce de 2 llamadas por mensaje a solo 1 llamada
 */
function extractInformationLocal(
  conversationHistory: Array<{ role: string; content: string }>,
  userData: any,
  stores: any[],
  suppliers: any[]
) {
  // Inicializar estructura de datos
  const extracted: any = {
    store_name: null,
    items: [],
    justification: null,
    currency: null,
    retention: null,
    isComplete: false,
    applicant_name: userData.full_name,
    applicant_id: userData.id
  };

  // Convertir conversación a texto para análisis
  const conversationText = conversationHistory
    .map((msg) => msg.content)
    .join(" ");

  // Buscar almacén mencionado
  const storePatterns = [
    /almacén[:\s]+([^\n,.?!]+)/i,
    /obra[:\s]+([^\n,.?!]+)/i,
  ];
  
  for (const pattern of storePatterns) {
    const match = conversationText.match(pattern);
    if (match && match[1]) {
      const storeName = match[1].trim();
      if (storeName.length >= 3) {
        extracted.store_name = storeName;
        // Buscar coincidencia en BD
        const matchingStore = stores.find(s => 
          s.name.toLowerCase().includes(storeName.toLowerCase()) ||
          storeName.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matchingStore) {
          extracted.store_id = matchingStore.id;
        }
        break;
      }
    }
  }

  // Buscar moneda
  if (conversationText.match(/\b(MXN|pesos?|mexicanos?)\b/i)) {
    extracted.currency = 'MXN';
  } else if (conversationText.match(/\b(USD|dólares?)\b/i)) {
    extracted.currency = 'USD';
  }

  // Buscar justificación
  const justificationPatterns = [
    /justificación[:\s]+(.+?)(?:\n|\.|\?|$)/i,
    /motivo[:\s]+(.+?)(?:\n|\.|\?|$)/i,
  ];
  
  for (const pattern of justificationPatterns) {
    const match = conversationText.match(pattern);
    if (match && match[1] && match[1].trim().length >= 10) {
      extracted.justification = match[1].trim();
      break;
    }
  }

  // Buscar retención
  const retentionMatch = conversationText.match(/retención[:\s]+([^\n,.?!]+)/i);
  if (retentionMatch) {
    extracted.retention = retentionMatch[1].trim();
  }

  // Nota: El parsing de items es complejo con regex, por lo que la IA del chatbot
  // debe estructurar mejor la conversación. Por ahora dejamos items vacío
  // y confiamos en que el formulario manual sea la opción principal

  // Validación estricta de isComplete
  const hasValidApplicant = true;
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

  extracted.isComplete = hasValidApplicant && 
                        hasValidStore && 
                        hasValidJustification && 
                        hasValidCurrency &&
                        hasValidItems;

  return extracted;
}

