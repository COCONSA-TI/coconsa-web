import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { Contact, Milestone, RecentUpdate } from "@/types/project";
import { MilestoneSortable, UpdateSortable } from "@/types/database";

// GET - Obtener todos los proyectos
export async function GET() {
  try {
    // Obtener todos los proyectos con sus relaciones
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
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Error al obtener proyectos' },
        { status: 500 }
      );
    }

    // Transformar datos al formato esperado por el frontend
    const formattedProjects = projects?.map(project => ({
      projectId: project.project_id,
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
        name: '',
        phone: '',
        email: '',
        position: ''
      },
      contacts: project.project_contacts?.map((c: Contact) => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email
      })) || [],
      milestones: project.project_milestones
        ?.sort((a: MilestoneSortable, b: MilestoneSortable) => a.sort_order - b.sort_order)
        .map((m: Milestone) => ({
          name: m.name,
          status: m.status,
          progress: m.progress,
          date: m.date
        })) || [],
      recentUpdates: project.project_updates
        ?.sort((a: UpdateSortable, b: UpdateSortable) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((u: RecentUpdate) => ({
          date: u.date,
          title: u.title,
          description: u.description
        })) || [],
      // Incluir el ID interno para operaciones CRUD
      _id: project.id
    })) || [];

    return NextResponse.json({
      success: true,
      projects: formattedProjects
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo proyecto
export async function POST(request: Request) {
  try {
    // Verificar permisos
    const { error: authError } = await requirePermission('projects', 'create');
    if (authError) return authError;

    const body = await request.json();
    const {
      projectId,
      projectName,
      client,
      status,
      startDate,
      estimatedEndDate,
      physicalProgress,
      financialProgress,
      supervisor,
      contacts,
      milestones,
      recentUpdates
    } = body;

    // Validaciones
    if (!projectName || !client) {
      return NextResponse.json(
        { success: false, error: 'Nombre del proyecto y cliente son requeridos' },
        { status: 400 }
      );
    }

    // Crear proyecto principal
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .insert({
        project_id: projectId || null, // Se genera automáticamente si es null
        project_name: projectName,
        client: client,
        status: status || 'En Proceso',
        start_date: startDate || new Date().toISOString().split('T')[0],
        estimated_end_date: estimatedEndDate || null,
        physical_progress: physicalProgress || 0
      })
      .select()
      .single();

    if (projectError) {
      return NextResponse.json(
        { success: false, error: 'Error al crear el proyecto: ' + projectError.message },
        { status: 500 }
      );
    }

    const projectUUID = project.id;

    // Crear información financiera
    if (financialProgress) {
      await supabaseAdmin.from('project_financials').insert({
        project_id: projectUUID,
        total_budget: financialProgress.totalBudget || 0,
        currency: financialProgress.currency || 'MXN',
        spent: financialProgress.spent || 0,
        percentage: financialProgress.percentage || 0,
        last_update: financialProgress.lastUpdate || new Date().toISOString().split('T')[0]
      });
    }

    // Crear supervisor
    if (supervisor && supervisor.name) {
      await supabaseAdmin.from('project_supervisors').insert({
        project_id: projectUUID,
        name: supervisor.name,
        phone: supervisor.phone || '',
        email: supervisor.email || '',
        position: supervisor.position || 'Supervisor de Obra'
      });
    }

    // Crear contactos
    if (contacts && contacts.length > 0) {
      const contactsToInsert = contacts.map((c: Contact) => ({
        project_id: projectUUID,
        name: c.name,
        role: c.role || '',
        phone: c.phone || '',
        email: c.email || ''
      }));
      await supabaseAdmin.from('project_contacts').insert(contactsToInsert);
    }

    // Crear hitos
    if (milestones && milestones.length > 0) {
      const milestonesToInsert = milestones.map((m: Milestone, index: number) => ({
        project_id: projectUUID,
        name: m.name,
        status: m.status || 'Pendiente',
        progress: m.progress || 0,
        date: m.date || null,
        sort_order: index
      }));
      await supabaseAdmin.from('project_milestones').insert(milestonesToInsert);
    }

    // Crear actualizaciones
    if (recentUpdates && recentUpdates.length > 0) {
      const updatesToInsert = recentUpdates.map((u: RecentUpdate) => ({
        project_id: projectUUID,
        date: u.date || new Date().toISOString().split('T')[0],
        title: u.title,
        description: u.description || ''
      }));
      await supabaseAdmin.from('project_updates').insert(updatesToInsert);
    }

    return NextResponse.json({
      success: true,
      message: 'Proyecto creado exitosamente',
      project: {
        projectId: project.project_id,
        _id: project.id
      }
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
