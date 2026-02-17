import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRoleRelation } from "@/types/database";

// Schema para actualizar perfil (usuario normal)
const UpdateProfileSchema = z.object({
  full_name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }).optional(),
});

// Schema para cambiar contraseña
const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, { message: 'La contraseña actual es requerida' }),
  new_password: z.string().min(6, { message: 'La nueva contraseña debe tener al menos 6 caracteres' }),
  confirm_password: z.string().min(1, { message: 'Confirma la nueva contraseña' }),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm_password'],
});

// GET - Obtener perfil del usuario actual
export async function GET() {
  try {
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        created_at,
        updated_at,
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
      .eq('id', session!.userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const userRoles = user.roles as UserRoleRelation | UserRoleRelation[] | null;
    const roleName = Array.isArray(userRoles) ? userRoles[0]?.name : userRoles?.name || 'user';
    const roleData = Array.isArray(user.roles) ? user.roles[0] : user.roles;
    const departmentData = Array.isArray(user.departments) ? user.departments[0] : user.departments;

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at,
        updated_at: user.updated_at,
        is_department_head: user.is_department_head,
        role: roleData,
        role_name: roleName,
        department: departmentData,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// PATCH - Actualizar perfil (solo nombre, NO email)
export async function PATCH(request: Request) {
  try {
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedFields = UpdateProfileSchema.safeParse(body);

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

    const { full_name } = validatedFields.data;

    // Solo actualizar si hay cambios
    if (!full_name) {
      return NextResponse.json(
        { success: false, error: 'No hay datos para actualizar' },
        { status: 400 }
      );
    }

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session!.userId)
      .select(`
        id,
        email,
        full_name,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { success: false, error: 'Error al actualizar perfil' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      user: updatedUser,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Cambiar contraseña
export async function POST(request: Request) {
  try {
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    const body = await request.json();
    const validatedFields = ChangePasswordSchema.safeParse(body);

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

    const { current_password, new_password } = validatedFields.data;

    // Obtener contraseña actual del usuario
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', session!.userId)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar contraseña actual
    const passwordMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!passwordMatch) {
      return NextResponse.json(
        { success: false, error: 'La contraseña actual es incorrecta' },
        { status: 400 }
      );
    }

    // Hash de la nueva contraseña
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    // Actualizar contraseña
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session!.userId);

    if (updateError) {
      console.error('Error changing password:', updateError);
      return NextResponse.json(
        { success: false, error: 'Error al cambiar contraseña' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
