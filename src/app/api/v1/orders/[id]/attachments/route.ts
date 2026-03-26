import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: attachments, error } = await supabaseAdmin
      .from('order_attachments')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener archivos adjuntos' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      attachments: attachments || []
    });
  } catch (error) {
    console.error('Error in attachments endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
