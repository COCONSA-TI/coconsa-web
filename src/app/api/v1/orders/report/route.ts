import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { error: authError } = await requirePermission('orders', 'view');
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabaseAdmin
      .from('orders')
      .select('id, created_at, store_id, machine_id, supplier_id, total, currency, status, applicant_id, items, payment_type, is_urgent, is_definitive_rejection, justification');

    if (from) {
      query = query.gte('created_at', `${from}T00:00:00.000Z`);
    }
    if (to) {
      query = query.lte('created_at', `${to}T23:59:59.999Z`);
    }

    query = query.order('created_at', { ascending: false });

    const { data: orders, error: ordersError } = await query;

    if (ordersError) {
      return NextResponse.json({ error: "Error al obtener las órdenes", details: ordersError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return new NextResponse('No hay órdenes en el rango seleccionado', { status: 404 });
    }

    // Obtener relaciones
    const storeIds = [...new Set(orders.map(o => o.store_id))];
    const userIds = [...new Set(orders.map(o => o.applicant_id))];
    const machineIds = [...new Set(orders.map(o => o.machine_id).filter(Boolean))];
    const supplierIds = [...new Set(orders.map(o => o.supplier_id).filter(Boolean))];

    const { data: stores } = await supabaseAdmin.from('stores').select('id, name').in('id', storeIds);
    const { data: users } = await supabaseAdmin.from('users').select('id, full_name').in('id', userIds);
    const { data: machines } = await supabaseAdmin.from('machines').select('id, name').in('id', machineIds);
    const { data: suppliers } = await supabaseAdmin.from('suppliers').select('id, commercial_name').in('id', supplierIds);

    const storesMap = new Map(stores?.map(s => [s.id, s.name]) || []);
    const usersMap = new Map(users?.map(u => [u.id, u.full_name]) || []);
    const machinesMap = new Map(machines?.map(m => [m.id, m.name]) || []);
    const suppliersMap = new Map(suppliers?.map(s => [s.id, s.commercial_name]) || []);

    // CSV header
    const csvRows = [];
    csvRows.push([
      'ID',
      'Fecha',
      'Solicitante',
      'Centro de Costos',
      'Máquina',
      'Proveedor',
      'Justificación',
      'Urgente',
      'Total',
      'Moneda',
      'Estado',
    ].join(','));

    // Status map
    const statusMap: Record<string, string> = {
      pending: "Nuevo",
      approved: "Aprobada",
      rejected: "Rechazada",
      in_progress: "En Proceso",
      completed: "Completada"
    };

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '';
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    // Agregar filas
    for (const order of orders) {
      const row = [
        order.id,
        order.created_at.split('T')[0],
        escapeCsv(usersMap.get(order.applicant_id)),
        escapeCsv(storesMap.get(order.store_id)),
        escapeCsv(machinesMap.get(order.machine_id) || ''),
        escapeCsv(suppliersMap.get(order.supplier_id) || ''),
        escapeCsv(order.justification || ''),
        order.is_urgent ? 'Sí' : 'No',
        order.total,
        order.currency || 'MXN',
        escapeCsv(statusMap[order.status] || order.status),
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');
    // Prepend BOM para Excel UTF-8
    const csvContentWithBOM = '\uFEFF' + csvContent;

    return new NextResponse(csvContentWithBOM, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reporte_ordenes.csv"`,
      },
    });
  } catch (error) {
    console.error('Error in report generation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
