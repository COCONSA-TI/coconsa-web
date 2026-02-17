import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatbotMessageSchema } from "@/lib/schemas";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  ApiError,
  FormattedProject,
  FormattedProjectWithMetrics,
  ProjectMetrics,
  ProjectWithRelations,
  ProjectContact,
  ProjectMilestone,
  ProjectUpdate,
} from "@/types/database";

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Configuración de Ollama (fallback local)
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

// Tipos para el sistema de LLM
type LLMProvider = "gemini" | "ollama";

interface LLMResponse {
  text: string;
  provider: LLMProvider;
}

/**
 * Verifica si el error es por tokens/cuota agotada de Gemini
 */
function isQuotaExhaustedError(error: unknown): boolean {
  const apiError = error as ApiError;
  const errorMessage = apiError?.message?.toLowerCase() || "";
  const errorStatus = apiError?.status || apiError?.code;
  
  return (
    errorMessage.includes("quota") ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("resource exhausted") ||
    errorMessage.includes("429") ||
    errorMessage.includes("exceeded") ||
    errorMessage.includes("billing") ||
    errorStatus === 429 ||
    errorStatus === "RESOURCE_EXHAUSTED"
  );
}

/**
 * Transforma los datos del proyecto a un formato humanizado para Ollama
 */
function humanizeProjectData(projects: Record<string, FormattedProjectWithMetrics>): string {
  const projectsArray = Object.values(projects);
  
  if (projectsArray.length === 0) {
    return "No hay proyectos disponibles.";
  }

  return projectsArray.map((p) => {
    const metrics = p.calculatedMetrics || {} as ProjectMetrics;
    const financial = p.financialProgress || {
      totalBudget: 0,
      currency: 'MXN' as const,
      spent: 0,
      percentage: 0,
      lastUpdate: ''
    };
    const supervisor = p.supervisor || {
      name: '',
      phone: '',
      email: '',
      position: ''
    };
    const milestones = p.milestones || [];
    const updates = p.recentUpdates || [];
    const contacts = p.contacts || [];

    // Formatear presupuesto
    const formatMoney = (amount: number, currency: string = 'MXN') => {
      return new Intl.NumberFormat('es-MX', { 
        style: 'currency', 
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    };

    // Formatear fecha
    const formatDate = (dateStr: string) => {
      if (!dateStr) return 'No especificada';
      try {
        return new Date(dateStr).toLocaleDateString('es-MX', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      } catch {
        return dateStr;
      }
    };

    // Estado del proyecto en lenguaje natural
    let estadoProyecto = "en tiempo";
    if (metrics.projectHealthStatus === "adelantado") estadoProyecto = "adelantado respecto al cronograma";
    else if (metrics.projectHealthStatus === "con retraso leve") estadoProyecto = "con un pequeño retraso";
    else if (metrics.projectHealthStatus === "con retraso significativo") estadoProyecto = "con retraso importante";

    // Construir resumen humanizado
    let resumen = `
PROYECTO: ${p.projectName}
Código: ${p.projectId}
Cliente: ${p.client}
Estado general: ${p.status}

FECHAS:
- Inicio: ${formatDate(p.startDate)}
- Fecha estimada de término: ${formatDate(p.estimatedEndDate || '')}
- Días transcurridos: ${metrics.elapsedDays || 'N/A'} días
- Días restantes: ${metrics.remainingDays || 'N/A'} días

AVANCE DE OBRA:
- Avance físico actual: ${p.physicalProgress || 0}%
- Tiempo transcurrido del proyecto: ${metrics.timeProgress || 0}%
- El proyecto va ${estadoProyecto}
${metrics.estimatedDelay > 0 ? `- Retraso estimado: ${metrics.estimatedDelay} días` : '- Sin retraso proyectado'}
${metrics.estimatedCompletionDate ? `- Al ritmo actual, terminaría el: ${formatDate(metrics.estimatedCompletionDate)}` : ''}

PRESUPUESTO:
- Presupuesto total: ${formatMoney(financial.totalBudget || 0, financial.currency)}
- Gastado hasta ahora: ${formatMoney(financial.spent || 0, financial.currency)}
- Disponible: ${formatMoney((financial.totalBudget || 0) - (financial.spent || 0), financial.currency)}
- Porcentaje ejecutado: ${financial.percentage || 0}%
- Estado del presupuesto: ${metrics.budgetStatus || 'Sin información'}

SUPERVISOR DE OBRA:
- Nombre: ${supervisor.name || 'No asignado'}
- Cargo: ${supervisor.position || 'N/A'}
- Teléfono: ${supervisor.phone || 'N/A'}
- Email: ${supervisor.email || 'N/A'}`;

    // Agregar hitos/etapas
    if (milestones.length > 0) {
      resumen += `\n\nETAPAS DEL PROYECTO:`;
      milestones.forEach((m) => {
        const estado = m.status === 'Completado' ? '✓ Completado' : 
                      m.status === 'En Proceso' ? '→ En proceso' : '○ Pendiente';
        resumen += `\n- ${m.name}: ${estado} (${m.progress}%)${m.date ? ` - Fecha: ${formatDate(m.date)}` : ''}`;
      });
    }

    // Agregar contactos adicionales
    if (contacts.length > 0) {
      resumen += `\n\nOTROS CONTACTOS:`;
      contacts.forEach((c) => {
        resumen += `\n- ${c.name} (${c.role}): ${c.phone || c.email || 'Sin contacto'}`;
      });
    }

    // Agregar últimas actualizaciones
    if (updates.length > 0) {
      resumen += `\n\nÚLTIMAS ACTUALIZACIONES:`;
      updates.slice(0, 3).forEach((u) => {
        resumen += `\n- ${formatDate(u.date)}: ${u.title}. ${u.description}`;
      });
    }

    return resumen;
  }).join('\n\n---\n');
}

/**
 * Genera un prompt optimizado para Ollama/Llama que es más directo y estructurado
 */
function generateOllamaSystemPrompt(projects: Record<string, FormattedProjectWithMetrics>, projectContext: string): string {
  const today = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Humanizar los datos del proyecto
  const humanizedData = humanizeProjectData(projects);

  return `Eres el asistente virtual de COCONSA, una empresa constructora mexicana. Ayudas a los clientes a consultar información sobre sus obras.

HOY ES: ${today}

INSTRUCCIONES:
- Responde siempre en español, de forma amable y profesional
- Usa ÚNICAMENTE la información de los proyectos que se muestra abajo
- NO menciones términos técnicos como "metrics", "data", "JSON", "campos", etc.
- Habla de forma natural: "tu proyecto lleva 65% de avance" en lugar de "physicalProgress es 65"
- Si preguntan algo que no está en los datos, di que no tienes esa información
- Sé conciso pero informativo
- Puedes usar emojis sutiles para hacer la respuesta más visual: 📊 💰 👷 📅 ✅

INFORMACIÓN DE LOS PROYECTOS DEL CLIENTE:
${humanizedData}

EJEMPLOS DE CÓMO RESPONDER:

Si preguntan "¿cómo va mi obra?":
"Tu proyecto [nombre] lleva un avance del X%. Actualmente va [adelantado/en tiempo/con retraso]. La fecha estimada de término es [fecha]."

Si preguntan "¿va atrasada mi obra?":
"Según los datos actuales, tu proyecto va [estado]. El avance físico es del X% y han transcurrido Y% del tiempo total. [Explicación adicional si hay retraso]."

Si preguntan por presupuesto:
"El presupuesto total de tu proyecto es de $X. Hasta ahora se ha ejecutado $Y, lo que representa un Z% del total. Quedan disponibles $W."

IMPORTANTE: Nunca reveles nombres de variables o estructuras de datos. Siempre traduce la información a lenguaje cotidiano.`;
}

/**
 * Llama a Ollama API (Llama 3.2 local)
 */
async function callOllama(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  // Construir el historial de mensajes para Ollama
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.3, // Más bajo para respuestas más consistentes con los datos
        num_predict: 2000,
        num_ctx: 8192, // Contexto más grande para manejar los datos del proyecto
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.message?.content || "";
}

/**
 * Llama a Gemini API
 */
async function callGemini(
  systemPrompt: string,
  projectContext: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
      maxOutputTokens: 2000,
      temperature: 0.7,
    },
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

/**
 * Sistema de failover: intenta Gemini primero, si falla usa Ollama
 */
async function getLLMResponse(
  systemPrompt: string,
  projectContext: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userMessage: string,
  userProjects: Record<string, FormattedProjectWithMetrics>
): Promise<LLMResponse> {
  // Verificar si Gemini está configurado
  const geminiConfigured = !!process.env.GEMINI_API_KEY;

  if (geminiConfigured) {
    try {
      const text = await callGemini(systemPrompt, projectContext, conversationHistory, userMessage);
      return { text, provider: "gemini" };
    } catch (error: unknown) {
      const apiError = error as ApiError;
      
      // Si es error de cuota, hacer failover a Ollama
      if (isQuotaExhaustedError(error)) {
        // Quota exhausted, falling back to Ollama
      }
      // Error in Gemini, attempting fallback to Ollama
      void apiError;
    }
  }

  // Failover a Ollama - usar prompt optimizado para modelos más pequeños
  try {
    const ollamaPrompt = generateOllamaSystemPrompt(userProjects, projectContext);
    const text = await callOllama(ollamaPrompt, conversationHistory, userMessage);
    return { text, provider: "ollama" };
  } catch (ollamaError: unknown) {
    const apiError = ollamaError as ApiError;
    throw new Error(
      `No se pudo obtener respuesta. Gemini: ${geminiConfigured ? "error/cuota" : "no configurado"}. Ollama: ${apiError.message || 'Error desconocido'}`
    );
  }
}

/**
 * Obtiene los proyectos asignados a un usuario desde la base de datos
 */
async function getUserProjects(userId: string): Promise<Record<string, FormattedProject>> {
  try {
    // Consultar proyectos vinculados al usuario
    const { data: userProjectLinks, error: linkError } = await supabaseAdmin
      .from('user_projects')
      .select('project_id')
      .eq('user_id', userId);

    if (linkError) {
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
      return {};
    }

    if (!projects || projects.length === 0) {
      return {};
    }

    // Transformar al formato esperado por el chatbot
    const formattedProjects: Record<string, FormattedProject> = {};
    
    (projects as ProjectWithRelations[]).forEach((project) => {
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
          phone: project.project_supervisors[0].phone || '',
          email: project.project_supervisors[0].email || '',
          position: project.project_supervisors[0].position
        } : {
          name: 'No asignado',
          phone: '',
          email: '',
          position: ''
        },
        contacts: project.project_contacts?.map((c: ProjectContact) => ({
          name: c.name,
          role: c.role,
          phone: c.phone,
          email: c.email
        })) || [],
        milestones: project.project_milestones
          ?.sort((a: ProjectMilestone, b: ProjectMilestone) => a.sort_order - b.sort_order)
          .map((m: ProjectMilestone) => ({
            name: m.name,
            status: m.status,
            progress: m.progress,
            date: m.date
          })) || [],
        recentUpdates: project.project_updates
          ?.sort((a: ProjectUpdate, b: ProjectUpdate) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((u: ProjectUpdate) => ({
            date: u.date,
            title: u.title,
            description: u.description
          })) || []
      };
    });

    return formattedProjects;
  } catch {
    return {};
  }
}

/**
 * Calcula métricas y predicciones para un proyecto
 */
function calculateProjectMetrics(project: FormattedProject): ProjectMetrics {
  const today = new Date();
  const startDate = new Date(project.startDate);
  const endDate = new Date(project.estimatedEndDate || project.startDate);
  
  // Días totales del proyecto
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  // Días transcurridos
  const elapsedDays = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  // Días restantes
  const remainingDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  // Porcentaje de tiempo transcurrido
  const timeProgress = Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100)));
  
  // Avance físico
  const physicalProgress = project.physicalProgress || 0;
  
  // Diferencia entre tiempo y avance (positivo = adelantado, negativo = atrasado)
  const progressDifference = physicalProgress - timeProgress;
  
  // Calcular velocidad de avance (progreso por día)
  const dailyProgressRate = elapsedDays > 0 ? physicalProgress / elapsedDays : 0;
  
  // Estimar días necesarios para completar al ritmo actual
  const remainingProgress = 100 - physicalProgress;
  const estimatedDaysToComplete = dailyProgressRate > 0 
    ? Math.ceil(remainingProgress / dailyProgressRate) 
    : Infinity;
  
  // Fecha estimada de finalización al ritmo actual
  const estimatedCompletionDate = new Date(today);
  estimatedCompletionDate.setDate(today.getDate() + estimatedDaysToComplete);
  
  // Días de retraso estimado
  const estimatedDelay = estimatedDaysToComplete - remainingDays;
  
  // Estado del proyecto
  let projectHealthStatus: string;
  let healthEmoji: string;
  if (progressDifference >= 5) {
    projectHealthStatus = "adelantado";
    healthEmoji = "🟢";
  } else if (progressDifference >= -5) {
    projectHealthStatus = "en tiempo";
    healthEmoji = "🟡";
  } else if (progressDifference >= -15) {
    projectHealthStatus = "con retraso leve";
    healthEmoji = "🟠";
  } else {
    projectHealthStatus = "con retraso significativo";
    healthEmoji = "🔴";
  }
  
  // Métricas financieras
  const financial = project.financialProgress || {};
  const budgetUsageRate = financial.totalBudget > 0 
    ? (financial.spent / financial.totalBudget) * 100 
    : 0;
  const budgetEfficiency = physicalProgress > 0 
    ? budgetUsageRate / physicalProgress 
    : 1;
  
  let budgetStatus: string;
  let budgetEmoji: string;
  if (budgetEfficiency <= 0.95) {
    budgetStatus = "por debajo del presupuesto";
    budgetEmoji = "🟢";
  } else if (budgetEfficiency <= 1.05) {
    budgetStatus = "dentro del presupuesto";
    budgetEmoji = "🟡";
  } else if (budgetEfficiency <= 1.15) {
    budgetStatus = "ligeramente sobre presupuesto";
    budgetEmoji = "🟠";
  } else {
    budgetStatus = "significativamente sobre presupuesto";
    budgetEmoji = "🔴";
  }
  
  // Calcular hitos atrasados
  const milestones = project.milestones || [];
  type FormattedMilestone = FormattedProject['milestones'][number];
  const delayedMilestones = milestones.filter((m: FormattedMilestone) => {
    if (m.status === "Completado") return false;
    if (!m.date) return false;
    const milestoneDate = new Date(m.date);
    return milestoneDate < today && m.progress < 100;
  });
  
  // Próximos hitos (pendientes o en proceso)
  const upcomingMilestones = milestones
    .filter((m: FormattedMilestone) => m.status !== "Completado")
    .sort((a: FormattedMilestone, b: FormattedMilestone) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
  
  return {
    // Métricas de tiempo
    totalDays,
    elapsedDays,
    remainingDays,
    timeProgress,
    
    // Métricas de avance
    physicalProgress,
    progressDifference,
    dailyProgressRate: dailyProgressRate.toFixed(2),
    
    // Predicciones
    estimatedDaysToComplete,
    estimatedCompletionDate: estimatedCompletionDate.toISOString().split('T')[0],
    estimatedDelay: estimatedDelay > 0 ? estimatedDelay : 0,
    
    // Estado de salud
    projectHealthStatus,
    healthEmoji,
    
    // Métricas financieras
    budgetUsageRate: budgetUsageRate.toFixed(1),
    budgetEfficiency: budgetEfficiency.toFixed(2),
    budgetStatus,
    budgetEmoji,
    budgetRemaining: financial.totalBudget - financial.spent,
    
    // Hitos
    delayedMilestones: delayedMilestones.length,
    delayedMilestonesList: delayedMilestones,
    upcomingMilestones: upcomingMilestones.slice(0, 3),
    totalMilestones: milestones.length,
    completedMilestones: milestones.filter((m: FormattedMilestone) => m.status === "Completado").length
  };
}

