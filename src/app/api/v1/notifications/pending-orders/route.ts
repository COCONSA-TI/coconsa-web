import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { Resend } from 'resend';
import PendingOrdersEmail from '@/components/emails/PendingOrdersEmail';
import React from 'react';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.FROM_EMAIL as string;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coconsa-web.vercel.app';
const logoUrl = `${appUrl}/logo-coconsa.png`;

/**
 * GET /api/v1/notifications/pending-orders
 * 
 * Endpoint tipo cron que envía emails a los jefes de departamento
 * con el resumen de órdenes de compra y listas de necesidades
 * pendientes de su aprobación.
 * 
 * Protegido por CRON_SECRET en el header Authorization.
 * 
 * Diseñado para ejecutarse 2 veces al día (8am y 2pm hora México).
 */
export async function GET(request: Request) {
  try {
    // 1. Verificar autenticación del cron
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET no configurado' },
        { status: 500 }
      );
    }

    // Vercel Cron envía el secret automáticamente en el header Authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // 2. Obtener órdenes de compra activas (no rechazadas definitivamente, no completadas)
    const { data: activeOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .in('status', ['pending', 'in_progress'])
      .eq('is_definitive_rejection', false);

    if (ordersError) {
      console.error('Error obteniendo órdenes:', ordersError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo órdenes' },
        { status: 500 }
      );
    }

    // 3. Obtener listas de necesidades activas
    const { data: activeNeedsLists, error: needsListsError } = await supabaseAdmin
      .from('needs_lists')
      .select('id')
      .in('status', ['pending', 'in_progress'])
      .eq('is_definitive_rejection', false);

    if (needsListsError) {
      console.error('Error obteniendo listas de necesidades:', needsListsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo listas de necesidades' },
        { status: 500 }
      );
    }

    const orderIds = activeOrders?.map(o => o.id) || [];
    const needsListIds = activeNeedsLists?.map(nl => nl.id) || [];

    // Si no hay documentos activos, no hay nada que notificar
    if (orderIds.length === 0 && needsListIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay documentos pendientes',
        emailsSent: 0,
      });
    }

    // 4. Obtener TODAS las aprobaciones de órdenes activas
    let allOrderApprovals: Array<{
      id: string;
      order_id: string;
      department_id: string;
      status: string;
      approval_order: number;
    }> = [];

    if (orderIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('order_approvals')
        .select('id, order_id, department_id, status, approval_order')
        .in('order_id', orderIds);

      if (error) {
        console.error('Error obteniendo aprobaciones de órdenes:', error);
      } else {
        allOrderApprovals = data || [];
      }
    }

    // 5. Obtener TODAS las aprobaciones de listas de necesidades activas
    let allNlApprovals: Array<{
      id: string;
      needs_list_id: number;
      department_id: string;
      status: string;
      approval_order: number;
    }> = [];

    if (needsListIds.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('needs_list_approvals')
        .select('id, needs_list_id, department_id, status, approval_order')
        .in('needs_list_id', needsListIds);

      if (error) {
        console.error('Error obteniendo aprobaciones de LN:', error);
      } else {
        allNlApprovals = data || [];
      }
    }

    // 6. Determinar aprobaciones "activas" por orden
    // Una aprobación es "activa" cuando:
    //   - Su status es 'pending'
    //   - Tiene el menor approval_order entre las pending de esa orden
    //   - Todas las aprobaciones con menor approval_order están 'approved'

    const pendingOrdersByDept = new Map<string, number>(); // department_id -> count

    // Agrupar aprobaciones de órdenes por order_id
    const orderApprovalsMap = new Map<string, typeof allOrderApprovals>();
    for (const approval of allOrderApprovals) {
      const key = approval.order_id;
      if (!orderApprovalsMap.has(key)) {
        orderApprovalsMap.set(key, []);
      }
      orderApprovalsMap.get(key)!.push(approval);
    }

    // Para cada orden, encontrar la aprobación activa
    for (const [, approvals] of orderApprovalsMap) {
      const sorted = approvals.sort((a, b) => a.approval_order - b.approval_order);
      
      for (const approval of sorted) {
        if (approval.status === 'pending') {
          // Verificar que todas las anteriores estén aprobadas
          const previousAll = sorted.filter(a => a.approval_order < approval.approval_order);
          const allPreviousApproved = previousAll.every(a => a.status === 'approved');
          
          if (allPreviousApproved) {
            // Esta es la aprobación activa
            const current = pendingOrdersByDept.get(approval.department_id) || 0;
            pendingOrdersByDept.set(approval.department_id, current + 1);
          }
          break; // Solo la primera pending importa
        }
      }
    }

    // 7. Hacer lo mismo para listas de necesidades
    const pendingNlByDept = new Map<string, number>();

    const nlApprovalsMap = new Map<number, typeof allNlApprovals>();
    for (const approval of allNlApprovals) {
      const key = approval.needs_list_id;
      if (!nlApprovalsMap.has(key)) {
        nlApprovalsMap.set(key, []);
      }
      nlApprovalsMap.get(key)!.push(approval);
    }

    for (const [, approvals] of nlApprovalsMap) {
      const sorted = approvals.sort((a, b) => a.approval_order - b.approval_order);
      
      for (const approval of sorted) {
        if (approval.status === 'pending') {
          const previousAll = sorted.filter(a => a.approval_order < approval.approval_order);
          const allPreviousApproved = previousAll.every(a => a.status === 'approved');
          
          if (allPreviousApproved) {
            const current = pendingNlByDept.get(approval.department_id) || 0;
            pendingNlByDept.set(approval.department_id, current + 1);
          }
          break;
        }
      }
    }

    // 8. Unir todos los department_ids que tienen pendientes
    const allDeptIds = new Set<string>([
      ...pendingOrdersByDept.keys(),
      ...pendingNlByDept.keys(),
    ]);

    if (allDeptIds.size === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay aprobaciones activas pendientes',
        emailsSent: 0,
      });
    }

    // 9. Obtener jefes de departamento activos de los departamentos con pendientes
    const { data: departmentHeads, error: headsError } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name, department_id')
      .in('department_id', Array.from(allDeptIds))
      .eq('is_department_head', true)
      .eq('is_active', true);

    if (headsError) {
      console.error('Error obteniendo jefes de departamento:', headsError);
      return NextResponse.json(
        { success: false, error: 'Error obteniendo jefes de departamento' },
        { status: 500 }
      );
    }

    if (!departmentHeads || departmentHeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No se encontraron jefes de departamento para notificar',
        emailsSent: 0,
      });
    }

    // 10. Obtener nombres de departamentos
    const { data: departments } = await supabaseAdmin
      .from('departments')
      .select('id, name')
      .in('id', Array.from(allDeptIds));

    const deptNameMap = new Map(departments?.map(d => [d.id, d.name]) || []);

    // 11. Enviar emails
    const emailResults: Array<{ email: string; status: string; error?: string }> = [];

    for (const head of departmentHeads) {
      if (!head.email || !head.department_id) continue;

      const ordersCount = pendingOrdersByDept.get(head.department_id) || 0;
      const nlCount = pendingNlByDept.get(head.department_id) || 0;

      // Solo enviar si hay pendientes
      if (ordersCount === 0 && nlCount === 0) continue;

      const deptName = deptNameMap.get(head.department_id) || 'tu departamento';
      const userName = head.full_name || head.email;
      const totalPending = ordersCount + nlCount;

      try {
        const emailElement = PendingOrdersEmail({
          userName,
          pendingOrders: ordersCount,
          pendingNeedsLists: nlCount,
          departmentName: deptName,
          appUrl,
          logoUrl,
        }) as React.ReactElement;

        const { error: sendError } = await resend.emails.send({
          from: fromEmail,
          to: [head.email],
          subject: `📋 Tienes ${totalPending} documento${totalPending !== 1 ? 's' : ''} pendiente${totalPending !== 1 ? 's' : ''} — COCONSA`,
          react: emailElement,
        });

        if (sendError) {
          console.error(`Error enviando email a ${head.email}:`, sendError);
          emailResults.push({ email: head.email, status: 'error', error: sendError.message });
        } else {
          emailResults.push({ email: head.email, status: 'sent' });
        }
      } catch (emailError) {
        console.error(`Error procesando email para ${head.email}:`, emailError);
        emailResults.push({
          email: head.email,
          status: 'error',
          error: emailError instanceof Error ? emailError.message : 'Error desconocido',
        });
      }
    }

    const sentCount = emailResults.filter(r => r.status === 'sent').length;
    const errorCount = emailResults.filter(r => r.status === 'error').length;

    return NextResponse.json({
      success: true,
      message: `Notificaciones enviadas: ${sentCount}, errores: ${errorCount}`,
      emailsSent: sentCount,
      emailErrors: errorCount,
      details: emailResults,
    });

  } catch (error) {
    console.error('Error en endpoint de notificaciones:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
