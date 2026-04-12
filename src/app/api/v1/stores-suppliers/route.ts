import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: "No autorizado. Debes iniciar sesión." },
        { status: 401 }
      );
    }

    // Obtener lista de almacenes disponibles
    const { data: stores, error: storesError } = await supabaseAdmin
      .from("stores")
      .select("id, name")
      .order("name");

    if (storesError) {
      return NextResponse.json(
        { error: "Error al obtener almacenes", details: storesError.message },
        { status: 500 }
      );
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

    return NextResponse.json({
      stores: stores || [],
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
