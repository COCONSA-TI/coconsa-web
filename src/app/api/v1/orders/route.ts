import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { use } from "react";


//interfaces
interface OrderItem {
  nombre: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  precioTotal: number;
  proveedor?: string;
  supplier_name?: string;
}

type SupabaseOrder = {
  id: string;
  created_at: string;
  store_id: number;
  total: number;
  currency: string;
  status: string;
  applicant_id: string;
  items: string;
};

export async function GET(request: Request) {
  try {
    const { error: authError, session } = await requirePermission('orders', 'view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, store_id, total, currency, status, applicant_id, items');

    if (session!.role !== 'admin') {
      query = query.eq('applicant_id', session!.userId);
    }

    query = query.order('created_at', { ascending: false });

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      console.error('Error obteniendo órdenes:', ordersError);
      return NextResponse.json(
        { 
          error: "Error al obtener las órdenes",
          details: ordersError.message 
        },
        { status: 500 }
      );
    }

    const storeIds = [...new Set(orders.map((o: { store_id: number }) => o.store_id))];
    const userIds = [...new Set(orders.map((o: { applicant_id: string }) => o.applicant_id))];

    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('id, name')
      .in('id', storeIds);

    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .in('id', userIds);

    const storesMap = new Map(stores?.map(s => [s.id, s.name]) || []);
    const usersMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

    const statusMap: Record<string, string> = {
      'PENDIENTE': 'pending',
      'APROBADA': 'approved',
      'RECHAZADA': 'rejected',
      'EN_PROCESO': 'in_progress',
      'COMPLETADA': 'completed'
    };

    // Formatear órdenes
    const formattedOrders = (orders as SupabaseOrder[]).map((order) => {
      let itemsArray: OrderItem[] = [];
      try {
        if (typeof order.items === 'string' && order.items.trim()) {
          itemsArray = JSON.parse(order.items) as OrderItem[];
        }
      } catch (e) {
        console.error('Error parseando items:', e);
        itemsArray = [];
      }
      
      return {
        id: order.id,
        created_at: order.created_at,
        store_name: storesMap.get(order.store_id) || 'N/A',
        total: order.total,
        currency: order.currency,
        status: statusMap[order.status] || 'pending',
        applicant_name: usersMap.get(order.applicant_id) || 'N/A',
        items_count: itemsArray.length,
      };
    });

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error("Error en GET /api/v1/orders:", error);
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
