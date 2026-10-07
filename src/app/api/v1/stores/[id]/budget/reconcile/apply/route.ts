import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { InsumoCategoria } from "@/types/database";

interface ReconcileItemDecision {
  id: string; // `${source}_${source_id}_${item_index}`
  source: "order" | "needs_list";
  source_id: number;
  item_index: number;
  action: "match_existing" | "create_new" | "ignore";
  matched_insumo_id?: number | null;
  matched_clave?: string | null;
  category?: InsumoCategoria | string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
}

/**
 * POST /api/v1/stores/[id]/budget/reconcile/apply
 * Aplica las decisiones de conciliación aprobadas por el usuario:
 * 1. Vincula items a insumos existentes del presupuesto (actualizando JSON de la orden/lista)
 * 2. Da de alta nuevos conceptos en store_insumos con su categoría real (Gastos Indirectos, Materiales, Equipo, etc.)
 * 3. Ejecuta recalcular_presupuesto_obra para sincronizar cantidades solicitadas
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError } = await requirePermission("orders", "create");
    if (authError) return authError;

    const { id } = await params;
    const storeId = parseInt(id, 10);
    if (isNaN(storeId)) {
      return NextResponse.json({ error: "ID de obra inválido" }, { status: 400 });
    }

    const body = await request.json();
    const decisions: ReconcileItemDecision[] = body.decisions || [];

    if (decisions.length === 0) {
      return NextResponse.json({ success: true, message: "No se seleccionó ningún item para conciliar", matchedCount: 0, createdCount: 0 });
    }

    // 1. Obtener claves existentes en store_insumos para generar secuencias limpias
    const { data: currentInsumos } = await supabaseAdmin
      .from("store_insumos")
      .select("clave, categoria")
      .eq("store_id", storeId);

    const existingClaves = new Set((currentInsumos ?? []).map((i) => i.clave.trim().toUpperCase()));

    // Contadores de secuencia por prefijo
    const getNextClave = (prefix: string): string => {
      let num = 1;
      while (existingClaves.has(`${prefix}${String(num).padStart(4, "0")}`)) {
        num++;
      }
      const newClave = `${prefix}${String(num).padStart(4, "0")}`;
      existingClaves.add(newClave);
      return newClave;
    };

    let matchedCount = 0;
    let createdCount = 0;

    // Mapa para agrupar cambios por orden y lista
    // orderId -> { items: any[] }
    const ordersToUpdate = new Map<number, any[]>();
    const needsListsToUpdate = new Map<number, any[]>();

    // 2. Pre-cargar las órdenes y listas que van a ser modificadas
    const orderIds = Array.from(new Set(decisions.filter((d) => d.source === "order" && d.action !== "ignore").map((d) => d.source_id)));
    const needsListIds = Array.from(new Set(decisions.filter((d) => d.source === "needs_list" && d.action !== "ignore").map((d) => d.source_id)));

    if (orderIds.length > 0) {
      const { data: dbOrders } = await supabaseAdmin
        .from("orders")
        .select("id, items")
        .in("id", orderIds);

      (dbOrders ?? []).forEach((ord) => {
        let itemsArr: any[] = [];
        try {
          itemsArr = typeof ord.items === "string" ? JSON.parse(ord.items) : ord.items || [];
        } catch {
          itemsArr = [];
        }
        ordersToUpdate.set(ord.id, itemsArr);
      });
    }

    if (needsListIds.length > 0) {
      const { data: dbNeedsLists } = await supabaseAdmin
        .from("needs_lists")
        .select("id, items")
        .in("id", needsListIds);

      (dbNeedsLists ?? []).forEach((nl) => {
        let itemsArr: any[] = [];
        try {
          itemsArr = typeof nl.items === "string" ? JSON.parse(nl.items) : nl.items || [];
        } catch {
          itemsArr = [];
        }
        needsListsToUpdate.set(nl.id, itemsArr);
      });
    }

    // 3. Procesar cada decisión
    const newInsumosToInsert: any[] = [];

    for (const dec of decisions) {
      if (dec.action === "ignore") continue;

      let assignedClave = "";

      if (dec.action === "match_existing" && dec.matched_clave) {
        assignedClave = dec.matched_clave.trim();
        matchedCount++;
      } else if (dec.action === "create_new") {
        const cat = (dec.category || "Gastos Indirectos").trim();
        let prefix = "IND-";
        if (cat === "Materiales") prefix = "MAT-EXT-";
        else if (cat === "Equipo") prefix = "EQ-EXT-";
        else if (cat === "Herramienta") prefix = "HERR-EXT-";
        else if (cat === "Mano de Obra") prefix = "MO-EXT-";
        else if (cat === "Adicionales") prefix = "ADIC-";

        assignedClave = getNextClave(prefix);

        newInsumosToInsert.push({
          store_id: storeId,
          clave: assignedClave,
          descripcion: dec.nombre.trim(),
          unidad: (dec.unidad || "pza").trim(),
          cantidad_presupuestada: dec.cantidad || 1,
          costo_unitario: dec.precio_unitario || 0,
          costo_autorizado: dec.precio_unitario || 0,
          monto_presupuestado: dec.total || ((dec.cantidad || 1) * (dec.precio_unitario || 0)),
          monto_autorizado: dec.total || ((dec.cantidad || 1) * (dec.precio_unitario || 0)),
          porcentaje: 0,
          categoria: cat,
          cantidad_solicitada: 0, // Se sincroniza en recalcular
          cantidad_comprada: 0,
          activo: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        createdCount++;
      }

      // Actualizar el item en la estructura de la orden o lista de necesidades
      if (assignedClave) {
        if (dec.source === "order") {
          const itemsArr = ordersToUpdate.get(dec.source_id);
          if (itemsArr && itemsArr[dec.item_index]) {
            itemsArr[dec.item_index].insumo_clave = assignedClave;
            if (dec.action === "create_new") {
              itemsArr[dec.item_index].categoria = dec.category;
            }
          }
        } else if (dec.source === "needs_list") {
          const itemsArr = needsListsToUpdate.get(dec.source_id);
          if (itemsArr && itemsArr[dec.item_index]) {
            itemsArr[dec.item_index].insumo_clave = assignedClave;
            if (dec.action === "create_new") {
              itemsArr[dec.item_index].categoria = dec.category;
            }
          }
        }
      }
    }

    // 4. Insertar los nuevos conceptos creados en store_insumos
    if (newInsumosToInsert.length > 0) {
      const { error: insertInsumosError } = await supabaseAdmin
        .from("store_insumos")
        .insert(newInsumosToInsert);

      if (insertInsumosError) {
        console.error("[reconcile/apply] Error al insertar nuevos insumos:", insertInsumosError);
        return NextResponse.json(
          { error: "Error al registrar nuevos insumos en el presupuesto: " + insertInsumosError.message },
          { status: 500 }
        );
      }
    }

    // 5. Guardar los items actualizados en orders
    for (const [orderId, items] of Array.from(ordersToUpdate.entries())) {
      const { error: ordUpdateErr } = await supabaseAdmin
        .from("orders")
        .update({
          items: JSON.stringify(items),
        })
        .eq("id", orderId);

      if (ordUpdateErr) {
        console.error(`[reconcile/apply] Error al actualizar orden #${orderId}:`, ordUpdateErr);
      }
    }

    // 6. Guardar los items actualizados en needs_lists
    for (const [needsListId, items] of Array.from(needsListsToUpdate.entries())) {
      const { error: nlUpdateErr } = await supabaseAdmin
        .from("needs_lists")
        .update({
          items: JSON.stringify(items),
        })
        .eq("id", needsListId);

      if (nlUpdateErr) {
        console.error(`[reconcile/apply] Error al actualizar lista #${needsListId}:`, nlUpdateErr);
      }
    }

    // 7. Ejecutar recalcular_presupuesto_obra para sincronizar cantidades solicitadas
    try {
      await supabaseAdmin.rpc("recalcular_presupuesto_obra", { p_store_id: storeId });
    } catch (rpcErr) {
      console.warn("[reconcile/apply] Advertencia en recalcular_presupuesto_obra:", rpcErr);
    }

    return NextResponse.json({
      success: true,
      message: `Conciliación exitosa: ${matchedCount} items vinculados al presupuesto original y ${createdCount} nuevos conceptos clasificados.`,
      matchedCount,
      createdCount,
      ordersUpdatedCount: ordersToUpdate.size,
      needsListsUpdatedCount: needsListsToUpdate.size,
    });
  } catch (error: unknown) {
    console.error("[reconcile/apply POST] Error:", error);
    const msg = error instanceof Error ? error.message : "Error inesperado al aplicar conciliación";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
