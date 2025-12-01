import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatbotMessageSchema } from "@/lib/schemas";

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Prompt del sistema para el asistente
const SYSTEM_PROMPT = `Eres un asistente virtual amigable de COCONSA, una empresa líder en construcción industrial y comercial en México.

Tu objetivo es ayudar a los usuarios a crear órdenes de compra de manera conversacional y eficiente.

FLUJO DE CONVERSACIÓN:
1. SALUDO INICIAL: Pregunta al usuario qué necesita hacer (crear orden de compra, consultar estatus, etc.)
2. SI ELIGE ORDEN DE COMPRA: Recopila la siguiente información de forma natural y conversacional:

INFORMACIÓN REQUERIDA:
- Nombre del solicitante
- Almacén u obra
- Nombre del proveedor
- Artículos/servicios (nombre, cantidad, unidad, precio unitario)
- Justificación de la compra
- Moneda (MXN o USD)
- Retención (opcional)

INSTRUCCIONES IMPORTANTES:
1. Sé conversacional y amigable, no parezcas un robot
2. Pregunta de manera natural, máximo 2 campos a la vez
3. Si el usuario da información parcial, agradece y pregunta lo que falta
4. Confirma la información antes de crear la orden
5. Siempre responde en español
6. Mantén respuestas cortas (máximo 2-3 líneas)
7. Permite agregar múltiples artículos preguntando "¿Deseas agregar otro artículo?"
8. Al finalizar, confirma que se creará la orden con todos los datos

EJEMPLOS DE BUENAS RESPUESTAS:
- "¡Hola! Soy el asistente de COCONSA. ¿Qué necesitas hacer hoy? Puedo ayudarte a crear una orden de compra."
- "Perfecto, vamos a crear tu orden de compra. ¿Cuál es tu nombre?"
- "¿Para qué almacén u obra es esta compra?"
- "¿Cuál es el nombre del proveedor?"
- "Excelente. Ahora dime: ¿qué artículo o servicio necesitas? Dame el nombre y la cantidad."
- "¿Cuál es el precio unitario (sin IVA) de este artículo?"
- "¿Deseas agregar otro artículo? (sí/no)"
- "Perfecto. ¿Cuál es la justificación de esta compra?"

NO uses listas numeradas ni bullet points. Habla naturalmente.`;

export async function POST(request: Request) {
  try {
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
    const result = await chat.sendMessage(message);
    const response = result.response;
    const botMessage = response.text();

    // Extraer información estructurada de la conversación completa
    const extractedData = await extractInformation(
      [...conversationHistory, { role: "user", content: message }, { role: "assistant", content: botMessage }]
    );

    return NextResponse.json({
      success: true,
      message: botMessage,
      extractedData,
      conversationHistory: [
        ...conversationHistory,
        { role: "user", content: message },
        { role: "assistant", content: botMessage },
      ],
    });

  } catch (error) {
    console.error("Error en el chatbot:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

/**
 * Extrae información estructurada de la conversación para orden de compra
 */
async function extractInformation(conversationHistory: Array<{ role: string; content: string }>) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Crear prompt para extraer información
    const conversationText = conversationHistory
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const extractionPrompt = `Analiza la siguiente conversación y extrae SOLO la información que el usuario haya proporcionado explícitamente para crear una orden de compra. Si no mencionó algo, déjalo como null.

Conversación:
${conversationText}

Extrae y devuelve SOLO un objeto JSON con esta estructura (sin texto adicional, sin markdown, solo el JSON):
{
  "applicant_name": "nombre del solicitante o null",
  "store_name": "nombre del almacén u obra o null",
  "supplier_name": "nombre del proveedor o null",
  "items": [
    {
      "nombre": "nombre del artículo",
      "cantidad": "cantidad numérica",
      "unidad": "unidad (pza, kg, m, etc)",
      "precioUnitario": precio_sin_iva
    }
  ],
  "justification": "justificación de la compra o null",
  "currency": "MXN o USD o null",
  "retention": "retención si la mencionó o null",
  "isComplete": true o false (true si tiene toda la info necesaria para crear la orden)
}

IMPORTANTE: 
- Solo extrae información explícitamente mencionada
- items debe ser un array, aunque esté vacío []
- isComplete debe ser true solo si tiene: applicant_name, store_name, supplier_name y al menos 1 item completo
- No inventes información
- Retorna SOLO el objeto JSON, sin explicaciones ni formato markdown`;

    const result = await model.generateContent(extractionPrompt);
    const response = result.response;
    let extractedText = response.text().trim();

    // Limpiar el texto de posibles markdown code blocks
    extractedText = extractedText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Parsear el JSON
    const extracted = JSON.parse(extractedText);

    // Limpiar valores null string a null real
    Object.keys(extracted).forEach((key) => {
      if (extracted[key] === "null" || extracted[key] === "") {
        extracted[key] = null;
      }
    });

    return extracted;
  } catch (error) {
    console.error("Error al extraer información:", error);
    // Retornar objeto vacío en caso de error
    return {
      applicant_name: null,
      store_name: null,
      supplier_name: null,
      items: [],
      justification: null,
      currency: null,
      retention: null,
      isComplete: false,
    };
  }
}

