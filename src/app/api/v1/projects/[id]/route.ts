import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Interfaces for Database Types
interface DBContact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

interface DBMilestone {
  name: string;
  status: string;
  progress: number;
  date: string;
  sort_order: number;
}

interface DBUpdate {
  date: string;
  title: string;
  description: string;
}

interface DBSupervisor {
  name: string;
  phone: string;
  email: string;
  position: string;
}

interface DBFinancial {
  total_budget: number;
  currency: string;
  spent: number;
  percentage: number;
  last_update: string;
}

interface DBProject {
  id: string; 
  project_id: string; 
  project_name: string;
  client: string;
  status: string;
  start_date: string;
  estimated_end_date: string;
  physical_progress: number;
  project_financials: DBFinancial[];
  project_supervisors: DBSupervisor[];
  project_contacts: DBContact[];
  project_milestones: DBMilestone[];
  project_updates: DBUpdate[];
}

interface ProjectBody {
  projectName: string;
  client: string;
  status: string;
  startDate: string;
  estimatedEndDate: string;
  physicalProgress: number;
  financialProgress?: {
    totalBudget: number;
    currency: string;
    spent: number;
    percentage: number;
    lastUpdate: string;
  };
  supervisor?: {
    name: string;
    phone: string;
    email: string;
    position: string;
  };
  contacts?: {
    name: string;
    role: string;
    phone: string;
    email: string;
  }[];
  milestones?: {
    name: string;
    status: string;
    progress: number;
    date: string;
  }[];
  recentUpdates?: {
    date: string;
    title: string;
    description: string;
  }[];
}

// GET - Obtener un proyecto específico
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Obtener el proyecto con sus relaciones
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select(`
        *,
        project_financials (*),
        project_supervisors (*),
        project_contacts (*),
        project_milestones (*),
        project_updates (*)
      `)
      .eq('project_id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }
    
    // Cast data to DBProject to ensure type safety in map/sort operations
    const project = data as unknown as DBProject;

    // Transformar al formato esperado
    const formattedProject = {
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
      contacts: project.project_contacts?.map((c) => ({
        name: c.name,
        role: c.role,
        phone: c.phone,
        email: c.email
      })) || [],
      milestones: project.project_milestones
        ?.sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          name: m.name,
          status: m.status,
          progress: m.progress,
          date: m.date
        })) || [],
      recentUpdates: project.project_updates
        ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((u) => ({
          date: u.date,
          title: u.title,
          description: u.description
        })) || [],
      _id: project.id
    };

    return NextResponse.json({
      success: true,
      project: formattedProject
    });

  } catch (error) {
    console.error('Error en GET /api/v1/projects/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PUT - Actualizar proyecto completo
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos
    const { error: authError } = await requirePermission('projects', 'update');
    if (authError) return authError;

    const { id } = await params;
    const body: ProjectBody = await request.json();

    const {
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

    // Obtener el proyecto por project_id para obtener el UUID
    const { data: existingProject, error: findError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('project_id', id)
      .single();

    if (findError || !existingProject) {
      return NextResponse.json(
        { success: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    const projectUUID = existingProject.id;

    // Actualizar proyecto principal
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({
        project_name: projectName,
        client: client,
        status: status,
        start_date: startDate,
        estimated_end_date: estimatedEndDate,
        physical_progress: physicalProgress
      })
      .eq('id', projectUUID);

    if (updateError) {
      console.error('Error actualizando proyecto:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar el proyecto' },
        { status: 500 }
      );
    }

    // Actualizar o crear información financiera
    if (financialProgress) {
      await supabaseAdmin
        .from('project_financials')
        .upsert({
          project_id: projectUUID,
          total_budget: financialProgress.totalBudget || 0,
          currency: financialProgress.currency || 'MXN',
          spent: financialProgress.spent || 0,
          percentage: financialProgress.percentage || 0,
          last_update: financialProgress.lastUpdate || new Date().toISOString().split('T')[0]
        }, {
          onConflict: 'project_id'
        });
    }

    // Actualizar o crear supervisor
    if (supervisor) {
      await supabaseAdmin
        .from('project_supervisors')
        .upsert({
          project_id: projectUUID,
          name: supervisor.name || '',
          phone: supervisor.phone || '',
          email: supervisor.email || '',
          position: supervisor.position || 'Supervisor de Obra'
        }, {
          onConflict: 'project_id'
        });
    }

    // Reemplazar contactos (eliminar y crear nuevos)
    await supabaseAdmin
      .from('project_contacts')
      .delete()
      .eq('project_id', projectUUID);

    if (contacts && contacts.length > 0) {
      const contactsToInsert = contacts.map((c) => ({
        project_id: projectUUID,
        name: c.name,
        role: c.role || '',
        phone: c.phone || '',
        email: c.email || ''
      }));
      await supabaseAdmin.from('project_contacts').insert(contactsToInsert);
    }

    // Reemplazar hitos
    await supabaseAdmin
      .from('project_milestones')
      .delete()
      .eq('project_id', projectUUID);

    if (milestones && milestones.length > 0) {
      const milestonesToInsert = milestones.map((m, index) => ({
        project_id: projectUUID,
        name: m.name,
        status: m.status || 'Pendiente',
        progress: m.progress || 0,
        date: m.date || null,
        sort_order: index
      }));
      await supabaseAdmin.from('project_milestones').insert(milestonesToInsert);
    }

    // Reemplazar actualizaciones
    await supabaseAdmin
      .from('project_updates')
      .delete()
      .eq('project_id', projectUUID);

    if (recentUpdates && recentUpdates.length > 0) {
      const updatesToInsert = recentUpdates.map((u) => ({
        project_id: projectUUID,
        date: u.date || new Date().toISOString().split('T')[0],
        title: u.title,
        description: u.description || ''
      }));
      await supabaseAdmin.from('project_updates').insert(updatesToInsert);
    }

    return NextResponse.json({
      success: true,
      message: 'Proyecto actualizado exitosamente'
    });

  } catch (error) {
    console.error('Error en PUT /api/v1/projects/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar proyecto
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos
    const { error: authError } = await requirePermission('projects', 'delete');
    if (authError) return authError;

    const { id } = await params;

    // Buscar proyecto por project_id
    const { data: existingProject, error: findError } = await supabaseAdmin
      .from('projects')
      .select('id, project_name')
      .eq('project_id', id)
      .single();

    if (findError || !existingProject) {
      return NextResponse.json(
        { success: false, error: 'Proyecto no encontrado' },
        { status: 404 }
      );
    }

    // Eliminar proyecto (las tablas relacionadas se eliminan por CASCADE)
    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', existingProject.id);

    if (deleteError) {
      console.error('Error eliminando proyecto:', deleteError);
      return NextResponse.json(
        { success: false, error: 'Error al eliminar el proyecto' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Proyecto "${existingProject.project_name}" eliminado exitosamente`
    });

  } catch (error) {
    console.error('Error en DELETE /api/v1/projects/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
