import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

interface OrderItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  precioTotal: number;
  proveedor?: string;
  supplier_name?: string;
}

type DBOrderDetail = {
  id: string;
  created_at: string;
  store_id: number;
  supplier_id: number;
  total: number;
  currency: string;
  status: string;
  applicant_id: string;
  justification: string;
  justification_prove: string | null;
  retention: number | null;
  items: string;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar permisos de visualización
    const { error } = await requirePermission('orders', 'view');
    if (error) return error;

    const { id } = await params;
    const orderId = id;

    // Obtener detalles de la orden
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, created_at, store_id, supplier_id, total, currency, status, applicant_id, justification, justification_prove, retention, items')
      .eq('id', orderId)
      .single();

    if (orderError) {
      return NextResponse.json(
        { 
          error: "Orden no encontrada",
          details: orderError.message 
        },
        { status: 404 }
      );
    }

    const typedOrder = order as DBOrderDetail;

    // Obtener datos relacionados
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('name')
      .eq('id', typedOrder.store_id)
      .single();

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', typedOrder.applicant_id)
      .single();

    const { data: supplier } = await supabaseAdmin
      .from('suppliers')
      .select('commercial_name')
      .eq('id', typedOrder.supplier_id)
      .single();

    // Mapear status de español a inglés
    const statusMap: Record<string, string> = {
      'PENDIENTE': 'pending',
      'APROBADA': 'approved',
      'RECHAZADA': 'rejected',
      'EN_PROCESO': 'in_progress',
      'COMPLETADA': 'completed'
    };

    let itemsArray: OrderItem[] = [];
    try {
      // Parsear items si es string JSON
      if (typeof typedOrder.items === 'string' && typedOrder.items.trim()) {
        itemsArray = JSON.parse(typedOrder.items) as OrderItem[];
      }
    } catch {
      itemsArray = [];
    }

    const supplierName = supplier?.commercial_name || 'N/A';

    // Formatear respuesta
    const orderDetails = {
      id: typedOrder.id,
      created_at: typedOrder.created_at,
      store_name: store?.name || 'N/A',
      supplier_name: supplierName,
      total: typedOrder.total,
      currency: typedOrder.currency,
      status: statusMap[typedOrder.status] || 'pending',
      applicant_name: user?.full_name || 'N/A',
      applicant_email: user?.email || 'N/A',
      justification: typedOrder.justification,
      justification_prove: typedOrder.justification_prove,
      retention: typedOrder.retention,
      items: itemsArray.map((item, index: number) => ({
        id: `${typedOrder.id}-${index}`,
        name: item.nombre || 'N/A',
        quantity: item.cantidad || 0,
        unit: item.unidad || 'N/A',
        unit_price: item.precioUnitario || 0,
        subtotal: item.precioTotal || (item.cantidad * item.precioUnitario) || 0,
        supplier_name: supplierName
      }))
    };

    return NextResponse.json({
      success: true,
      order: orderDetails
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
