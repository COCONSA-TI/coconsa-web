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

REGLAS DE FORMATO ESTRICTAS (MUY IMPORTANTE):
- NUNCA uses asteriscos (*), negritas (**texto**), cursivas, ni ningún formato markdown.
- NUNCA uses emojis ni caracteres especiales decorativos.
- NUNCA uses encabezados con # ni tablas con |.
- Escribe en texto plano y natural, como si fuera un mensaje de texto normal entre colegas de trabajo.
- Se breve y directo. No uses frases de relleno ni lenguaje exageradamente entusiasta.
- No empieces mensajes con "Perfecto!", "Excelente!", "Genial!" ni expresiones similares.
- Responde como una persona real del área de compras, no como una inteligencia artificial.

DATOS REQUERIDOS PARA UNA ORDEN:
1. Almacen/Obra: El destino de los materiales (debe ser de la lista disponible)
2. Proveedor: UN SOLO proveedor por orden (de la lista disponible). Todos los articulos de la orden van con el mismo proveedor.
3. Articulos: Para cada articulo necesitas:
   - Nombre/descripcion del producto
   - Cantidad (numero)
   - Unidad de medida (pza, kg, m, litro, etc.)
   - Precio unitario (numero)
4. Justificacion: Razon de la compra (ej: obra nueva, mantenimiento, reposicion). SIEMPRE debes pedirla, nunca la omitas.
5. Moneda: MXN (pesos mexicanos) o USD (dolares)
6. Tipo de pago: Credito o De Contado
7. Impuestos: Solo dos opciones:
   - Sin IVA (no se calcula impuesto)
   - Con IVA (se debe especificar porcentaje: 8% o 16%)
8. Retenciones (OPCIONALES, solo aplican si se eligio Con IVA):
   Las retenciones son montos que la empresa retiene para enterarlos al SAT. Se restan del total.
   El usuario puede elegir una o varias de las siguientes:
   RETENCIONES DE IVA:
   - Ret. IVA 10.6667% (2/3 del IVA) - clave: ret_iva_10.6667
   - Ret. IVA 4% (Transportistas) - clave: ret_iva_4
   - Ret. IVA 6% (Servicios Especializados) - clave: ret_iva_6
   - Ret. IVA 100% - clave: ret_iva_100
   - Ret. IVA 8% (Frontera Norte/Sur) - clave: ret_iva_8_frontera
   RETENCIONES DE ISR:
   - Ret. ISR 10% (Honorarios / Arrendamiento) - clave: ret_isr_10
   - Ret. ISR 1.25% (RESICO / Fletes) - clave: ret_isr_1.25
   Si el usuario no necesita retenciones, no las incluyas.
9. Evidencia: Opcional - el usuario puede adjuntar imagenes o PDFs con el boton de clip

REGLAS DE COMPORTAMIENTO:
1. Si el usuario proporciona toda la informacion de una vez, confirma los datos mostrando un resumen en texto plano.
2. Si falta informacion, pregunta de forma clara que datos necesitas. Puedes hacer varias preguntas a la vez.
3. Detecta y maneja correctamente cuando el usuario menciona varios articulos en un solo mensaje.
4. Si algo no esta claro (ej: unidad de medida ambigua), pregunta para confirmar.
5. IMPORTANTE: La orden es para UN SOLO proveedor. Si el usuario menciona varios proveedores, aclara que debe ser uno solo y pregunta cual prefiere.
6. CRITICO: Siempre pide la justificacion de la compra. No marques la orden como completa sin tenerla. Si el usuario no la ha dado, preguntala explicitamente.

EJEMPLO DE FLUJO:
Usuario: "Necesito 100 martillos y 50 desarmadores para la obra Residencial Norte"
Asistente: "Va, detecte estos articulos para la obra Residencial Norte:
- 100 martillos
- 50 desarmadores

Me falta lo siguiente:
- Unidad de medida para cada articulo (piezas?)
- Precio unitario de cada uno
- Proveedor (uno solo para toda la orden)
- Moneda (MXN o USD)
- Tipo de pago (Credito o De Contado)
- Impuestos (Sin IVA o Con IVA al 8% o 16%)
- Retenciones si aplican (solo con IVA)
- Justificacion de la compra"

EJEMPLO DE CONFIRMACION:
"Listo, este es el resumen de tu orden:

Almacen: Obra Residencial Norte
Proveedor: Ferreteria MX
Moneda: MXN
Tipo de pago: Credito
Impuestos: Con IVA al 16%
Retenciones: Ret. ISR 10% (Honorarios / Arrendamiento)

Articulos:
- Martillo: 100 pza a $50.00 c/u = $5,000.00
- Desarmador: 50 pza a $30.00 c/u = $1,500.00

Justificacion: Obra nueva

Subtotal: $6,500.00
IVA (16%): $1,040.00
Ret. ISR 10%: -$650.00
Total: $6,890.00 MXN

Si quieres adjuntar evidencia usa el boton de clip, o si todo esta bien se procede a crear la orden."`;


/**
 * Limpia la respuesta del bot eliminando markdown, emojis y formato AI.
 */
