import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/v1/bank-accounts/[id]
 * Obtiene los detalles de una cuenta bancaria específica
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Obtener la cuenta bancaria
    const { data: account, error } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.userId) // Solo puede ver sus propias cuentas
      .single();

    if (error || !account) {
      return NextResponse.json(
        { success: false, error: "Cuenta bancaria no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account,
    });

  } catch (error) {
    console.error("Error en GET /api/v1/bank-accounts/[id]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/bank-accounts/[id]
 * Actualiza una cuenta bancaria existente
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { bank_name, account_number, clabe, account_type, is_primary, is_active } = body;

    // Verificar que la cuenta existe y pertenece al usuario
    const { data: existingAccount, error: fetchError } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.userId)
      .single();

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { success: false, error: "Cuenta bancaria no encontrada" },
        { status: 404 }
      );
    }

    // Preparar datos para actualizar
    const updateData: any = {};

    if (bank_name !== undefined) {
      if (!bank_name || bank_name.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: "El nombre del banco es requerido" },
          { status: 400 }
        );
      }
      updateData.bank_name = bank_name.trim();
    }

    if (account_number !== undefined) {
      if (!account_number || account_number.trim().length < 10) {
        return NextResponse.json(
          { success: false, error: "El número de cuenta debe tener al menos 10 dígitos" },
          { status: 400 }
        );
      }
      updateData.account_number = account_number.trim();
    }

    if (clabe !== undefined) {
      if (clabe && clabe.length !== 18) {
        return NextResponse.json(
          { success: false, error: "La CLABE debe tener exactamente 18 dígitos" },
          { status: 400 }
        );
      }
      updateData.clabe = clabe ? clabe.trim() : null;
    }

    if (account_type !== undefined) {
      const validAccountTypes = ['ahorro', 'cheques', 'inversion'];
      if (!validAccountTypes.includes(account_type)) {
        return NextResponse.json(
          { success: false, error: "Tipo de cuenta inválido" },
          { status: 400 }
        );
      }
      updateData.account_type = account_type;
    }

    if (is_active !== undefined) {
      updateData.is_active = is_active === true;
    }

    // Si se marca como principal, desmarcar las demás
    if (is_primary === true && !existingAccount.is_primary) {
      await supabaseAdmin
        .from('user_bank_accounts')
        .update({ is_primary: false })
        .eq('user_id', session.userId)
        .neq('id', id);
      
      updateData.is_primary = true;
    } else if (is_primary === false) {
      updateData.is_primary = false;
    }

    // Actualizar la cuenta
    const { data: updatedAccount, error: updateError } = await supabaseAdmin
      .from('user_bank_accounts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', session.userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error al actualizar cuenta bancaria:', updateError);
      
      if (updateError.code === '23505') { // Duplicate key
        return NextResponse.json(
          { success: false, error: "Ya existe una cuenta con esa CLABE" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: "Error al actualizar la cuenta bancaria" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedAccount,
      message: "Cuenta bancaria actualizada exitosamente",
    });

  } catch (error) {
    console.error("Error en PUT /api/v1/bank-accounts/[id]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/bank-accounts/[id]
 * Desactiva una cuenta bancaria (soft delete)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verificar que la cuenta existe y pertenece al usuario
    const { data: existingAccount, error: fetchError } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.userId)
      .single();

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { success: false, error: "Cuenta bancaria no encontrada" },
        { status: 404 }
      );
    }

    // Verificar que no esté siendo usada en listas de necesidades activas
    const { data: activeLists, error: listsError } = await supabaseAdmin
      .from('needs_lists')
      .select('id')
      .eq('bank_account_id', id)
      .in('status', ['pending', 'in_progress', 'approved']);

    if (listsError) {
      console.error('Error al verificar listas activas:', listsError);
    }

    if (activeLists && activeLists.length > 0) {
      return NextResponse.json(
        { success: false, error: "No se puede desactivar una cuenta que está siendo usada en listas activas" },
        { status: 400 }
      );
    }

    // Desactivar la cuenta (soft delete)
    const { error: updateError } = await supabaseAdmin
      .from('user_bank_accounts')
      .update({ 
        is_active: false,
        is_primary: false, // Si era principal, ya no lo será
      })
      .eq('id', id)
      .eq('user_id', session.userId);

    if (updateError) {
      console.error('Error al desactivar cuenta bancaria:', updateError);
      return NextResponse.json(
        { success: false, error: "Error al desactivar la cuenta bancaria" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Cuenta bancaria desactivada exitosamente",
    });

  } catch (error) {
    console.error("Error en DELETE /api/v1/bank-accounts/[id]:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
