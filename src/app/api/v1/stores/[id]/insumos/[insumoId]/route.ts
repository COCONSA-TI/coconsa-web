import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * PATCH /api/v1/stores/[id]/insumos/[insumoId]
 * Actualiza costo_autorizado y/o monto_autorizado de un insumo.
 * Acepta dos modos:
 *   - { costo_autorizado: number | null } → calcula monto_autorizado automáticamente
 *   - { monto_autorizado: number | null } → retro-calcula costo_autorizado automáticamente
 * Solo Gerencia (approval_order = 1) y Dirección (approval_order >= 3) pueden editar.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; insumoId: string }> }
) {
  try {
    const { error: authError, session } = await requireAuth();
    if (authError) return authError;

    const { id, insumoId } = await params;
    const storeId = parseInt(id, 10);
    const insumoIdNum = parseInt(insumoId, 10);

    if (isNaN(storeId) || isNaN(insumoIdNum)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    // Verificar permisos: Gerencia (approval_order = 1) o Dirección (>= 3) o admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("is_department_head, department_id")
      .eq("id", session!.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    let canEdit = session!.role === "admin";

    if (!canEdit && userData.is_department_head && userData.department_id) {
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("approval_order, code")
        .eq("id", userData.department_id)
        .single();

      if (dept) {
        const ao = dept.approval_order ?? 0;
        canEdit = ao === 1 || ao >= 3;
      }
    }

    if (!canEdit) {
      return NextResponse.json(
        { error: "Solo Gerencia y Dirección pueden autorizar costos" },
        { status: 403 }
      );
    }

    // Leer body — acepta costo_autorizado O monto_autorizado como fuente de edición
    const body = await request.json() as {
      costo_autorizado?: number | null;
      monto_autorizado?: number | null;
    };

    // Obtener insumo para validaciones y cálculos
    const { data: insumo } = await supabaseAdmin
      .from("store_insumos")
      .select("id, clave, descripcion, costo_unitario, cantidad_presupuestada, monto_presupuestado")
      .eq("id", insumoIdNum)
      .eq("store_id", storeId)
      .single();

    if (!insumo) {
      return NextResponse.json({ error: "Insumo no encontrado en esta obra" }, { status: 404 });
    }

    const cantidad = insumo.cantidad_presupuestada ?? 0;
    const monto_presup = insumo.monto_presupuestado ?? 0;

    let finalCostoAutorizado: number | null;
    let finalMontoAutorizado: number | null;

    // ── Modo A: se editó costo_autorizado ──────────────────────────────────
    if ("costo_autorizado" in body) {
      const val = body.costo_autorizado;
      if (val !== null && val !== undefined) {
        if (typeof val !== "number" || val < 0) {
          return NextResponse.json(
            { error: "costo_autorizado debe ser un número >= 0, o null" },
            { status: 400 }
          );
        }
        if (val > insumo.costo_unitario) {
          return NextResponse.json(
            { error: `El costo autorizado ($${val.toFixed(2)}) no puede superar el costo unitario ($${insumo.costo_unitario.toFixed(2)})` },
            { status: 400 }
          );
        }
        finalCostoAutorizado = val;
        finalMontoAutorizado = val * cantidad;
      } else {
        // null → borrar ambos
        finalCostoAutorizado = null;
        finalMontoAutorizado = null;
      }
    }
    // ── Modo B: se editó monto_autorizado ─────────────────────────────────
    else if ("monto_autorizado" in body) {
      const val = body.monto_autorizado;
      if (val !== null && val !== undefined) {
        if (typeof val !== "number" || val < 0) {
          return NextResponse.json(
            { error: "monto_autorizado debe ser un número >= 0, o null" },
            { status: 400 }
          );
        }
        if (val > monto_presup) {
          return NextResponse.json(
            { error: `El monto autorizado ($${val.toFixed(2)}) no puede superar el monto presupuestado ($${monto_presup.toFixed(2)})` },
            { status: 400 }
          );
        }
        finalMontoAutorizado = val;
        // Retro-calcular costo_autorizado (evitar división por cero)
        finalCostoAutorizado = cantidad > 0 ? val / cantidad : null;
      } else {
        finalCostoAutorizado = null;
        finalMontoAutorizado = null;
      }
    } else {
      return NextResponse.json(
        { error: "Se requiere costo_autorizado o monto_autorizado en el body" },
        { status: 400 }
      );
    }

    // Guardar ambos campos sincronizados
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("store_insumos")
      .update({
        costo_autorizado: finalCostoAutorizado,
        monto_autorizado: finalMontoAutorizado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insumoIdNum)
      .select()
      .single();

    if (updateError) {
      console.error("[insumos/PATCH] Error al actualizar costos autorizados:", updateError);
      return NextResponse.json(
        { error: "Error al guardar: " + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Costos autorizados actualizados para "${insumo.descripcion}"`,
      insumo: updated,
    });
  } catch (error: unknown) {
    console.error("[insumos/PATCH] Error inesperado:", error);
    const errMsg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: "Error al procesar la solicitud: " + errMsg }, { status: 500 });
  }
}
