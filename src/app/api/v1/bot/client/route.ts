import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatbotMessageSchema } from "@/lib/schemas";

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Mock de datos de proyectos para los clientes
const MOCK_PROJECTS = {
  "PROY-001": {
    projectId: "PROY-001",
    projectName: "Construcción Planta Industrial Querétaro",
    client: "Industrias XYZ S.A. de C.V.",
    status: "En Proceso",
    startDate: "2024-06-01",
    estimatedEndDate: "2025-03-31",
    physicalProgress: 65,
    financialProgress: {
      totalBudget: 15000000,
      currency: "MXN",
      spent: 9750000,
      percentage: 65,
      lastUpdate: "2024-11-25"
    },
    supervisor: {
      name: "Ing. Carlos Ramírez González",
      phone: "+52 442 123 4567",
      email: "carlos.ramirez@coconsa.com",
      position: "Supervisor de Obra"
    },
    contacts: [
      {
        name: "Ing. María Elena Torres",
        role: "Gerente de Proyecto",
        phone: "+52 442 234 5678",
        email: "maria.torres@coconsa.com"
      },
      {
        name: "Arq. Roberto Mendoza",
        role: "Coordinador de Arquitectura",
        phone: "+52 442 345 6789",
        email: "roberto.mendoza@coconsa.com"
      }
    ],
    milestones: [
      { name: "Cimentación", status: "Completado", progress: 100, date: "2024-08-15" },
      { name: "Estructura Metálica", status: "Completado", progress: 100, date: "2024-10-20" },
      { name: "Muros y Cerramientos", status: "En Proceso", progress: 75, date: "2024-12-15" },
      { name: "Instalaciones Eléctricas", status: "En Proceso", progress: 45, date: "2025-01-30" },
      { name: "Acabados", status: "Pendiente", progress: 0, date: "2025-02-28" }
    ],
    recentUpdates: [
      {
        date: "2024-11-28",
        title: "Avance en Cerramientos",
        description: "Se completó el 75% de muros perimetrales. Se iniciaron trabajos de instalación de ventanería."
      },
      {
        date: "2024-11-20",
        title: "Instalaciones Hidráulicas",
        description: "Finalización de red hidráulica principal. Pruebas de presión exitosas."
      }
    ]
  },
  "PROY-002": {
    projectId: "PROY-002",
    projectName: "Remodelación Centro Comercial Guadalajara",
    client: "Grupo Comercial del Bajío",
    status: "En Proceso",
    startDate: "2024-08-15",
    estimatedEndDate: "2025-02-28",
    physicalProgress: 42,
    financialProgress: {
      totalBudget: 8500000,
      currency: "MXN",
      spent: 3570000,
      percentage: 42,
      lastUpdate: "2024-11-25"
    },
    supervisor: {
      name: "Ing. Ana Patricia Guzmán",
      phone: "+52 33 987 6543",
      email: "ana.guzman@coconsa.com",
      position: "Supervisora de Obra"
    },
    contacts: [
      {
        name: "Arq. Luis Fernando Castro",
        role: "Director de Proyecto",
        phone: "+52 33 876 5432",
        email: "luis.castro@coconsa.com"
      }
    ],
    milestones: [
      { name: "Demolición y Preparación", status: "Completado", progress: 100, date: "2024-09-10" },
      { name: "Remodelación Áreas Comunes", status: "En Proceso", progress: 60, date: "2024-12-20" },
      { name: "Locales Comerciales", status: "En Proceso", progress: 30, date: "2025-01-31" },
      { name: "Acabados Finales", status: "Pendiente", progress: 0, date: "2025-02-28" }
    ],
    recentUpdates: [
      {
        date: "2024-11-26",
        title: "Avance Áreas Comunes",
        description: "Se completó instalación de pisos y se inició colocación de plafones decorativos."
      }
    ]
  }
};

