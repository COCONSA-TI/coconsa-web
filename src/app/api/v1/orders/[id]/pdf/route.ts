import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;

    // Obtener la orden de la base de datos con datos relacionados
    const { data: order, error } = await supabaseAdmin
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
      .single();

    if (error || !order) {
      return NextResponse.json(
        { error: 'Orden no encontrada' },
        { status: 404 }
      );
    }

    // Crear el PDF
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
    doc.text(`Estado: ${order.status}`, 15, yPos);
    
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
    const items = JSON.parse(order.items || '[]');
    const tableData = items.map((item: any) => [
      item.nombre,
      `${item.cantidad} ${item.unidad}`,
      `$${Number(item.precioUnitario).toFixed(2)}`,
      `$${Number(item.precioTotal).toFixed(2)}`,
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

    yPos = (doc as any).lastAutoTable.finalY + 10;

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

    // Retención
    if (order.retention) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('RETENCIÓN:', 15, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(order.retention, 50, yPos);
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
    doc.text(`$${Number(order.subtotal).toFixed(2)}`, totalsX + 10, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('IVA (16%):', totalsX - 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(`$${Number(order.iva).toFixed(2)}`, totalsX + 10, yPos);
    
    yPos += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', totalsX - 20, yPos);
    doc.text(`$${Number(order.total).toFixed(2)}`, totalsX + 10, yPos);

    // Firmas (al final de la página)
    const signatureY = doc.internal.pageSize.height - 40;
    doc.setLineWidth(0.3);
    
    const signaturePositions = [
      { x: 20, label: 'SOLICITANTE' },
      { x: 65, label: 'REVISIÓN\nCONTROL DE OBRA' },
      { x: 120, label: 'REVISIÓN\nGERENTE CONSTRUCCIÓN' },
      { x: 165, label: 'AUTORIZACIÓN\nDIRECCIÓN' },
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
    
    // Generar código QR
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 80,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    signaturePositions.forEach((pos, index) => {
      // Si es el solicitante (index 0), agregar el QR
      if (index === 0) {
        // Insertar código QR más arriba
        doc.addImage(qrCodeDataUrl, 'PNG', pos.x + 5, signatureY - 35, 25, 25);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'italic');
        doc.text('Escanea para verificar', pos.x + 17.5, signatureY - 37, { align: 'center' });
      }
      
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
    console.error('Error generando PDF:', error);
    return NextResponse.json(
      { error: 'Error al generar el PDF' },
      { status: 500 }
    );
  }
}
