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

    const { data: units, error } = await supabaseAdmin
      .from("units")
      .select("id, name, abbreviation")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching units:", error);
      return NextResponse.json(
        { error: "Error al obtener unidades", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ units: units || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: "Error al obtener datos", details: message },
      { status: 500 }
    );
  }
}
