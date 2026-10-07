import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface UnlinkedItem {
  id: string; // key `${source}_${source_id}_${index}`
  source: "order" | "needs_list";
  source_id: number;
  folio: string;
  item_index: number;
  nombre: string;
  unidad: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  fecha: string;
}

export interface BudgetInsumoRef {
  id: number;
  clave: string;
  descripcion: string;
  unidad: string;
  categoria: string;
  costo_unitario: number;
}

/**
 * GET /api/v1/stores/[id]/budget/reconcile
 * Obtiene los conceptos de órdenes de compra y listas de necesidades sin enlace presupuestal
 * y el catálogo de insumos vigente de la obra.
 */
export async function GET(
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

    // 1. Obtener catálogo actual de store_insumos
    const { data: insumos, error: insumosError } = await supabaseAdmin
      .from("store_insumos")
      .select("id, clave, descripcion, unidad, categoria, costo_unitario")
      .eq("store_id", storeId)
      .eq("activo", true)
      .order("categoria")
      .order("clave");

    if (insumosError) {
      return NextResponse.json({ error: "Error al consultar insumos: " + insumosError.message }, { status: 500 });
    }

    const existingBudgetClaves = new Set((insumos ?? []).map((i) => i.clave.trim().toUpperCase()));

    // 2. Obtener órdenes de compra activas de la obra
    // NOTA: Las órdenes de compra se identifican por su `id` primario en BD (no tienen columna `folio`).
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, items, created_at, status, is_definitive_rejection")
      .eq("store_id", storeId)
      .order("id", { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: "Error al consultar órdenes: " + ordersError.message }, { status: 500 });
    }

    // 3. Obtener listas de necesidades activas de la obra
    const { data: needsLists, error: needsListsError } = await supabaseAdmin
      .from("needs_lists")
      .select("id, folio, items, created_at, status, is_definitive_rejection")
      .eq("store_id", storeId)
      .order("id", { ascending: false });

    if (needsListsError) {
      return NextResponse.json({ error: "Error al consultar listas: " + needsListsError.message }, { status: 500 });
    }

    const unlinkedItems: UnlinkedItem[] = [];

    // Helper para formatear fecha de forma segura
    const formatDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
      } catch {
        return "";
      }
    };

    // Procesar órdenes
    for (const ord of orders ?? []) {
      if (ord.is_definitive_rejection) continue;
      const statusLower = (ord.status || "").toLowerCase().trim();
      if (["rejected", "cancelada", "cancelled"].includes(statusLower)) continue;

      let itemsArr: any[] = [];
      try {
        itemsArr = typeof ord.items === "string" ? JSON.parse(ord.items) : ord.items || [];
      } catch {
        itemsArr = [];
      }

      if (!Array.isArray(itemsArr)) continue;

      const orderFecha = formatDate(ord.created_at);

      itemsArr.forEach((it, idx) => {
        const insumoClave = (it.insumo_clave || it.clave || "").trim();
        const isLinkedToBudget =
          insumoClave &&
          !insumoClave.startsWith("ADIC-") &&
          !insumoClave.startsWith("IND-") &&
          existingBudgetClaves.has(insumoClave.toUpperCase());

        if (!isLinkedToBudget) {
          const nombre = (it.nombre || it.descripcion || "Artículo").trim();
          const cantidad = parseFloat(String(it.cantidad || it.quantity || "0")) || 0;
          const precio = parseFloat(String(it.precioUnitario || it.precio_unitario || "0")) || 0;
          const total = parseFloat(String(it.precioTotal || it.total || (cantidad * precio))) || (cantidad * precio);

          unlinkedItems.push({
            id: `order_${ord.id}_${idx}`,
            source: "order",
            source_id: ord.id,
            folio: `#${ord.id}`,
            item_index: idx,
            nombre,
            unidad: it.unidad || "pza",
            cantidad,
            precio_unitario: precio,
            total,
            fecha: orderFecha,
          });
        }
      });
    }

    // Procesar listas de necesidades
    for (const nl of needsLists ?? []) {
      if (nl.is_definitive_rejection) continue;
      const statusLower = (nl.status || "").toLowerCase().trim();
      if (["rejected", "cancelada", "cancelled"].includes(statusLower)) continue;

      let itemsArr: any[] = [];
      try {
        itemsArr = typeof nl.items === "string" ? JSON.parse(nl.items) : nl.items || [];
      } catch {
        itemsArr = [];
      }

      if (!Array.isArray(itemsArr)) continue;

      const nlFecha = formatDate(nl.created_at);
      const nlFolio = nl.folio ? (nl.folio.startsWith("#") ? nl.folio : nl.folio) : `LN-${nl.id}`;

      itemsArr.forEach((it, idx) => {
        const insumoClave = (it.insumo_clave || it.clave || "").trim();
        const isLinkedToBudget =
          insumoClave &&
          !insumoClave.startsWith("ADIC-") &&
          !insumoClave.startsWith("IND-") &&
          existingBudgetClaves.has(insumoClave.toUpperCase());

        if (!isLinkedToBudget) {
          const nombre = (it.nombre || it.descripcion || "Gasto").trim();
          const cantidad = parseFloat(String(it.cantidad || it.quantity || "0")) || 0;
          const precio = parseFloat(String(it.precioUnitario || it.precio_unitario || "0")) || 0;
          const total = parseFloat(String(it.precioTotal || it.total || (cantidad * precio))) || (cantidad * precio);

          unlinkedItems.push({
            id: `needs_list_${nl.id}_${idx}`,
            source: "needs_list",
            source_id: nl.id,
            folio: nlFolio,
            item_index: idx,
            nombre,
            unidad: it.unidad || "pza",
            cantidad,
            precio_unitario: precio,
            total,
            fecha: nlFecha,
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      totalUnlinked: unlinkedItems.length,
      unlinkedItems,
      budgetInsumos: insumos || [],
    });
  } catch (error: unknown) {
    console.error("[reconcile GET] Error:", error);
    const msg = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/v1/stores/[id]/budget/reconcile
 * Envía los items no vinculados a Gemini 2.5-flash para que analice y proponga:
 * 1. Coincidencias semánticas con insumos reales del presupuesto (ej. "Varilla 3/8" -> "ACERO DE REFUERZO NO. 3")
 * 2. Asignación a Gastos Indirectos (todas las listas de necesidades no presupuestadas)
 * 3. Categorización técnica de compras fuera de presupuesto (Materiales, Equipo, Herramienta, Mano de Obra, Adicionales)
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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "La API key de Gemini no está configurada" }, { status: 500 });
    }

    const body = await request.json();
    const itemsToAnalyze: UnlinkedItem[] = body.items || [];
    const budgetCatalog: BudgetInsumoRef[] = body.budgetInsumos || [];

    if (itemsToAnalyze.length === 0) {
      return NextResponse.json({ success: true, proposals: [] });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // Reducimos el catálogo para el prompt para optimizar tokens
    const simplifiedCatalog = budgetCatalog.map((ins) => ({
      id: ins.id,
      clave: ins.clave,
      descripcion: ins.descripcion,
      unidad: ins.unidad,
      categoria: ins.categoria,
    }));

    const simplifiedItems = itemsToAnalyze.map((it) => ({
      id: it.id,
      source: it.source,
      nombre: it.nombre,
      unidad: it.unidad,
      cantidad: it.cantidad,
      precio: it.precio_unitario,
    }));

    const prompt = `Eres un experto ingeniero de costos y presupuestos en edificación y obra civil de COCONSA (México).
Tu misión es conciliar y clasificar compras históricas de obra contra el catálogo de insumos presupuestados.

CATÁLOGO DE INSUMOS EXISTENTES DEL PRESUPUESTO DE LA OBRA:
${JSON.stringify(simplifiedCatalog, null, 2)}

LISTA DE COMPRAS HISTÓRICAS A CONCILIAR:
${JSON.stringify(simplifiedItems, null, 2)}

INSTRUCCIONES CLAVE DE MATCHING Y CLASIFICACIÓN (MUY ESTRICTAS):
1. BÚSQUEDA DE COINCIDENCIAS CON EL PRESUPUESTO (match_existing):
   - Compara semánticamente el nombre comprado con la descripción técnica del presupuesto.
   - En México, en obra se usan modismos:
     * "Varilla 3/8", "Acero 3/8" -> Corresponde a "ACERO DE REFUERZO NO. 3 (3/8\")"
     * "Varilla 1/2", "Acero 1/2" -> Corresponde a "ACERO DE REFUERZO NO. 4 (1/2\")"
     * "Varilla 5/8", "Acero 5/8" -> Corresponde a "ACERO DE REFUERZO NO. 5 (5/8\")"
     * "Cemento", "Cemento gris", "Cemento tolteca", "Cemento cpc" -> Corresponde a "CEMENTO PORTLAND..."
     * "Arena", "Arena de río" -> Insumo de Arena
     * "Grava", "Grava 3/4" -> Insumo de Grava
     * "Diesel", "Diesel para maquina" -> Insumo de Combustible Diesel
     * "Renta de retro", "Retroexcavadora" -> Insumo de Retroexcavadora en Equipo
     * "Block", "Tabique", "Malla", "Alambre recocido", "Clavos", etc. -> Insumos homólogos en Materiales
   - Si encuentras un insumo que represente razonablemente lo mismo, asigna:
     * "action": "match_existing"
     * "matched_insumo_id": id del insumo encontrado
     * "matched_clave": clave del insumo encontrado
     * "category": categoria del insumo encontrado
     * "confidence": número entre 60 y 98
     * "reasoning": "Coincide con [descripción resumida]"

2. SI NO EXISTE EN EL PRESUPUESTO:
   A) Si proviene de lista de necesidades ("source": "needs_list"):
      - Las listas de necesidades son compras menores, reembolsos y consumibles de campo.
      - Asignar SIEMPRE a la categoría "Gastos Indirectos":
        * "action": "create_new"
        * "category": "Gastos Indirectos"
        * "confidence": 95
        * "reasoning": "Gasto de lista de necesidades clasificado como Gasto Indirecto"
   B) Si proviene de orden de compra ("source": "order"):
      - Clasificar en su verdadera categoría de construcción:
        * "Materiales": si es un insumo físico de obra (block, arena, pintura, perfiles, etc.)
        * "Equipo": si es maquinaria, renta de camión, fletes, revolvedoras, etc.
        * "Herramienta": palas, carretillas, discos, brocas, equipo de protección (EPP), etc.
        * "Mano de Obra": si es destajo, raya, cuadrilla, albañil.
        * "Gastos Indirectos": consumibles de oficina de obra, viáticos, copias, papelería.
        * "Adicionales": únicamente si explícitamente se menciona como concepto extraordinario o adicional.
      - Asignar:
        * "action": "create_new"
        * "category": Nombre de la categoría
        * "confidence": número entre 75 y 90
        * "reasoning": "Clasificado técnicamente en [categoría]"

Debes devolver ÚNICAMENTE un array JSON válido con la siguiente estructura:
[
  {
    "id": "identificador_exacto_del_item",
    "action": "match_existing" | "create_new",
    "matched_insumo_id": number | null,
    "matched_clave": string | null,
    "category": string,
    "confidence": number,
    "reasoning": string
  }
]`;

    const result = await model.generateContent([prompt]);
    const rawText = result.response.text().trim();
    const cleanedJsonStr = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const proposals = JSON.parse(cleanedJsonStr);

    return NextResponse.json({
      success: true,
      proposals,
    });
  } catch (error: unknown) {
    console.error("[reconcile POST] Error:", error);
    const msg = error instanceof Error ? error.message : "Error al analizar con IA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
