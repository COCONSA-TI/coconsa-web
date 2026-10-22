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
  is_piecework: boolean;
  has_extra_budget_approval?: boolean;
  extra_budget_items_count?: number;
};

export async function GET(request: Request) {
  try {
    const { error: authError, session } = await requirePermission('orders', 'view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'active';

    // Obtener información del usuario actual para determinar permisos y centros de costos
    const { data: currentUserData } = await supabaseAdmin
      .from('users')
      .select('id, department_id, is_department_head, all_stores_access, can_view_all_store_orders')
      .eq('id', session!.userId)
      .single();

    // Obtener centros de costos asignados al usuario
    const { data: userStoreRows } = await supabaseAdmin
      .from('user_stores')
      .select('store_id')
      .eq('user_id', session!.userId);

    const assignedStoreIds = (userStoreRows || []).map((r) => r.store_id);
    const hasAllStoresAccess = currentUserData?.all_stores_access ?? (session!.role === 'admin' && assignedStoreIds.length === 0);
    const canViewAllStoreOrders = currentUserData?.can_view_all_store_orders ?? false;

    // Si el usuario no tiene acceso global y no tiene centros de costos asignados, no ve ninguna orden
    if (!hasAllStoresAccess && assignedStoreIds.length === 0) {
      return NextResponse.json({
        success: true,
        orders: [],
        count: 0,
      });
    }

    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, store_id, machine_id, total, currency, status, applicant_id, items, payment_type, is_urgent, is_definitive_rejection, is_piecework, has_extra_budget_approval, extra_budget_items_count');

    // Restricción por centros de costos si no tiene acceso total
    if (!hasAllStoresAccess) {
      query = query.in('store_id', assignedStoreIds);
    }

    // Restricción por solicitante / departamento
    if (session!.role === 'admin' && hasAllStoresAccess) {
      // Admin con acceso total ve todas las órdenes
    } else if (canViewAllStoreOrders) {
      // Usuario con permiso para ver todas las órdenes de sus centros de costos asignados (activo e histórico)
    } else if (currentUserData?.is_department_head && currentUserData?.department_id) {
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

      // Obtener órdenes que requieren aprobación de su departamento (ordenadas de más reciente a más antigua)
      let approvalOrderQuery = supabaseAdmin
        .from('order_approvals')
        .select('order_id, orders!inner(status)')
        .eq('department_id', currentUserData.department_id)
        .order('order_id', { ascending: false })
        .limit(500);

      if (tab === 'active') {
        approvalOrderQuery = approvalOrderQuery.neq('orders.status', 'completed');
      } else if (tab === 'history') {
        approvalOrderQuery = approvalOrderQuery.eq('orders.status', 'completed');
      }

      const { data: pendingApprovalOrderIds } = await approvalOrderQuery;

      const orderIdsFromApprovals = [...new Set(pendingApprovalOrderIds?.map(a => a.order_id).filter(Boolean) || [])];

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
      // Usuario estándar: solo ve sus propias órdenes
      query = query.eq('applicant_id', session!.userId);
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

    // Dividir orderIds en bloques de 100 para no superar el límite de 1,000 filas de Supabase/PostgREST
    // (cada orden tiene hasta 5-6 filas en order_approvals; 100 órdenes = máx. ~600 filas por bloque)
    const orderIdChunks: string[][] = [];
    for (let i = 0; i < orderIds.length; i += 100) {
      orderIdChunks.push(orderIds.slice(i, i + 100));
    }

    // Ejecutar TODAS las queries de enrichment en paralelo
    const storesPromise = storeIds.length > 0
      ? supabaseAdmin.from('stores').select('id, name, store_type_id, store_type:store_types(code)').in('id', storeIds)
          .then(res => res.error ? supabaseAdmin.from('stores').select('id, name').in('id', storeIds) : res)
      : Promise.resolve({ data: [] as any[] });

    const pendingApprovalsPromise = orderIdChunks.length > 0
      ? Promise.all(
          orderIdChunks.map(chunk =>
            supabaseAdmin
              .from('order_approvals')
              .select('order_id, department_id, approval_order, status')
              .in('order_id', chunk)
              .in('status', ['pending', 'PENDIENTE'])
          )
        ).then(results => ({
          data: results.flatMap(r => r.data || []),
        }))
      : Promise.resolve({ data: [] as { order_id: string; department_id: string; approval_order: number; status: string }[] });

    const deptApprovalsPromise =
      currentUserData?.is_department_head && currentUserData?.department_id && orderIdChunks.length > 0
        ? Promise.all(
            orderIdChunks.map(chunk =>
              supabaseAdmin
                .from('order_approvals')
                .select('order_id, status, department_id')
                .eq('department_id', currentUserData.department_id)
                .in('order_id', chunk)
            )
          ).then(results => ({
            data: results.flatMap(r => r.data || []),
          }))
        : Promise.resolve({ data: [] as { order_id: string; status: string; department_id: string }[] });

    // Ejecutar TODAS las queries de enrichment en paralelo
    const [
      { data: stores },
      { data: users },
      { data: machines },
      { data: allDepts },
      { data: allPendingApprovals },
      deptApprovalsResult,
    ] = await Promise.all([
      storesPromise,
      userIds.length > 0
        ? supabaseAdmin.from('users').select('id, full_name, department_id, is_department_head').in('id', userIds)
        : Promise.resolve({ data: [] as any[] }),
      machineIds.length > 0
        ? supabaseAdmin.from('machines').select('id, name').in('id', machineIds)
        : Promise.resolve({ data: [] as { id: number; name: string }[] }),
      supabaseAdmin.from('departments').select('id, name, code, approval_order'),
      pendingApprovalsPromise,
      deptApprovalsPromise,
    ]);

    const storesMap = new Map(stores?.map((s: any) => [String(s.id), s.name]) || []);
    const storeTypeMap = new Map(stores?.map((s: any) => {
      const typeCode = Array.isArray(s.store_type) ? s.store_type[0]?.code : s.store_type?.code;
      return [String(s.id), typeCode || null];
    }) || []);
    const usersMap = new Map(users?.map(u => [String(u.id), u.full_name]) || []);
    const userDeptIdMap = new Map(users?.map(u => [String(u.id), u.department_id ? String(u.department_id) : null]) || []);
    const machinesMap = new Map(machines?.map(m => [String(m.id), m.name]) || []);
    const allDeptsMap = new Map(allDepts?.map(d => [String(d.id), d.name]) || []);

    const currentDeptMap = new Map<string, { order: number, name: string }>();
    if (allPendingApprovals) {
      allPendingApprovals.forEach((a: any) => {
        const orderKey = String(a.order_id);
        const existing = currentDeptMap.get(orderKey);
        const orderVal = Number(a.approval_order ?? 999);
        if (!existing || orderVal < existing.order) {
           currentDeptMap.set(orderKey, {
             order: orderVal,
             name: allDeptsMap.get(String(a.department_id)) || 'Desconocido'
           });
        }
      });
    }

    const userDeptApprovals = new Map<string, string>();
    const deptApprovals = 'data' in deptApprovalsResult ? deptApprovalsResult.data : deptApprovalsResult;
    if (deptApprovals) {
      (deptApprovals as any[]).forEach(a => {
        userDeptApprovals.set(String(a.order_id), a.status);
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

      const orderIdStr = String(order.id);
      const normalizedStatus = statusMap[order.status] || 'pending';
      let deptName = currentDeptMap.get(orderIdStr)?.name || null;

      // Si la orden está pendiente o en proceso pero no tiene aprobación pendiente registrada (ej. órdenes históricas),
      // resolver el departamento de forma inteligente según el estado y tipo de almacén
      if ((normalizedStatus === 'pending' || normalizedStatus === 'in_progress') && !deptName) {
        const contraloriaDeptName = allDepts?.find(d => d.code === 'contraloria')?.name || 'Contraloría';
        const maquinariaDeptName = allDepts?.find(d => d.code === 'gerencia_maquinaria')?.name || 'Maquinaria';
        const construccionDeptName = allDepts?.find(d => d.code === 'gerencia_construccion')?.name || 'Construcción';

        if (normalizedStatus === 'in_progress') {
          deptName = contraloriaDeptName;
        } else {
          const storeName = storesMap.get(String(order.store_id));
          const storeTypeCode = storeTypeMap.get(String(order.store_id));
          if (storeTypeCode === 'maquinaria' || order.machine_id || (storeName && storeName.toLowerCase().includes('maquinaria'))) {
            deptName = maquinariaDeptName;
          } else if (storeTypeCode === 'obra' || storeName) {
            deptName = construccionDeptName;
          } else {
            const applicantDeptId = userDeptIdMap.get(String(order.applicant_id));
            const applicantDept = applicantDeptId ? allDepts?.find(d => String(d.id) === applicantDeptId) : null;
            if (applicantDept && (applicantDept.approval_order === 1 || applicantDept.code?.startsWith('gerencia'))) {
              deptName = applicantDept.name;
            } else {
              deptName = construccionDeptName;
            }
          }
        }
      }

      return {
        id: order.id,
        created_at: order.created_at,
        store_name: storesMap.get(String(order.store_id)) || 'N/A',
        total: order.total,
        currency: order.currency,
        status: normalizedStatus,
        applicant_name: usersMap.get(String(order.applicant_id)) || 'N/A',
        items_count: itemsArray.length,
        first_item_name: itemsArray.length > 0 ? itemsArray[0].nombre : null,
        payment_type: order.payment_type || null,
        is_urgent: order.is_urgent || false,
        is_definitive_rejection: order.is_definitive_rejection || false,
        is_piecework: order.is_piecework || false,
        has_extra_budget_approval: Boolean(order.has_extra_budget_approval),
        extra_budget_items_count: order.extra_budget_items_count || 0,
        my_department_status: userDeptApprovals.get(orderIdStr) || null,
        current_department_name: (normalizedStatus === 'pending' || normalizedStatus === 'in_progress') ? deptName : null,
        machine_name: order.machine_id ? machinesMap.get(String(order.machine_id)) || null : null,
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
