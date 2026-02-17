import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Schema para crear usuario
const CreateUserSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' }),
  full_name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }),
  role: z.number().int().positive({ message: 'Rol inválido' }),
  department_id: z.string().uuid().nullable().optional(),
  is_department_head: z.boolean().optional().default(false),
});

// GET - Listar todos los usuarios (solo admin)
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { data: users, error } = await supabaseAdmin
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
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener usuarios' },
        { status: 500 }
      );
    }

    // Formatear respuesta
    const formattedUsers = users?.map(user => ({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      created_at: user.created_at,
      updated_at: user.updated_at,
      is_active: user.is_active ?? true,
      is_department_head: user.is_department_head,
      role: Array.isArray(user.roles) ? user.roles[0] : user.roles,
      department: Array.isArray(user.departments) ? user.departments[0] : user.departments,
    })) || [];

    return NextResponse.json({
      success: true,
      users: formattedUsers,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo usuario (solo admin)
export async function POST(request: Request) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const body = await request.json();
    const validatedFields = CreateUserSchema.safeParse(body);

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

    const { email, password, full_name, role, department_id, is_department_head } = validatedFields.data;

    // Verificar que el email no exista
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un usuario con este email' },
        { status: 400 }
      );
    }

    // Hash de la contraseña
    const password_hash = await bcrypt.hash(password, 12);

    // Crear usuario
    const { data: newUser, error } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        password_hash,
        full_name,
        role,
        department_id: department_id || null,
        is_department_head: is_department_head || false,
        is_active: true,
      })
      .select(`
        id,
        email,
        full_name,
        created_at,
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
      console.error('Error creating user:', error);
      return NextResponse.json(
        { success: false, error: 'Error al crear usuario' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: {
        ...newUser,
        role: Array.isArray(newUser.roles) ? newUser.roles[0] : newUser.roles,
        department: Array.isArray(newUser.departments) ? newUser.departments[0] : newUser.departments,
      },
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