// Prompt del sistema para el asistente de clientes
const SYSTEM_PROMPT = `Eres un asistente virtual profesional de COCONSA, especializado en atención a clientes y reportes de obra.

Tu objetivo es ayudar a los clientes a consultar información sobre sus proyectos de construcción de manera clara y profesional.

INFORMACIÓN DISPONIBLE PARA CONSULTAR:
1. **Avances Físicos**: Porcentaje de avance general y por hitos (milestones)
2. **Avances Financieros**: Presupuesto total, gasto ejecutado, porcentaje de avance financiero
3. **Supervisor de Obra**: Nombre, contacto y posición del supervisor asignado
4. **Contactos del Proyecto**: Lista de personal clave con sus roles y datos de contacto
5. **Actualizaciones Recientes**: Últimos avances y novedades del proyecto
6. **Información General**: Fechas de inicio/fin, estado del proyecto, hitos principales

PROYECTOS DISPONIBLES:
${Object.values(MOCK_PROJECTS).map(p => `- ${p.projectId}: ${p.projectName} (Cliente: ${p.client})`).join('\n')}

INSTRUCCIONES IMPORTANTES:
1. Saluda de manera profesional y pregunta sobre qué proyecto desea información
2. Si el cliente menciona un proyecto válido, pregunta qué información específica necesita
3. Presenta la información de manera clara y organizada
4. Usa formato legible con saltos de línea cuando sea necesario
5. Si el cliente hace una pregunta general, proporciona un resumen completo
6. Siempre mantén un tono profesional pero amigable
7. Si el cliente necesita más detalles o aclaraciones, ofrece profundizar
8. Puedes responder preguntas sobre aspectos específicos del proyecto

FORMATO DE RESPUESTAS:
- Usa emojis sutiles para hacer la información más visual (📊 💰 👷 📞 📅)
- Organiza la información en párrafos cortos
- Resalta números importantes
- Incluye contexto cuando sea relevante

EJEMPLOS DE BUENAS RESPUESTAS:
- "¡Hola! Soy tu asistente de COCONSA. ¿Sobre qué proyecto deseas consultar información?"
- "Perfecto, te puedo ayudar con información sobre: avances físicos, avances financieros, supervisor, contactos, o un resumen general. ¿Qué te gustaría saber?"
- "📊 **Avance Físico General**: 65%\n\nEl proyecto va según lo planeado. Actualmente estamos trabajando en..."

NO inventes información. Solo usa los datos proporcionados en el contexto del proyecto.`;

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

    // Detectar qué proyecto está consultando el cliente
    const detectedProject = detectProject(message, conversationHistory);
    
    // Construir contexto del proyecto
    let projectContext = "";
    if (detectedProject) {
      const project = MOCK_PROJECTS[detectedProject as keyof typeof MOCK_PROJECTS];
      projectContext = `\n\nCONTEXTO DEL PROYECTO ACTUAL:\n${JSON.stringify(project, null, 2)}`;
    }

    // Obtener el modelo
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Construir el historial de conversación
    const history = [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT + projectContext }],
      },
      {
        role: "model",
        parts: [{ text: "Entendido. Actuaré como asistente profesional de COCONSA para ayudar a los clientes con información sobre sus proyectos de construcción de manera clara y precisa." }],
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
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });

    // Enviar el mensaje del usuario
    const result = await chat.sendMessage(message);
    const response = result.response;
    const botMessage = response.text();

    return NextResponse.json({
      success: true,
      message: botMessage,
      detectedProject,
      availableProjects: Object.keys(MOCK_PROJECTS),
      conversationHistory: [
        ...conversationHistory,
        { role: "user", content: message },
        { role: "assistant", content: botMessage },
      ],
    });

  } catch (error) {
    console.error("Error en el chatbot de clientes:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

/**
 * Detecta qué proyecto está consultando el cliente basado en el mensaje
 */
function detectProject(
  message: string, 
  conversationHistory: Array<{ role: string; content: string }>
): string | null {
  const allMessages = [
    ...conversationHistory.map(m => m.content),
    message
  ].join(" ").toLowerCase();

  // Buscar referencias directas a IDs de proyecto
  for (const projectId of Object.keys(MOCK_PROJECTS)) {
    if (allMessages.includes(projectId.toLowerCase())) {
      return projectId;
    }
  }

  // Buscar referencias a nombres de proyecto
  for (const [projectId, project] of Object.entries(MOCK_PROJECTS)) {
    const projectNameLower = project.projectName.toLowerCase();
    const keywords = projectNameLower.split(" ");
    
    // Si encuentra 2 o más palabras clave del nombre del proyecto
    const matches = keywords.filter(keyword => 
      keyword.length > 3 && allMessages.includes(keyword)
    );
    
    if (matches.length >= 2) {
      return projectId;
    }
  }

  return null;
}

/**
 * GET endpoint para obtener información de proyectos (opcional, para debugging)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (projectId && MOCK_PROJECTS[projectId as keyof typeof MOCK_PROJECTS]) {
    return NextResponse.json({
      success: true,
      project: MOCK_PROJECTS[projectId as keyof typeof MOCK_PROJECTS]
    });
  }

  return NextResponse.json({
    success: true,
    availableProjects: Object.keys(MOCK_PROJECTS),
    projects: MOCK_PROJECTS
  });
}
