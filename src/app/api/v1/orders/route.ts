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
  machine_id: number | null;
};

export async function GET(request: Request) {
  try {
    const { error: authError, session } = await requirePermission('orders', 'view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'active';

    // Obtener información del usuario actual para determinar si es jefe de departamento
    const { data: currentUserData } = await supabaseAdmin
      .from('users')
      .select('id, department_id, is_department_head')
      .eq('id', session!.userId)
      .single();

    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, store_id, machine_id, total, currency, status, applicant_id, items, payment_type, is_urgent, is_definitive_rejection');

    if (session!.role !== 'admin') {
      if (currentUserData?.is_department_head && currentUserData?.department_id) {
        // Jefes de departamento ven:
        // 1. Sus propias órdenes
        // 2. Órdenes de otros usuarios del mismo departamento
        // 3. Órdenes que tienen aprobación en su departamento

        // Obtener todos los usuarios del mismo departamento
        const { data: deptUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('department_id', currentUserData.department_id);

        const deptUserIds = deptUsers?.map(u => u.id).filter(Boolean) || [];

        // Obtener órdenes que requieren aprobación de su departamento
        const { data: pendingApprovalOrderIds } = await supabaseAdmin
          .from('order_approvals')
          .select('order_id')
          .eq('department_id', currentUserData.department_id);

        const orderIdsFromApprovals = pendingApprovalOrderIds?.map(a => a.order_id).filter(Boolean) || [];

        // Construir filtro OR con: órdenes del departamento + órdenes de aprobación
        const orFilters: string[] = [];

        if (deptUserIds.length > 0) {
          orFilters.push(`applicant_id.in.(${deptUserIds.join(',')})`);
        } else {
          orFilters.push(`applicant_id.eq.${session!.userId}`);
        }

        if (orderIdsFromApprovals.length > 0) {
          orFilters.push(`id.in.(${orderIdsFromApprovals.join(',')})`);
        }

        query = query.or(orFilters.join(','));
      } else {
        query = query.eq('applicant_id', session!.userId);
      }
    }

    if (tab === 'active') {
      query = query.neq('status', 'completed');
    } else if (tab === 'history') {
      query = query.eq('status', 'completed');
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
    const machineIds = [...new Set(orders.map((o: { machine_id: number | null }) => o.machine_id).filter(Boolean))];
    const orderIds = (orders as SupabaseOrder[]).map((o) => o.id);

    // Ejecutar TODAS las queries de enrichment en paralelo
    const [
      { data: stores },
      { data: users },
      { data: machines },
      { data: allDepts },
      { data: allPendingApprovals },
      deptApprovalsResult,
    ] = await Promise.all([
      supabaseAdmin.from('stores').select('id, name').in('id', storeIds),
      supabaseAdmin.from('users').select('id, full_name, department_id, is_department_head').in('id', userIds),
      machineIds.length > 0
        ? supabaseAdmin.from('machines').select('id, name').in('id', machineIds)
        : Promise.resolve({ data: [] as { id: number; name: string }[] }),
      supabaseAdmin.from('departments').select('id, name'),
      orderIds.length > 0
        ? supabaseAdmin.from('order_approvals').select('order_id, department_id, approval_order').in('order_id', orderIds).eq('status', 'pending')
        : Promise.resolve({ data: [] as { order_id: string; department_id: string; approval_order: number }[] }),
      currentUserData?.is_department_head && currentUserData?.department_id && orderIds.length > 0
        ? supabaseAdmin.from('order_approvals').select('order_id, status, department_id').eq('department_id', currentUserData.department_id).in('order_id', orderIds)
        : Promise.resolve({ data: [] as { order_id: string; status: string; department_id: string }[] }),
    ]);

    const storesMap = new Map(stores?.map(s => [s.id, s.name]) || []);
    const usersMap = new Map(users?.map(u => [u.id, u.full_name]) || []);
    const machinesMap = new Map(machines?.map(m => [m.id, m.name]) || []);
    const allDeptsMap = new Map(allDepts?.map(d => [d.id, d.name]) || []);

    const currentDeptMap = new Map<string, { order: number, name: string }>();
    if (allPendingApprovals) {
      allPendingApprovals.forEach((a: any) => {
        const existing = currentDeptMap.get(a.order_id);
        if (!existing || a.approval_order < existing.order) {
           currentDeptMap.set(a.order_id, {
             order: a.approval_order,
             name: allDeptsMap.get(a.department_id) || 'Desconocido'
           });
        }
      });
    }

    const userDeptApprovals = new Map();
    const deptApprovals = 'data' in deptApprovalsResult ? deptApprovalsResult.data : deptApprovalsResult;
    if (deptApprovals) {
      (deptApprovals as any[]).forEach(a => {
        userDeptApprovals.set(a.order_id, a.status);
      });
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
      
        const uniqueSuppliers = new Set<string>();
        itemsArray.forEach(item => {
          if (item.proveedor) uniqueSuppliers.add(item.proveedor);
          if (item.supplier_name) uniqueSuppliers.add(item.supplier_name);
        });

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
        current_department_name: currentDeptMap.get(order.id)?.name || null,
        machine_name: order.machine_id ? machinesMap.get(order.machine_id) || null : null,
        suppliers: Array.from(uniqueSuppliers),
        materials: itemsArray.map(item => item.nombre).filter(Boolean),
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
