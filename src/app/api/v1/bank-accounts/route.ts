import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/v1/bank-accounts
 * Lista las cuentas bancarias del usuario autenticado
 */
export async function GET() {
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

    // Obtener cuentas bancarias del usuario
    const { data: accounts, error } = await supabaseAdmin
      .from('user_bank_accounts')
      .select('*')
      .eq('user_id', session.userId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener cuentas bancarias:', error);
      return NextResponse.json(
        { success: false, error: "Error al obtener las cuentas bancarias" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: accounts || [],
      count: accounts?.length || 0,
    });

  } catch (error) {
    console.error("Error en GET /api/v1/bank-accounts:", error);
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
 * POST /api/v1/bank-accounts
 * Crea una nueva cuenta bancaria para el usuario autenticado
 */
export async function POST(request: Request) {
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

    const body = await request.json();
    const { bank_name, account_number, clabe, account_type, is_primary } = body;

    // Validaciones
    if (!bank_name || bank_name.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "El nombre del banco es requerido" },
        { status: 400 }
      );
    }

    if (!account_number || account_number.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: "El número de cuenta debe tener al menos 10 dígitos" },
        { status: 400 }
      );
    }

    if (clabe && clabe.length !== 18) {
      return NextResponse.json(
        { success: false, error: "La CLABE debe tener exactamente 18 dígitos" },
        { status: 400 }
      );
    }

    const validAccountTypes = ['ahorro', 'cheques', 'inversion'];
    if (account_type && !validAccountTypes.includes(account_type)) {
      return NextResponse.json(
        { success: false, error: "Tipo de cuenta inválido" },
        { status: 400 }
      );
    }

    // Si se marca como principal, desmarcar las demás
    if (is_primary === true) {
      await supabaseAdmin
        .from('user_bank_accounts')
        .update({ is_primary: false })
        .eq('user_id', session.userId);
    }

    // Crear la cuenta bancaria
    const { data: account, error } = await supabaseAdmin
      .from('user_bank_accounts')
      .insert({
        user_id: session.userId,
        bank_name: bank_name.trim(),
        account_number: account_number.trim(),
        clabe: clabe ? clabe.trim() : null,
        account_type: account_type || 'ahorro',
        is_primary: is_primary === true,
        is_active: true,
        created_by: session.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error al crear cuenta bancaria:', error);
      
      if (error.code === '23505') { // Duplicate key
        return NextResponse.json(
          { success: false, error: "Ya existe una cuenta con esa CLABE" },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: "Error al crear la cuenta bancaria" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: account,
      message: "Cuenta bancaria creada exitosamente",
    }, { status: 201 });

  } catch (error) {
    console.error("Error en POST /api/v1/bank-accounts:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Error interno del servidor"
      },
      { status: 500 }
    );
  }
}