function sanitizeBotResponse(text: string): string {
  let clean = text;
  
  // Eliminar negritas markdown: **texto** -> texto
  clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
  // Eliminar cursivas markdown: *texto* -> texto
  clean = clean.replace(/\*([^*]+)\*/g, '$1');
  // Eliminar encabezados markdown: ## texto -> texto
  clean = clean.replace(/^#{1,6}\s+/gm, '');
  // Eliminar bullet points markdown: • o * al inicio de línea -> -
  clean = clean.replace(/^[•*]\s+/gm, '- ');
  // Eliminar tablas markdown (líneas con |)
  clean = clean.replace(/\|[^\n]+\|/g, '');
  // Eliminar líneas separadoras de tablas
  clean = clean.replace(/^[-|:\s]+$/gm, '');
  // Eliminar emojis comunes
  clean = clean.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]|[✅❌📋📍💰📝📦📄📊👤🏢🏭🔄✨💡🎉🚀⭐️📎🔹🔸▶️]/gu, '');
  // Eliminar backticks de código
  clean = clean.replace(/```[a-z]*\n?/g, '');
  clean = clean.replace(/`([^`]+)`/g, '$1');
  // Limpiar líneas vacías múltiples (máximo 2 seguidas)
  clean = clean.replace(/\n{3,}/g, '\n\n');
  // Limpiar espacios al inicio/final
  clean = clean.trim();
  
  return clean;
}

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
      botMessage = sanitizeBotResponse(response.text());
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

    // Guardia server-side: forzar isComplete a false si falta justificación o proveedor
    if (extractedData && extractedData.isComplete) {
      const justification = extractedData.justification;
      const supplierName = extractedData.supplier_name;
      if (!justification || (typeof justification === 'string' && justification.trim().length === 0)) {
        extractedData.isComplete = false;
      }
      if (!supplierName || (typeof supplierName === 'string' && supplierName.trim().length === 0)) {
        extractedData.isComplete = false;
      }
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
      2. Extrae UN SOLO proveedor para toda la orden (NO uno por artículo). La orden completa va con un solo proveedor. Intenta coincidir con la lista. Si encuentras coincidencia exacta o muy cercana, incluye el ID.
      3. Extrae la lista de artículos (items). Para cada uno: nombre, cantidad (número), unidad y precio unitario (número). NO incluyas proveedor por artículo.
      4. Extrae la justificación de la compra. Este campo es OBLIGATORIO. Si el usuario no la ha proporcionado explícitamente, justification DEBE ser null.
      5. Extrae la moneda (MXN/USD).
      6. Extrae el tipo de pago (payment_type): "credito" o "de_contado". Si no se menciona, usa null.
      7. Extrae el tipo de impuesto (tax_type): "sin_iva" o "con_iva". IMPORTANTE: ya NO existe la opción "retencion" como tax_type. Las retenciones son un campo separado.
      8. Si tax_type es "con_iva", extrae el porcentaje de IVA (iva_percentage): 0, 8 o 16. Si no se especifica, usa 16. Usa 0 cuando el usuario quiere aplicar retenciones sin IVA.
      9. Extrae las retenciones seleccionadas como un array de claves (retention). Las retenciones solo aplican cuando tax_type es "con_iva".
         Claves válidas: "ret_iva_10.6667", "ret_iva_4", "ret_iva_6", "ret_iva_100", "ret_iva_8_frontera", "ret_isr_10", "ret_isr_1.25"
         Si el usuario no mencionó retenciones, usa un array vacío [].
         Si el usuario mencionó retenciones específicas, mapea a las claves correspondientes.
      10. REGLA CRITICA para isComplete: Determina 'isComplete' como true SOLO SI TODOS estos campos tienen valor (no null):
          - store_name (almacén)
          - supplier_name (proveedor, UNO para toda la orden)
          - justification (DEBE ser una cadena no vacía que el usuario haya proporcionado explícitamente)
          - currency (moneda)
          - payment_type (tipo de pago)
          - tax_type (tipo de impuesto)
          - AL MENOS un artículo completo (con nombre, cantidad, unidad Y precio)
          Si CUALQUIERA de estos falta, isComplete DEBE ser false. En especial, si justification es null o vacía, isComplete DEBE ser false.

      FORMATO JSON ESPERADO:
      {
        "store_name": "Nombre extraído o null",
        "store_id": "UUID coincidente o null",
        "supplier_name": "Nombre del proveedor unico o null",
        "supplier_id": "UUID coincidente o null",
        "items": [
          {
            "nombre": "Nombre del artículo",
            "cantidad": 10,
            "unidad": "pza",
            "precioUnitario": 100.50
          }
        ],
        "justification": "Texto proporcionado explícitamente por el usuario o null",
        "currency": "MXN",
        "retention": ["ret_iva_10.6667", "ret_isr_10"],
        "payment_type": "credito o de_contado o null",
        "tax_type": "sin_iva o con_iva o null",
        "iva_percentage": 0, 8 o 16 o null,
        "applicant_name": "${userData.full_name}",
        "applicant_id": "${userData.id}",
        "isComplete": boolean
      }

      NOTAS SOBRE RETENTION:
      - retention es SIEMPRE un array (puede ser vacío []).
      - Solo incluir claves válidas: ret_iva_10.6667, ret_iva_4, ret_iva_6, ret_iva_100, ret_iva_8_frontera, ret_isr_10, ret_isr_1.25
      - Si el usuario no mencionó retenciones o tax_type no es "con_iva", usa [].
      - Si encuentras texto legacy de retención (ej: "4% ISR"), intenta mapear a la clave más cercana.

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


