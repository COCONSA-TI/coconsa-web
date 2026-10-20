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

    // Helper para consultar stores con store_types (o fallback a solo id, name si aún no corre la migración)
    const fetchStoresData = async (filterIds?: number[]) => {
      let query = supabaseAdmin
        .from("stores")
        .select("id, name, store_type_id, store_type:store_types(id, code, name)")
        .order("name");
      if (filterIds && filterIds.length > 0) {
        query = query.in("id", filterIds);
      }
      const res = await query;
      if (!res.error) return res.data || [];

      // Fallback seguro si la tabla store_types aún no existe en Supabase
      let fallbackQuery = supabaseAdmin
        .from("stores")
        .select("id, name")
        .order("name");
      if (filterIds && filterIds.length > 0) {
        fallbackQuery = fallbackQuery.in("id", filterIds);
      }
      const fallbackRes = await fallbackQuery;
      return fallbackRes.data || [];
    };

    let stores: any[] = [];

    if (forceAllForAdmin) {
      // Admin solicitando catálogo completo para configuración
      stores = await fetchStoresData();
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

      if (!hasAllStoresAccess) {
        if (assignedStoreIds.length === 0) {
          stores = [];
        } else {
          stores = await fetchStoresData(assignedStoreIds);
        }
      } else {
        stores = await fetchStoresData();
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
