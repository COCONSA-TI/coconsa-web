import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Schema para actualizar usuario (admin)
const UpdateUserSchema = z.object({
  full_name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }).optional(),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }).optional(),
  role: z.number().int().positive({ message: 'Rol inválido' }).optional(),
  department_id: z.string().uuid().nullable().optional(),
  is_department_head: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// GET - Obtener usuario por ID (solo admin)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        created_at,
        updated_at,
        is_active,
        is_department_head,
        roles (
          id,
          name
        ),
        departments (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        is_active: user.is_active ?? true,
        role: Array.isArray(user.roles) ? user.roles[0] : user.roles,
        department: Array.isArray(user.departments) ? user.departments[0] : user.departments,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar usuario (solo admin)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;
    const body = await request.json();
    const validatedFields = UpdateUserSchema.safeParse(body);

    if (!validatedFields.success) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Datos inválidos',
          details: validatedFields.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const { full_name, password, role, department_id, is_department_head, is_active } = validatedFields.data;

    // Verificar que el usuario exista
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updateData.full_name = full_name;
    if (role !== undefined) updateData.role = role;
    if (department_id !== undefined) updateData.department_id = department_id;
    if (is_department_head !== undefined) updateData.is_department_head = is_department_head;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    // Si se proporciona contraseña, hashearla
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 12);
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        email,
        full_name,
        created_at,
        updated_at,
        is_active,
        is_department_head,
        roles (
          id,
          name
        ),
        departments (
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        ...updatedUser,
        is_active: updatedUser.is_active ?? true,
        role: Array.isArray(updatedUser.roles) ? updatedUser.roles[0] : updatedUser.roles,
        department: Array.isArray(updatedUser.departments) ? updatedUser.departments[0] : updatedUser.departments,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete (inhabilitar usuario)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, session } = await requireAdmin();
    if (authError) return authError;

    const { id } = await params;

    // No permitir que el admin se elimine a sí mismo
    if (session?.userId === id) {
      return NextResponse.json(
        { success: false, error: 'No puedes desactivar tu propia cuenta' },
        { status: 400 }
      );
    }

    // Verificar que el usuario exista
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, is_active')
      .eq('id', id)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Soft delete - solo marcar como inactivo
    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating user:', error);
      return NextResponse.json(
        { success: false, error: 'Error al desactivar usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
