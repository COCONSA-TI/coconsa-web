import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // Validar autenticacion
    const { error: authError } = await requirePermission('orders', 'view');
    if (authError) return authError;

    const { fileName, contentType, bucket = 'Coconsa', folder = 'orders/staging' } = await request.json();
    
    if (!fileName || !contentType) {
      return NextResponse.json({ error: "Faltan datos del archivo" }, { status: 400 });
    }

    // Ruta segura en storage 
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${timestamp}_${sanitizedName}`;

    // Generar la presigned URL de tipo PUT para que el browser haga upload directo
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("[Storage] Error generando url firmada:", error);
      return NextResponse.json({ error: "Error interno generando URL de subida" }, { status: 500 });
    }

    // Calcular URL pública para guardarla luego en BD
    const { data: publicUrlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      path: path,
      publicUrl: publicUrlData.publicUrl
    });

  } catch (error) {
    console.error("[Storage] Error inesperado en presigned url:", error);
    return NextResponse.json({ error: "Error procesando la peticion" }, { status: 500 });
  }
}
