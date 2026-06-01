import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase/server';

type DepartmentInfo = { id: string; name: string | null; code: string | null };
type ApplicantInfo = {
  id: string;
  full_name: string | null;
  department: DepartmentInfo | DepartmentInfo[] | null;
};

type PendingBalanceRecord = {
  id: number;
  folio: string | null;
  remaining_balance: number | null;
  currency: string | null;
  updated_at: string;
  applicant_id: string;
  applicant: ApplicantInfo | ApplicantInfo[] | null;
};

export async function GET(request: Request) {
  try {
    const { error, session } = await requireAuth();
    if (error) return error;

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get('userId');

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_department_head, department:departments(code)')
      .eq('id', session.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 });
    }

    const department = Array.isArray(userData.department) ? userData.department[0] : userData.department;
    const departmentCode = (department?.code || '').toLowerCase();
    const isContabilidadManager = Boolean(userData.is_department_head) && departmentCode === 'contabilidad';
    const isAdmin = session.role === 'admin';
    const canViewAll = isAdmin || isContabilidadManager;
    const currentUserId = session.userId;

    // Si se proporciona userId, verificar que sea el usuario actual o que tenga permisos para ver todos
    let targetUserId: string | null = null;
    if (userIdParam) {
      if (userIdParam !== currentUserId && !canViewAll) {
        return NextResponse.json(
          { success: false, error: 'No tienes permiso para ver los saldos de otro usuario' },
          { status: 403 }
        );
      }
      targetUserId = userIdParam;
    }

    let query = supabaseAdmin
      .from('needs_lists')
      .select(`
        id,
        folio,
        remaining_balance,
        currency,
        updated_at,
        applicant_id,
        applicant:users!needs_lists_applicant_id_fkey (
          id,
          full_name,
          department:departments (
            id,
            name,
            code
          )
        )
      `)
      .eq('status', 'verified')
      .not('remaining_balance', 'is', null)
      .neq('remaining_balance', 0);

    // Si es usuario regular (no Contabilidad/admin), solo ver sus propios saldos
    if (!canViewAll && !userIdParam) {
      targetUserId = currentUserId;
    }

    if (targetUserId) {
      query = query.eq('applicant_id', targetUserId);
    }

    const { data: lists, error: listsError } = await query;

    if (listsError) {
      console.error('Error fetching pending balances:', listsError);
      return NextResponse.json(
        { success: false, error: 'Error al obtener saldos pendientes' },
        { status: 500 }
      );
    }

    const balancesByUser = new Map<string, {
      user_id: string;
      full_name: string;
      department_name: string | null;
      department_code: string | null;
      list_count: number;
      last_updated_at: string | null;
      totals: Map<string, number>;
    }>();

    const normalizedLists = (lists || []) as PendingBalanceRecord[];

    normalizedLists.forEach((list) => {
      if (!list.applicant) return;
      const applicant = Array.isArray(list.applicant) ? list.applicant[0] : list.applicant;
      if (!applicant) return;
      const departmentInfo = Array.isArray(applicant.department) ? applicant.department[0] : applicant.department;
      const currency = list.currency || 'MXN';
      const amount = Number(list.remaining_balance || 0);

      if (!balancesByUser.has(applicant.id)) {
        balancesByUser.set(applicant.id, {
          user_id: applicant.id,
          full_name: applicant.full_name || 'Sin nombre',
          department_name: departmentInfo?.name || null,
          department_code: departmentInfo?.code || null,
          list_count: 0,
          last_updated_at: null,
          totals: new Map<string, number>(),
        });
      }

      const entry = balancesByUser.get(applicant.id)!;
      entry.list_count += 1;
      entry.last_updated_at =
        !entry.last_updated_at || list.updated_at > entry.last_updated_at
          ? list.updated_at
          : entry.last_updated_at;

      entry.totals.set(currency, (entry.totals.get(currency) || 0) + amount);
    });

    const users = Array.from(balancesByUser.values())
      .map((entry) => {
        const totals = Array.from(entry.totals.entries())
          .map(([currency, amount]) => ({
            currency,
            amount: Math.round(amount * 100) / 100,
          }))
          .sort((a, b) => a.currency.localeCompare(b.currency));

        const totalPending = totals.reduce((sum, item) => sum + item.amount, 0);

        return {
          user_id: entry.user_id,
          full_name: entry.full_name,
          department_name: entry.department_name,
          department_code: entry.department_code,
          list_count: entry.list_count,
          last_updated_at: entry.last_updated_at,
          totals,
          total_pending: Math.round(totalPending * 100) / 100,
        };
      })
      .sort((a, b) => Math.abs(b.total_pending) - Math.abs(a.total_pending));

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('Error in pending balances users endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
