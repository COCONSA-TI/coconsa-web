import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Schema para actualizar usuario (admin)
const UpdateUserSchema = z.object({
  full_name: z.string().min(2, { message: 'El nombre debe tener al menos 2 caracteres' }).optional(),
  password: z.string().min(8, { message: 'La contraseña debe tener al menos 8 caracteres' }).optional(),
  role: z.number().int().positive({ message: 'Rol inválido' }).optional(),
  department_id: z.string().uuid().nullable().optional(),
  is_department_head: z.boolean().optional(),
  is_active: z.boolean().optional(),
  all_stores_access: z.boolean().optional(),
  can_view_all_store_orders: z.boolean().optional(),
  store_ids: z.array(z.number()).optional(),
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
        all_stores_access,
        can_view_all_store_orders,
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

    // Consultar centros de costos asignados
    const { data: userStores } = await supabaseAdmin
      .from('user_stores')
      .select('store_id, stores(id, name)')
      .eq('user_id', id);

    const assignedStores = (userStores || [])
      .map((us: any) => {
        const s = Array.isArray(us.stores) ? us.stores[0] : us.stores;
        return s ? { id: s.id, name: s.name } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        is_active: user.is_active ?? true,
        all_stores_access: user.all_stores_access ?? false,
        can_view_all_store_orders: user.can_view_all_store_orders ?? false,
        role: Array.isArray(user.roles) ? user.roles[0] : user.roles,
        department: Array.isArray(user.departments) ? user.departments[0] : user.departments,
        stores: assignedStores,
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

    const { 
      full_name, 
      password, 
      role, 
      department_id, 
      is_department_head, 
      is_active,
      all_stores_access,
      can_view_all_store_orders,
      store_ids
    } = validatedFields.data;

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
    if (all_stores_access !== undefined) updateData.all_stores_access = all_stores_access;
    if (can_view_all_store_orders !== undefined) updateData.can_view_all_store_orders = can_view_all_store_orders;
    
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
        all_stores_access,
        can_view_all_store_orders,
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

    // Sincronizar centros de costos si se enviaron store_ids o si se cambió all_stores_access
    if (store_ids !== undefined) {
      await supabaseAdmin.from('user_stores').delete().eq('user_id', id);

      // Si no tiene acceso global y hay tiendas seleccionadas, insertarlas
      const effectiveAllAccess = all_stores_access ?? updatedUser.all_stores_access ?? false;
      if (!effectiveAllAccess && store_ids.length > 0) {
        const recordsToInsert = store_ids.map(sid => ({
          user_id: id,
          store_id: sid,
        }));
        await supabaseAdmin.from('user_stores').insert(recordsToInsert);
      }
    }

    // Consultar tiendas resultantes
    const { data: finalUserStores } = await supabaseAdmin
      .from('user_stores')
      .select('store_id, stores(id, name)')
      .eq('user_id', id);

    const resultingStores = (finalUserStores || [])
      .map((us: any) => {
        const s = Array.isArray(us.stores) ? us.stores[0] : us.stores;
        return s ? { id: s.id, name: s.name } : null;
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: {
        ...updatedUser,
        is_active: updatedUser.is_active ?? true,
        all_stores_access: updatedUser.all_stores_access ?? false,
        can_view_all_store_orders: updatedUser.can_view_all_store_orders ?? false,
        role: Array.isArray(updatedUser.roles) ? updatedUser.roles[0] : updatedUser.roles,
        department: Array.isArray(updatedUser.departments) ? updatedUser.departments[0] : updatedUser.departments,
        stores: resultingStores,
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
