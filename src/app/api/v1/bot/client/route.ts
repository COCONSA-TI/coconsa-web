import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatbotMessageSchema } from "@/lib/schemas";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Obtiene los proyectos asignados a un usuario desde la base de datos
 */
async function getUserProjects(userId: string) {
  try {
    // Consultar proyectos vinculados al usuario
    const { data: userProjectLinks, error: linkError } = await supabaseAdmin
      .from('user_projects')
      .select('project_id')
      .eq('user_id', userId);

    if (linkError) {
      console.error('Error consultando user_projects:', linkError);
      return {};
    }

    if (!userProjectLinks || userProjectLinks.length === 0) {
      return {};
    }

    // Obtener los IDs de proyectos
    const projectIds = userProjectLinks.map(link => link.project_id);

    // Consultar proyectos con todas sus relaciones
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        project_financials (*),
        project_supervisors (*),
        project_contacts (*),
        project_milestones (*),
        project_updates (*)
      `)
      .in('id', projectIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo proyectos:', error);
      return {};
    }

    if (!projects || projects.length === 0) {
      return {};
    }

    // Transformar al formato esperado por el chatbot
    const formattedProjects: Record<string, any> = {};
    
    projects.forEach((project: any) => {
      const projectId = project.project_id;
      formattedProjects[projectId] = {
        projectId,
        projectName: project.project_name,
        client: project.client,
        status: project.status,
        startDate: project.start_date,
        estimatedEndDate: project.estimated_end_date,
        physicalProgress: project.physical_progress,
        financialProgress: project.project_financials?.[0] ? {
          totalBudget: Number(project.project_financials[0].total_budget),
          currency: project.project_financials[0].currency,
          spent: Number(project.project_financials[0].spent),
          percentage: project.project_financials[0].percentage,
          lastUpdate: project.project_financials[0].last_update
        } : {
          totalBudget: 0,
          currency: 'MXN',
          spent: 0,
          percentage: 0,
          lastUpdate: new Date().toISOString().split('T')[0]
        },
        supervisor: project.project_supervisors?.[0] ? {
          name: project.project_supervisors[0].name,
          phone: project.project_supervisors[0].phone,
          email: project.project_supervisors[0].email,
          position: project.project_supervisors[0].position
        } : {
          name: 'No asignado',
          phone: '',
          email: '',
          position: ''
        },
        contacts: project.project_contacts?.map((c: any) => ({
          name: c.name,
          role: c.role,
          phone: c.phone,
          email: c.email
        })) || [],
        milestones: project.project_milestones
          ?.sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((m: any) => ({
            name: m.name,
            status: m.status,
            progress: m.progress,
            date: m.date
          })) || [],
        recentUpdates: project.project_updates
          ?.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((u: any) => ({
            date: u.date,
            title: u.title,
            description: u.description
          })) || []
      };
    });

    return formattedProjects;
  } catch (error) {
    console.error('Error en getUserProjects:', error);
    return {};
  }
}

/**
 * Genera el prompt del sistema dinámicamente con los proyectos del usuario
 */
function generateSystemPrompt(projects: Record<string, any>): string {
  const projectsList = Object.values(projects).length > 0
    ? Object.values(projects).map((p: any) => `- ${p.projectId}: ${p.projectName} (Cliente: ${p.client})`).join('\n')
    : 'No tienes proyectos asignados actualmente.';

  return `Eres un asistente virtual profesional de COCONSA, especializado en atención a clientes y reportes de obra.

Tu objetivo es ayudar a los clientes a consultar información sobre sus proyectos de construcción de manera clara, natural y conversacional.

INFORMACIÓN DISPONIBLE PARA CONSULTAR:
1. Avances Físicos: Porcentaje de avance general y por hitos
2. Avances Financieros: Presupuesto total, gasto ejecutado, porcentaje de avance
3. Supervisor de Obra: Nombre, contacto y posición del supervisor asignado
4. Contactos del Proyecto: Lista de personal clave con sus roles y datos de contacto
5. Actualizaciones Recientes: Últimos avances y novedades del proyecto
6. Información General: Fechas de inicio/fin, estado del proyecto, hitos principales

PROYECTOS DISPONIBLES:
${projectsList}

INSTRUCCIONES IMPORTANTES:
1. Habla de manera natural y conversacional, como un profesional amable
2. NO uses asteriscos dobles (**) para resaltar texto - escribe de forma natural
3. Presenta la información de manera clara, usando saltos de línea para organizar
4. Usa emojis sutiles solo para categorizar información (📊 💰 👷 📞 📅 📰)
5. Cuando des números o datos importantes, simplemente menciónalos en la conversación
6. Mantén un tono profesional pero cercano, como si hablaras en persona
7. Si el cliente necesita más detalles, ofrece ayudar con otras áreas

FORMATO DE RESPUESTAS (sin asteriscos para resaltar):
- Escribe de forma natural y conversacional
- Usa saltos de línea para separar ideas
- Los emojis solo para identificar categorías, no en exceso
- Presenta números de forma directa: "El avance físico es del 65%" en lugar de "**Avance: 65%**"
- Organiza la información en bloques cortos y fáciles de leer

EJEMPLOS DE BUENAS RESPUESTAS:

Ejemplo 1 (Saludo):
"¡Hola! Soy tu asistente de COCONSA. ¿Sobre qué proyecto deseas consultar información?

Tienes acceso a:
- PROY-001: Construcción Planta Industrial Querétaro
- PROY-002: Remodelación Centro Comercial Guadalajara"

Ejemplo 2 (Avances):
"📊 Avance Físico - Construcción Planta Industrial Querétaro

El avance general del proyecto es del 65%.

Estado de los principales hitos:

✅ Cimentación - 100% (Completado el 15 de agosto)
✅ Estructura Metálica - 100% (Completado el 20 de octubre)
🔨 Muros y Cerramientos - 75% (En proceso, finaliza el 15 de diciembre)
🔨 Instalaciones Eléctricas - 45% (En proceso)
⏳ Acabados - Pendiente de iniciar

El proyecto avanza según lo programado. ¿Te gustaría conocer algún detalle específico?"

Ejemplo 3 (Información financiera):
"💰 Avance Financiero del Proyecto

Presupuesto total: $15,000,000 MXN
Ejecutado a la fecha: $9,750,000 MXN
Disponible: $5,250,000 MXN

Esto representa un avance del 65%, que está perfectamente alineado con el avance físico. El proyecto se mantiene dentro del presupuesto establecido.

Última actualización: 25 de noviembre de 2024"

REGLA DE ORO: Escribe como si estuvieras explicando la información en persona. Sin asteriscos para resaltar, sin formato excesivo. Natural y profesional.

NO inventes información. Solo usa los datos proporcionados en el contexto del proyecto.`;
}

// Mock de datos de proyectos (mantener para referencia/desarrollo)
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

export async function POST(request: Request) {
  try {
    // Verificar autenticación
    const { error: authError, session } = await requireAuth();
    if (authError || !session) {
      return NextResponse.json(
        { error: "No autenticado. Debes iniciar sesión para acceder al chatbot." },
        { status: 401 }
      );
    }

    const body = await request.json();
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

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY no está configurada");
      return NextResponse.json(
        { error: "Configuración del servidor incompleta" },
        { status: 500 }
      );
    }

    // Obtener proyectos del usuario desde la base de datos
    const userProjects = await getUserProjects(session.userId);

    // Si el usuario no tiene proyectos asignados
    if (Object.keys(userProjects).length === 0) {
      const noProjectsMessage = "Lo siento, actualmente no tienes proyectos asignados en el sistema. Por favor, contacta al administrador para que te asigne acceso a tus proyectos.";
      return NextResponse.json({
        success: true,
        message: noProjectsMessage,
        detectedProject: null,
        availableProjects: [],
        conversationHistory: [
          ...conversationHistory,
          { role: "user", content: message },
          { role: "assistant", content: noProjectsMessage },
        ],
      });
    }

    const detectedProject = detectProject(message, conversationHistory, userProjects);
    
    let projectContext = "";
    if (detectedProject) {
      const project = userProjects[detectedProject];
      projectContext = `\n\nCONTEXTO DEL PROYECTO ACTUAL:\n${JSON.stringify(project, null, 2)}`;
    }

    const systemPrompt = generateSystemPrompt(userProjects);

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const history = [
      {
        role: "user",
        parts: [{ text: systemPrompt + projectContext }],
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

    const chat = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(message);
    const response = result.response;
    const botMessage = response.text();

    return NextResponse.json({
      success: true,
      message: botMessage,
      detectedProject,
      availableProjects: Object.keys(userProjects),
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

function detectProject(
  message: string, 
  conversationHistory: Array<{ role: string; content: string }>,
  userProjects: Record<string, any>
): string | null {
  const allMessages = [
    ...conversationHistory.map(m => m.content),
    message
  ].join(" ").toLowerCase();

  for (const projectId of Object.keys(userProjects)) {
    if (allMessages.includes(projectId.toLowerCase())) {
      return projectId;
    }
  }

  for (const [projectId, project] of Object.entries(userProjects)) {
    const projectNameLower = project.projectName.toLowerCase();
    const keywords = projectNameLower.split(" ");

    const matches = keywords.filter((keyword: string) => 
      keyword.length > 3 && allMessages.includes(keyword)
    );
    
    if (matches.length >= 2) {
      return projectId;
    }
  }

  return null;
}

export async function GET(request: Request) {
  try {
    // Verificar autenticación
    const { error: authError, session } = await requireAuth();
    if (authError || !session) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Obtener proyectos del usuario desde la base de datos
    const userProjects = await getUserProjects(session.userId);

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (projectId && userProjects[projectId]) {
      return NextResponse.json({
        success: true,
        project: userProjects[projectId]
      });
    }

    return NextResponse.json({
      success: true,
      availableProjects: Object.keys(userProjects),
      projects: userProjects
    });

  } catch (error) {
    console.error("Error en GET /api/v1/bot/client:", error);
    return NextResponse.json(
      { error: "Error al obtener proyectos" },
      { status: 500 }
    );
  }
}