/**
 * Genera el prompt del sistema dinámicamente con los proyectos del usuario
 */
function generateSystemPrompt(projects: Record<string, FormattedProject>): string {
  const projectsList = Object.values(projects).length > 0
    ? Object.values(projects).map((p) => `- ${p.projectId}: ${p.projectName} (Cliente: ${p.client})`).join('\n')
    : 'No tienes proyectos asignados actualmente.';

  const today = new Date().toLocaleDateString('es-MX', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return `Eres un asistente virtual profesional de COCONSA, especializado en atención a clientes, análisis de proyectos y reportes de obra.

Tu objetivo es ayudar a los clientes a consultar información, obtener análisis detallados y predicciones sobre sus proyectos de construcción.

FECHA ACTUAL: ${today}

CAPACIDADES DE ANÁLISIS Y PREDICCIÓN:
Puedes responder preguntas complejas como:
- "¿Va atrasada mi obra?" - Analiza tiempo vs avance físico
- "¿Cuándo terminará mi proyecto?" - Estima fecha basada en ritmo actual
- "¿Cómo va el presupuesto?" - Analiza eficiencia presupuestal
- "Compara mis proyectos" - Compara métricas entre proyectos
- "¿Cuál proyecto va mejor?" - Ranking de salud de proyectos
- "Dame estadísticas de mi obra" - Resumen ejecutivo con métricas
- "¿Hay riesgo de retraso?" - Evaluación de riesgos

INFORMACIÓN DISPONIBLE PARA CONSULTAR:
1. Avances Físicos: Porcentaje de avance general y por hitos
2. Avances Financieros: Presupuesto total, gasto ejecutado, porcentaje de avance
3. Análisis Temporal: Días transcurridos, restantes, ritmo de avance
4. Predicciones: Fecha estimada de término, días de retraso proyectado
5. Comparativas: Entre proyectos del mismo cliente
6. Estado de Salud: Indicadores de proyecto adelantado/en tiempo/atrasado
7. Supervisor y Contactos: Información del equipo asignado
8. Hitos y Actualizaciones: Progreso detallado y noticias recientes

PROYECTOS DISPONIBLES:
${projectsList}

CÓMO ANALIZAR PREGUNTAS SOBRE RETRASOS:
Cuando el cliente pregunte si su obra va atrasada:
1. Compara el porcentaje de tiempo transcurrido vs avance físico
2. Si avance físico < tiempo transcurrido = ATRASADO
3. Si avance físico >= tiempo transcurrido = EN TIEMPO o ADELANTADO
4. Usa las métricas calculadas en el contexto (progressDifference, projectHealthStatus)
5. Proporciona la estimación de fecha de término al ritmo actual

CÓMO HACER PREDICCIONES:
- Usa el ritmo diario de avance (dailyProgressRate) para estimar tiempos
- Considera los hitos atrasados (delayedMilestones) como factor de riesgo
- La fecha estimada de finalización (estimatedCompletionDate) se calcula automáticamente
- Si hay retraso significativo, sugiere contactar al supervisor

CÓMO COMPARAR PROYECTOS:
Cuando tengas múltiples proyectos, puedes:
- Comparar avances físicos y financieros
- Identificar cuál va mejor/peor en tiempo
- Comparar eficiencia presupuestal
- Crear ranking de salud de proyectos

INDICADORES DE SALUD:
🟢 Adelantado: Avance > Tiempo transcurrido (+5% o más)
🟡 En tiempo: Diferencia entre -5% y +5%
🟠 Retraso leve: Diferencia entre -5% y -15%
🔴 Retraso significativo: Diferencia mayor a -15%

INDICADORES DE PRESUPUESTO:
🟢 Por debajo del presupuesto (eficiencia < 0.95)
🟡 Dentro del presupuesto (eficiencia 0.95 - 1.05)
🟠 Ligeramente sobre presupuesto (eficiencia 1.05 - 1.15)
🔴 Significativamente sobre presupuesto (eficiencia > 1.15)

INSTRUCCIONES DE COMUNICACIÓN:
1. Habla de manera natural y conversacional
2. NO uses asteriscos dobles (**) para resaltar texto
3. Presenta datos de forma clara con saltos de línea
4. Usa emojis sutiles para categorizar (📊 💰 👷 📞 📅 📰 ⏰ 📈 🎯)
5. Sé honesto sobre el estado del proyecto, incluso si hay problemas
6. Ofrece contexto y recomendaciones cuando haya alertas
7. Si no puedes calcular algo, explica qué datos faltan

EJEMPLOS DE RESPUESTAS ANALÍTICAS:

Ejemplo 1 (Pregunta sobre retraso):
Usuario: "¿Va atrasada mi obra?"
Respuesta:
"📊 Análisis del Proyecto - Planta Industrial Querétaro

Basándome en los datos actuales, tu proyecto presenta un retraso leve.

Estado actual:
- Avance físico: 65%
- Tiempo transcurrido: 72% del plazo total
- Diferencia: -7 puntos porcentuales

🟠 El proyecto está ligeramente por detrás de lo programado.

Al ritmo actual de avance (0.9% diario), la fecha estimada de finalización sería el 15 de abril de 2025, lo que representa aproximadamente 15 días después de la fecha programada.

Recomendación: Te sugiero comunicarte con el Ing. Carlos Ramírez (supervisor) para revisar el plan de recuperación. Su teléfono es +52 442 123 4567."

Ejemplo 2 (Comparación de proyectos):
Usuario: "Compara mis dos proyectos"
Respuesta:
"📈 Comparativa de Proyectos

PROY-001 - Planta Industrial Querétaro
🟠 Retraso leve | Avance: 65% | Presupuesto: 🟢 Eficiente
Tiempo restante: 85 días

PROY-002 - Centro Comercial Guadalajara  
🟢 Adelantado | Avance: 42% | Presupuesto: 🟡 En línea
Tiempo restante: 95 días

El proyecto de Guadalajara va mejor en términos de cronograma relativo. El proyecto de Querétaro, aunque presenta retraso, mantiene mejor eficiencia presupuestal.

¿Te gustaría más detalles sobre alguno de ellos?"

Ejemplo 3 (Estadísticas generales):
Usuario: "Dame estadísticas de mi proyecto"
Respuesta:
"📊 Resumen Ejecutivo - Planta Industrial Querétaro

⏰ TIEMPO
- Días transcurridos: 150 de 210 totales
- Días restantes: 60
- Progreso temporal: 71%

🏗️ AVANCE FÍSICO
- Avance actual: 65%
- Ritmo diario: 0.43%
- Hitos completados: 2 de 5

💰 FINANZAS
- Presupuesto: $15,000,000 MXN
- Ejecutado: $9,750,000 MXN (65%)
- Disponible: $5,250,000 MXN
- Eficiencia: 🟢 Dentro del presupuesto

🎯 PREDICCIÓN
- Fecha programada: 31 de marzo 2025
- Fecha estimada: 15 de abril 2025
- Días de retraso proyectado: 15

¿Necesitas información más detallada sobre algún aspecto?"

REGLA DE ORO: Proporciona análisis honestos basados en datos. Si hay problemas, comunícalos de forma constructiva con recomendaciones. Nunca inventes información.`;
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

    // Verificar que al menos un proveedor esté disponible - si GEMINI_API_KEY no está configurada, se usará Ollama

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
    
    // Calcular métricas para todos los proyectos
    const projectsWithMetrics: Record<string, FormattedProjectWithMetrics> = {};
    for (const [projectId, project] of Object.entries(userProjects)) {
      projectsWithMetrics[projectId] = {
        ...project,
        calculatedMetrics: calculateProjectMetrics(project)
      };
    }
    
    let projectContext = "";
    if (detectedProject) {
      const project = projectsWithMetrics[detectedProject];
      projectContext = `\n\nCONTEXTO DEL PROYECTO ACTUAL (${detectedProject}):\n${JSON.stringify(project, null, 2)}`;
    } else if (Object.keys(projectsWithMetrics).length > 0) {
      // Si no hay proyecto detectado pero hay proyectos disponibles, enviar resumen de todos
      const projectsSummary = Object.values(projectsWithMetrics).map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        physicalProgress: p.physicalProgress,
        status: p.status,
        metrics: p.calculatedMetrics
      }));
      projectContext = `\n\nRESUMEN DE TODOS LOS PROYECTOS DEL USUARIO:\n${JSON.stringify(projectsSummary, null, 2)}`;
    }

    const systemPrompt = generateSystemPrompt(userProjects);

    // Usar el sistema de failover para obtener respuesta
    const { text: botMessage } = await getLLMResponse(
      systemPrompt,
      projectContext,
      conversationHistory,
      message,
      projectsWithMetrics // Pasar los proyectos con métricas para Ollama
    );

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

  } catch (error: unknown) {
    const apiError = error as ApiError;
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: apiError.message || "Error desconocido"
      },
      { status: 500 }
    );
  }
}

function detectProject(
  message: string, 
  conversationHistory: Array<{ role: string; content: string }>,
  userProjects: Record<string, FormattedProject>
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

  } catch {
    return NextResponse.json(
      { error: "Error al obtener proyectos" },
      { status: 500 }
    );
  }
}
