import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

interface NeedsListItemForPdf {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
}

interface NeedsListApprovalForPdf {
  approval_order: number | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  department?: { name?: string; code?: string };
  approver?: { full_name?: string; email?: string };
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeNeedsItem(item: unknown): NeedsListItemForPdf {
  const source = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
  const quantity = toSafeNumber(source.quantity ?? source.cantidad);
  const unitPrice = toSafeNumber(source.unit_price ?? source.precioUnitario);
  const providedSubtotal = source.subtotal ?? source.precioTotal;
  const subtotal = providedSubtotal !== undefined
    ? toSafeNumber(providedSubtotal)
    : Math.round(quantity * unitPrice * 100) / 100;

  return {
    description: String(source.description ?? source.nombre ?? source.descripcion ?? 'Concepto').trim() || 'Concepto',
    quantity,
    unit: String(source.unit ?? source.unidad ?? '').trim(),
    unit_price: unitPrice,
    subtotal,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const needsListId = parseInt(id, 10);

    if (Number.isNaN(needsListId)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const [
      { data: needsList, error: needsListError },
      { data: approvals },
    ] = await Promise.all([
      supabaseAdmin
        .from('needs_lists')
        .select(`
          *,
          applicant:users!needs_lists_applicant_id_fkey(full_name, email),
          store:stores(name),
          bank_account:user_bank_accounts(
            bank_name,
            account_number,
            clabe,
            account_type
          )
        `)
        .eq('id', needsListId)
        .single(),
      supabaseAdmin
        .from('needs_list_approvals')
        .select(`
          approval_order,
          status,
          approved_at,
          department:departments(name, code),
          approver:users!needs_list_approvals_approver_id_fkey(full_name, email)
        `)
        .eq('needs_list_id', needsListId)
        .order('approval_order'),
    ]);

    if (needsListError || !needsList) {
      return NextResponse.json({ error: 'Lista de necesidades no encontrada' }, { status: 404 });
    }

    const parsedItemsRaw = (() => {
      try {
        const parsed = JSON.parse(needsList.items || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    const items = parsedItemsRaw.map(normalizeNeedsItem);

    const approvalByOrder = new Map<number, NeedsListApprovalForPdf>(
      ((approvals as NeedsListApprovalForPdf[] | null) ?? [])
        .filter((a) => typeof a.approval_order === 'number')
        .map((a) => [a.approval_order as number, a])
    );

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('COCONSA CONSTRUCCIONES S.A DE C.V.', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Joaquín Serrano 255 Cd. Industrial Torreón C.P. 27019', pageWidth / 2, 27, { align: 'center' });
    doc.text('RFC: CCO0811261F4 | Tel.: 01(871) 750 74 64 al 67', pageWidth / 2, 32, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA DE NECESIDADES', pageWidth / 2, 40, { align: 'center' });
    doc.setLineWidth(0.5);
    doc.line(15, 43, pageWidth - 15, 43);

    let yPos = 50;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Folio: ${needsList.folio || `NL-${needsList.id}`}`, 15, yPos);
    doc.text(`Fecha: ${new Date(needsList.created_at).toLocaleDateString('es-MX')}`, 120, yPos);
    yPos += 8;
    doc.text(`Solicitante: ${needsList.applicant?.full_name || 'N/A'}`, 15, yPos);
    yPos += 6;
    doc.text(`Centro de costos: ${needsList.store?.name || 'N/A'}`, 15, yPos);
    yPos += 8;

    if (needsList.bank_account) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DATOS BANCARIOS', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Titular: ${needsList.applicant?.full_name || 'N/A'}`, 15, yPos);
      yPos += 5;
      doc.text(`Banco: ${needsList.bank_account.bank_name || 'N/A'}`, 15, yPos);
      yPos += 5;
      doc.text(`Cuenta: ${needsList.bank_account.account_number || 'N/A'}`, 15, yPos);
      yPos += 5;
      doc.text(`CLABE: ${needsList.bank_account.clabe || 'N/A'}`, 15, yPos);
      yPos += 5;
      doc.text(`Tipo de cuenta: ${needsList.bank_account.account_type || 'N/A'}`, 15, yPos);
      yPos += 8;
    } else {
      yPos += 2;
    }

    const currency = needsList.currency || 'MXN';
    const formatMoney = (amount: number) =>
      new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount);

    autoTable(doc, {
      startY: yPos,
      head: [['CONCEPTO', 'CANTIDAD', 'P. UNITARIO', 'SUBTOTAL']],
      body: items.map((item) => [
        item.description,
        `${item.quantity} ${item.unit}`.trim(),
        formatMoney(item.unit_price),
        formatMoney(item.subtotal),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 82 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
    });

    yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

    if (needsList.justification) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('JUSTIFICACIÓN:', 15, yPos);
      yPos += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const wrapped = doc.splitTextToSize(needsList.justification, pageWidth - 30);
      doc.text(wrapped, 15, yPos);
      yPos += wrapped.length * 5 + 5;
    }

    const subtotal = toSafeNumber(needsList.subtotal) || items.reduce((sum, item) => sum + item.subtotal, 0);
    const iva = toSafeNumber(needsList.iva);
    const total = toSafeNumber(needsList.total);
    const totalsX = pageWidth - 70;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SUBTOTAL:', totalsX - 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatMoney(subtotal), totalsX + 10, yPos);
    if (iva > 0) {
      yPos += 6;
      doc.setFont('helvetica', 'bold');
      doc.text(`IVA (${needsList.iva_percentage || 16}%):`, totalsX - 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(formatMoney(iva), totalsX + 10, yPos);
    }
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsX - 20, yPos);
    doc.text(formatMoney(total), totalsX + 10, yPos);

    const signatureY = doc.internal.pageSize.height - 42;
    const signaturePositions = [
      { x: 12, label: 'SOLICITANTE', order: 0 },
      { x: 58, label: 'REVISIÓN\nGERENCIA', order: 1 },
      { x: 106, label: 'REVISIÓN\nCONTABILIDAD', order: 2 },
      { x: 154, label: 'AUTORIZACIÓN\nCONTRALORÍA', order: 3 },
    ];

    const applicantInfo = {
      nombre: needsList.applicant?.full_name || 'N/A',
      email: needsList.applicant?.email || 'N/A',
      needsListId: needsList.id,
      folio: needsList.folio || `NL-${needsList.id}`,
      fecha: new Date(needsList.created_at).toLocaleDateString('es-MX'),
      rol: 'solicitante',
    };

    const baseUrl = request.url.split('/api')[0];
    const qrOptions = {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'L' as const,
      color: { dark: '#000000', light: '#FFFFFF' },
    };

    const qrTaskResults = await Promise.all(
      signaturePositions.map(async (pos) => {
        if (pos.order === 0) {
          const verificationUrl = `${baseUrl}/verify-applicant?data=${encodeURIComponent(JSON.stringify(applicantInfo))}`;
          const data = await QRCode.toDataURL(verificationUrl, qrOptions);
          return { order: 0, data };
        }

        const approval = approvalByOrder.get(pos.order);
        if (
          approval?.status === 'approved' &&
          approval.approver?.full_name &&
          approval.approver?.email
        ) {
          const approverInfo = {
            nombre: approval.approver.full_name,
            email: approval.approver.email,
            departamento: approval.department?.name || 'N/A',
            needsListId: needsList.id,
            folio: needsList.folio || `NL-${needsList.id}`,
            fecha: approval.approved_at
              ? new Date(approval.approved_at).toLocaleDateString('es-MX')
              : 'N/A',
            rol: approval.department?.code || 'N/A',
          };
          const verificationUrl = `${baseUrl}/verify-applicant?data=${encodeURIComponent(JSON.stringify(approverInfo))}`;
          const data = await QRCode.toDataURL(verificationUrl, qrOptions);
          return { order: pos.order, data };
        }
        return { order: pos.order, data: null };
      })
    );

    const qrMap = new Map<number, string>(
      qrTaskResults
        .filter((result) => result.data !== null)
        .map((result) => [result.order, result.data as string])
    );

    doc.setLineWidth(0.3);
    signaturePositions.forEach((pos) => {
      const qrDataUrl = qrMap.get(pos.order);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', pos.x + 5, signatureY - 35, 25, 25);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        doc.text('Firmado Digitalmente', pos.x + 17.5, signatureY - 37, { align: 'center' });
      }

      doc.line(pos.x, signatureY, pos.x + 35, signatureY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      pos.label.split('\n').forEach((line, index) => {
        doc.text(line, pos.x + 17.5, signatureY + 5 + index * 4, { align: 'center' });
      });
    });

    const pdfBuffer = doc.output('arraybuffer');
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="lista-necesidades-${needsList.folio || needsList.id}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Error al generar el PDF' }, { status: 500 });
  }
}
