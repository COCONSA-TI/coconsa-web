import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";


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
  payment_type: string | null;
  is_urgent: boolean;
  is_definitive_rejection: boolean;
};

export async function GET(request: Request) {
  try {
    const { error: authError, session } = await requirePermission('orders', 'view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _status = searchParams.get('status'); // Reserved for future filtering

    // Obtener información del usuario actual para determinar si es jefe de departamento
    const { data: currentUserData } = await supabaseAdmin
      .from('users')
      .select('id, department_id, is_department_head')
      .eq('id', session!.userId)
      .single();

    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, store_id, total, currency, status, applicant_id, items, payment_type, is_urgent, is_definitive_rejection');

    if (session!.role !== 'admin') {
      if (currentUserData?.is_department_head && currentUserData?.department_id) {
        // Jefes de departamento ven: sus propias órdenes + órdenes que tienen aprobación pendiente en su departamento
        const { data: pendingApprovalOrderIds } = await supabaseAdmin
          .from('order_approvals')
          .select('order_id')
          .eq('department_id', currentUserData.department_id);

        const orderIdsFromApprovals = pendingApprovalOrderIds?.map(a => a.order_id).filter(Boolean) || [];
        
        if (orderIdsFromApprovals.length > 0) {
          // Usar OR: órdenes propias O órdenes que requieren aprobación de su departamento
          query = query.or(`applicant_id.eq.${session!.userId},id.in.(${orderIdsFromApprovals.join(',')})`);
        } else {
          query = query.eq('applicant_id', session!.userId);
        }
      } else {
        query = query.eq('applicant_id', session!.userId);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
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
      .select('id, full_name, department_id, is_department_head')
      .in('id', userIds);

    const storesMap = new Map(stores?.map(s => [s.id, s.name]) || []);
    const usersMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

    // Si el usuario es jefe de departamento, obtener todas las aprobaciones de las órdenes para su departamento
    const userDeptApprovals = new Map();
    if (currentUserData?.is_department_head && currentUserData?.department_id) {
      const { data: approvals } = await supabaseAdmin
        .from('order_approvals')
        .select('order_id, status, department_id')
        .eq('department_id', currentUserData.department_id);
      
      if (approvals) {
        approvals.forEach(a => {
          userDeptApprovals.set(a.order_id, a.status);
        });
      }
    }

    const statusMap: Record<string, string> = {
      // Español
      'PENDIENTE': 'pending',
      'APROBADA': 'approved',
      'RECHAZADA': 'rejected',
      'EN_PROCESO': 'in_progress',
      'COMPLETADA': 'completed',
      // Inglés (ya en formato correcto)
      'pending': 'pending',
      'approved': 'approved',
      'rejected': 'rejected',
      'in_progress': 'in_progress',
      'completed': 'completed'
    };

    // Formatear órdenes
    const formattedOrders = (orders as SupabaseOrder[]).map((order) => {
      let itemsArray: OrderItem[] = [];
      try {
        if (typeof order.items === 'string' && order.items.trim()) {
          itemsArray = JSON.parse(order.items) as OrderItem[];
        }
      } catch {
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
        first_item_name: itemsArray.length > 0 ? itemsArray[0].nombre : null,
        payment_type: order.payment_type || null,
        is_urgent: order.is_urgent || false,
        is_definitive_rejection: order.is_definitive_rejection || false,
        my_department_status: userDeptApprovals.get(order.id) || null,
      };
    });

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
      count: formattedOrders.length
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
