import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { OrderItem, OrderApprovalForPdf, RETENTION_OPTIONS, calculateRetentions } from '@/types/database';

// Extender jsPDF para incluir lastAutoTable
interface JsPDFWithAutoTable extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.id;

    // Disparar las dos consultas a la DB en paralelo.
    // Antes: 2 awaits secuenciales → O(2 × DB_latency) ≈ 60 ms.
    // Ahora: Promise.all          → O(1 × DB_latency) ≈ 30 ms. Ahorro: ~30 ms/petición.
    const [
      { data: order, error },
      { data: approvals },
    ] = await Promise.all([
      supabaseAdmin
        .from('orders')
        .select(`
          *,
          applicant:users!orders_applicant_id_fkey(full_name, email),
          store:stores!orders_store_id_fkey(name),
          supplier:suppliers!orders_supplier_id_fkey(
            commercial_name,
            social_reason,
            rfc,
            address,
            phone,
            clabe,
            bank,
            contact
          )
        `)
        .eq('id', orderId)
        .single(),
      supabaseAdmin
        .from('order_approvals')
        .select(`
          *,
          department:departments(name, code),
          approver:users(full_name, email)
        `)
        .eq('order_id', orderId)
        .order('approval_order'),
    ]);

    if (error || !order) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    // Pre-construir Map de aprobaciones por approval_order para lookup O(1).
    // Antes: approvals.find(a => a.approval_order === pos.order) dentro del loop → O(N×A).
    // Ahora: approvalByOrder.get(pos.order) → O(1) por acceso. Construcción: O(A).
    const approvalByOrder = new Map<number, OrderApprovalForPdf>(
      ((approvals as OrderApprovalForPdf[] | null) ?? []).map(
        (a: OrderApprovalForPdf) => [a.approval_order as number, a]
      )
    );
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header - Logo y datos de empresa
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('COCONSA CONSTRUCCIONES S.A DE C.V.', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Joaquín Serrano 255 Cd. Industrial Torreón C.P. 27019', pageWidth / 2, 27, { align: 'center' });
    doc.text('RFC: CCO0811261F4 | Tel.: 01(871) 750 74 64 al 67', pageWidth / 2, 32, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ORDEN DE COMPRA', pageWidth / 2, 40, { align: 'center' });
    
    // Línea divisoria
    doc.setLineWidth(0.5);
    doc.line(15, 43, pageWidth - 15, 43);

    // Mapeo de estados a etiquetas en español
    const statusLabels: Record<string, string> = {
      'pending': 'Pendiente',
      'PENDIENTE': 'Pendiente',
      'approved': 'Aprobada',
      'APROBADA': 'Aprobada',
      'rejected': 'Rechazada',
      'RECHAZADA': 'Rechazada',
      'in_progress': 'En Proceso',
      'EN_PROCESO': 'En Proceso',
      'completed': 'Completada',
      'COMPLETADA': 'Completada',
    };

    // Formateador de moneda
    const currency = order.currency || 'MXN';
    const formatMoney = (amount: number) => {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency,
      }).format(amount);
    };

    let yPos = 50;

    // Información general
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`No. Orden: ${order.id}`, 15, yPos);
    doc.text(`Fecha: ${new Date(order.date || order.created_at).toLocaleDateString('es-MX')}`, 120, yPos);
    
    yPos += 8;
    doc.text(`Solicitante: ${order.applicant?.full_name || 'N/A'}`, 15, yPos);
    yPos += 6;
    doc.text(`Almacén/Obra: ${order.store?.name || 'N/A'}`, 15, yPos);
    yPos += 6;
    doc.text(`Estado: ${statusLabels[order.status] || order.status}`, 15, yPos);
    
    yPos += 10;

    // Datos del Proveedor
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DEL PROVEEDOR', 15, yPos);
    yPos += 7;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const proveedorInfo = [
      `Nombre Comercial: ${order.supplier?.commercial_name || 'N/A'}`,
      `Razón Social: ${order.supplier?.social_reason || 'N/A'}`,
      `RFC: ${order.supplier?.rfc || 'N/A'}`,
      `Dirección: ${order.supplier?.address || 'N/A'}`,
      `Teléfono: ${order.supplier?.phone || 'N/A'}`,
      `Banco: ${order.supplier?.bank || 'N/A'}`,
      `CLABE: ${order.supplier?.clabe || 'N/A'}`,
      `Contacto: ${order.supplier?.contact || 'N/A'}`,
    ];

    proveedorInfo.forEach(info => {
      doc.text(info, 15, yPos);
      yPos += 5;
    });

    yPos += 5;

    // Tabla de artículos
    const items: OrderItem[] = JSON.parse(order.items || '[]');
    const tableData = items.map((item: OrderItem) => [
      item.nombre,
      `${item.cantidad} ${item.unidad}`,
      formatMoney(Number(item.precioUnitario)),
      formatMoney(Number(item.precioTotal || 0)),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['ARTÍCULO/SERVICIO', 'CANTIDAD', 'PRECIO UNITARIO', 'TOTAL']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [100, 100, 100], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' },
      },
    });

    yPos = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 10;

    // Justificación
    if (order.justification) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('JUSTIFICACIÓN:', 15, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const splitJustification = doc.splitTextToSize(order.justification, pageWidth - 30);
      doc.text(splitJustification, 15, yPos);
      yPos += (splitJustification.length * 5) + 5;
    }

    // Retención - parse JSON array of keys or show legacy text
    let retentionBreakdown: Array<{ label: string; amount: number }> = [];
    let totalRetention = 0;
    if (order.retention) {
      let retentionKeys: string[] = [];
      try {
        const parsed = JSON.parse(order.retention);
        if (Array.isArray(parsed)) {
          retentionKeys = parsed;
        }
      } catch {
        // Legacy free-text retention - show as-is
      }

      if (retentionKeys.length > 0) {
        const effectiveTaxType = order.tax_type === 'retencion' ? 'con_iva' : order.tax_type;
        const ivaPercentage = order.iva_percentage || 16;
        const subtotal = Number(order.subtotal);
        const ivaAmount = effectiveTaxType === 'con_iva' ? subtotal * (ivaPercentage / 100) : 0;
        const result = calculateRetentions(retentionKeys, subtotal, ivaAmount);
        retentionBreakdown = result.breakdown;
        totalRetention = result.totalRetention;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('RETENCIONES:', 15, yPos);
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        retentionBreakdown.forEach(item => {
          doc.text(`${item.label}: -${formatMoney(item.amount)}`, 15, yPos);
          yPos += 5;
        });
        yPos += 3;
      } else {
        // Legacy free-text retention display
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('RETENCIÓN:', 15, yPos);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(order.retention, 50, yPos);
        yPos += 8;
      }
    }

    // Tipo de pago
    if (order.payment_type) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TIPO DE PAGO:', 15, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const paymentLabel = order.payment_type === 'credito' ? 'Crédito' : order.payment_type === 'de_contado' ? 'De Contado' : order.payment_type;
      doc.text(paymentLabel, 55, yPos);
      yPos += 8;
    }

    // Totales
    yPos += 5;
    const totalsX = pageWidth - 70;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Moneda:', totalsX - 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.currency || 'MXN', totalsX + 10, yPos);
    
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('SUBTOTAL:', totalsX - 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatMoney(Number(order.subtotal)), totalsX + 10, yPos);
    
    if ((order.tax_type === 'con_iva' || order.tax_type === 'retencion') && order.iva > 0) {
      yPos += 6;
      const ivaLabel = `IVA (${order.iva_percentage || 16}%):`;
      doc.setFont('helvetica', 'bold');
      doc.text(ivaLabel, totalsX - 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(formatMoney(Number(order.iva)), totalsX + 10, yPos);
    }

    // Show retention totals in the totals section
    if (retentionBreakdown.length > 0) {
      retentionBreakdown.forEach(item => {
        yPos += 6;
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.label}:`, totalsX - 60, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(`-${formatMoney(item.amount)}`, totalsX + 10, yPos);
      });
    }
    
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsX - 20, yPos);
    doc.text(formatMoney(Number(order.total)), totalsX + 10, yPos);

    // Firmas (al final de la página)
    const signatureY = doc.internal.pageSize.height - 40;
    doc.setLineWidth(0.3);
    
    const signaturePositions = [
      { x: 20, label: 'SOLICITANTE', order: 0 },
      { x: 65, label: 'REVISIÓN\nCONTRALORIA', order: 2 }, // Contraloría
      { x: 120, label: 'REVISIÓN\nGERENTE', order: 1 }, // Gerencia
      { x: 165, label: 'AUTORIZACIÓN\nDIRECCIÓN', order: 3 }, // Dirección
    ];

    // Generar QR para el solicitante con su información
    const applicantInfo = {
      nombre: order.applicant?.full_name || 'N/A',
      email: order.applicant?.email || 'N/A',
      orderId: order.id,
      fecha: new Date(order.created_at).toLocaleDateString('es-MX')
    };
    
    // URL que contendrá la información del solicitante
    const verificationUrl = `${request.url.split('/api')[0]}/verify-applicant?data=${encodeURIComponent(JSON.stringify(applicantInfo))}`;
    
    const qrOptions = {
      width: 200,
      margin: 2,
      errorCorrectionLevel: 'L' as const,
      color: { dark: '#000000', light: '#FFFFFF' },
    };

    // Generar todos los QR en paralelo con Promise.all.
    // Antes: await QRCode.toDataURL() secuencial por cada aprobador → O(N × QR_latency) ≈ 40-200 ms.
    // Ahora: Promise.all([...]) → O(1 × QR_latency) ≈ 10-50 ms. Ahorro: ~100-150 ms/PDF.
    // Usa approvalByOrder.get(pos.order) → O(1) en lugar de .find() → O(A).
    const qrTaskResults = await Promise.all(
      signaturePositions.map(async (pos) => {
        if (pos.order === 0) {
          // QR del solicitante
          const data = await QRCode.toDataURL(verificationUrl, qrOptions);
          return { order: 0, data };
        }
        const approval = approvalByOrder.get(pos.order);
        if (
          approval?.status === 'approved' &&
          approval.approver &&
          (approval.approval_order ?? 0) <= 3
        ) {
          const approverInfo = {
            nombre: approval.approver.full_name,
            email: approval.approver.email,
            departamento: approval.department?.name || 'N/A',
            orderId: order.id,
            fecha: approval.approved_at
              ? new Date(approval.approved_at).toLocaleDateString('es-MX')
              : 'N/A',
            rol: approval.department?.code || 'N/A',
          };
          const approverVerificationUrl = `${request.url.split('/api')[0]}/verify-applicant?data=${encodeURIComponent(JSON.stringify(approverInfo))}`;
          try {
            const data = await QRCode.toDataURL(approverVerificationUrl, qrOptions);
            return { order: pos.order, data };
          } catch {
            return { order: pos.order, data: null };
          }
        }
        return { order: pos.order, data: null };
      })
    );

    // Construir mapa de QR generados
    const qrMap = new Map<number, string>(
      qrTaskResults
        .filter((r) => r.data !== null)
        .map((r) => [r.order, r.data as string])
    );

    signaturePositions.forEach((pos, index) => {
      const qrDataUrl = qrMap.get(pos.order);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', pos.x + 5, signatureY - 35, 25, 25);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        doc.text('Firmado Digitalmente', pos.x + 17.5, signatureY - 37, { align: 'center' });
      }
      void index; // índice no usado tras la refactorización
      
      // Línea para firma
      doc.line(pos.x, signatureY, pos.x + 35, signatureY);
      
      // Etiqueta
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      const lines = pos.label.split('\n');
      lines.forEach((line, idx) => {
        doc.text(line, pos.x + 17.5, signatureY + 5 + (idx * 4), { align: 'center' });
      });
    });

    // Generar el PDF como buffer
    const pdfBuffer = doc.output('arraybuffer');

    // Retornar el PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="orden-compra-${order.id}.pdf"`,
      },
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Error al generar el PDF' },
      { status: 500 }
    );
  }
}
