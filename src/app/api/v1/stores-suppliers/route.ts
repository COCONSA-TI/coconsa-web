import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

const MACHINE_STORE_CODE_REGEX = /^(M|CG|AT|C|V)\s*0*(\d+)/i;
const isMachineStore = (storeName: string) => {
  if (!storeName) return false;
  const trimmed = storeName.trim();
  if (MACHINE_STORE_CODE_REGEX.test(trimmed)) return true;
  const extraMachines = ["Mercedez Benz", "Dodge Journey", "Kia Sportage", "Hyundai Palisade"];
  return extraMachines.some(m => trimmed.toLowerCase().includes(m.toLowerCase()));
};

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado. Debes iniciar sesión." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const forceAllForAdmin = searchParams.get("all") === "true" && session.role === "admin";

    let stores: Array<{ id: number; name: string }> = [];

    if (forceAllForAdmin) {
      // Admin solicitando catálogo completo para configuración
      const { data: allStores, error: allStoresErr } = await supabaseAdmin
        .from("stores")
        .select("id, name")
        .order("name");

      if (allStoresErr) {
        return NextResponse.json(
          { error: "Error al obtener almacenes", details: allStoresErr.message },
          { status: 500 }
        );
      }
      stores = allStores || [];
    } else {
      // Consultar permisos y asignaciones del usuario
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("all_stores_access")
        .eq("id", session.userId)
        .single();

      const { data: userStoreRows } = await supabaseAdmin
        .from("user_stores")
        .select("store_id")
        .eq("user_id", session.userId);

      const assignedStoreIds = (userStoreRows || []).map((r) => r.store_id);
      const hasAllStoresAccess = userData?.all_stores_access ?? (session.role === "admin" && assignedStoreIds.length === 0);

      let storesQuery = supabaseAdmin
        .from("stores")
        .select("id, name")
        .order("name");

      if (!hasAllStoresAccess) {
        if (assignedStoreIds.length === 0) {
          // Usuario sin centros de costos asignados: lista vacía
          stores = [];
        } else {
          storesQuery = storesQuery.in("id", assignedStoreIds);
          const { data: filteredStores, error: storesError } = await storesQuery;
          if (storesError) {
            return NextResponse.json(
              { error: "Error al obtener almacenes", details: storesError.message },
              { status: 500 }
            );
          }
          stores = filteredStores || [];
        }
      } else {
        const { data: allStores, error: storesError } = await storesQuery;
        if (storesError) {
          return NextResponse.json(
            { error: "Error al obtener almacenes", details: storesError.message },
            { status: 500 }
          );
        }
        stores = allStores || [];
      }
    }

    // Obtener lista de proveedores disponibles
    const { data: suppliers, error: suppliersError } = await supabaseAdmin
      .from("suppliers")
      .select("id, commercial_name")
      .order("commercial_name");

    if (suppliersError) {
      return NextResponse.json(
        { error: "Error al obtener proveedores", details: suppliersError.message },
        { status: 500 }
      );
    }

    // Obtener catálogo de máquinas (si existe)
    let machines: Array<{ id: string | number; name: string }> = [];
    const { data: machinesData, error: machinesError } = await supabaseAdmin
      .from("machines")
      .select("*")
      .order("name");

    if (!machinesError && Array.isArray(machinesData)) {
      machines = machinesData
        .map((machine: Record<string, unknown>) => {
          const id = machine.id as string | number | undefined;
          const rawName = machine.name ?? machine.machine_name ?? machine.nombre;
          const name = typeof rawName === "string" ? rawName.trim() : "";
          if (!id || !name) return null;
          return { id, name };
        })
        .filter((machine): machine is { id: string | number; name: string } => machine !== null);
    }

    const filteredStores = (stores || []).filter(store => 
      !isMachineStore(store.name) && 
      !store.name.trim().startsWith("[INACTIVO]") &&
      (store as any).is_active !== false
    );

    return NextResponse.json({
      stores: filteredStores,
      suppliers: suppliers || [],
      machines,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: "Error al obtener datos", details: message },
      { status: 500 }
    );
  }
}
