import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase/server";

// Función para crear aprobaciones en el servidor
async function createOrderApprovalsServer(orderId: string, applicantDepartmentId: string, applicantId: string) {
  // Obtener información del solicitante
  const { data: applicant, error: applicantError } = await supabaseAdmin
    .from('users')
    .select('is_department_head, department_id')
    .eq('id', applicantId)
    .single();

  if (applicantError) {
    throw new Error('Error al obtener información del solicitante');
  }

  const isApplicantDeptHead = applicant?.is_department_head && applicant?.department_id === applicantDepartmentId;

  // Obtener todos los departamentos que requieren aprobación
  const { data: departments, error: deptError } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('requires_approval', true)
    .order('approval_order');

  if (deptError || !departments) {
    throw new Error('Error al obtener departamentos');
  }

  // Crear aprobaciones para cada departamento en el flujo
  const approvalsToCreate = [];

  // 1. Aprobación del departamento del solicitante (gerencia)
  const applicantDept = departments.find((d: any) => d.id === applicantDepartmentId);
  if (applicantDept) {
    // Si el solicitante ES el jefe de su departamento, auto-aprobar su nivel
    approvalsToCreate.push({
      order_id: orderId,
      department_id: applicantDept.id,
      status: isApplicantDeptHead ? 'approved' : 'pending',
      approval_order: applicantDept.approval_order,
      approver_id: isApplicantDeptHead ? applicantId : null,
      approved_at: isApplicantDeptHead ? new Date().toISOString() : null,
      comments: isApplicantDeptHead ? 'Auto-aprobado (solicitante es jefe de departamento)' : null,
    });
  }

  // 2. Aprobaciones para el resto del flujo (contraloría, dirección, contabilidad, pagos)
  const subsequentDepartments = departments.filter(
    (d: any) => d.approval_order > 1
  );

  for (const dept of subsequentDepartments) {
    approvalsToCreate.push({
      order_id: orderId,
      department_id: dept.id,
      status: 'pending',
      approval_order: dept.approval_order,
    });
  }

  const { error: insertError } = await supabaseAdmin
    .from('order_approvals')
    .insert(approvalsToCreate);

  if (insertError) {
    throw new Error('Error al crear aprobaciones: ' + insertError.message);
  }

  // Si se auto-aprobó el primer nivel, actualizar estado de la orden a in_progress
  if (isApplicantDeptHead) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'in_progress' })
      .eq('id', orderId);
  }

  return true;
}

export async function POST(request: Request) {
  try {
    // Verificar permisos de creación
    const { error: authError } = await requirePermission('orders', 'create');
    if (authError) return authError;

    const body = await request.json();
    console.log('Datos recibidos para crear orden:', body);
    
    const {
      applicant_name,
      applicant_id, // ID opcional desde el chatbot
      store_name,
      store_id, // ID opcional desde el chatbot
      items,
      justification,
      currency = 'MXN',
      retention,
    } = body;

    // Validaciones básicas
    if (!applicant_name || !store_name || !items || items.length === 0) {
      console.log('❌ Faltan datos requeridos');
      const missing = [];
      if (!applicant_name) missing.push('Nombre del solicitante');
      if (!store_name) missing.push('Almacén u obra');
      if (!items || items.length === 0) missing.push('Artículos');
      
      return NextResponse.json(
        { error: `Faltan datos requeridos: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validar estructura de items (ahora cada item tiene su proveedor)
    const invalidItems = items.filter((item: any) => 
      !item.nombre || 
      !item.cantidad || 
      !item.unidad || 
      !item.precioUnitario ||
      !item.proveedor ||
      parseFloat(item.cantidad) <= 0 ||
      parseFloat(item.precioUnitario) <= 0
    );

    if (invalidItems.length > 0) {
      console.log('❌ Items inválidos:', invalidItems);
      return NextResponse.json(
        { error: "Algunos artículos tienen datos incompletos o inválidos" },
        { status: 400 }
      );
    }

    // Buscar el usuario por nombre o usar el ID proporcionado
    let userId = applicant_id;
    let userDepartmentId = null;
    
    if (!userId) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, department_id')
        .ilike('full_name', `%${applicant_name}%`)
        .limit(1)
        .single();

      if (userError || !userData) {
        console.log('❌ Usuario no encontrado:', applicant_name, userError);
        return NextResponse.json(
          { 
            error: `No se encontró el usuario "${applicant_name}". Verifica que el nombre esté registrado en el sistema.`,
            details: 'El nombre debe coincidir con un usuario registrado en la base de datos.'
          },
          { status: 404 }
        );
      }
      userId = userData.id;
      userDepartmentId = userData.department_id;
    } else {
      // Si tenemos el ID, obtener el departamento
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('department_id')
        .eq('id', userId)
        .single();
      
      if (userData) {
        userDepartmentId = userData.department_id;
      }
    }

    // Buscar el almacén por nombre o usar el ID proporcionado
    let storeIdToUse = store_id;
    
    if (!storeIdToUse) {
      const { data: storeData, error: storeError } = await supabaseAdmin
        .from('stores')
        .select('id')
        .ilike('name', `%${store_name}%`)
        .limit(1)
        .single();

      if (storeError || !storeData) {
        console.log('❌ Almacén no encontrado:', store_name, storeError);
        return NextResponse.json(
          { 
            error: `No se encontró el almacén u obra "${store_name}". Verifica que esté registrado en el sistema.`,
            details: 'El almacén debe estar dado de alta en la base de datos.'
          },
          { status: 404 }
        );
      }
      storeIdToUse = storeData.id;
    }

    // Agrupar items por proveedor
    const itemsBySupplier: { [key: string]: any[] } = {};
    
    for (const item of items) {
      const supplierKey = item.supplier_name || item.proveedor;
      if (!itemsBySupplier[supplierKey]) {
        itemsBySupplier[supplierKey] = [];
      }
      itemsBySupplier[supplierKey].push(item);
    }

    console.log(`Creando ${Object.keys(itemsBySupplier).length} orden(es) (una por proveedor)`);

    // Crear una orden por cada proveedor
    const createdOrders = [];
    const errors = [];

    for (const [supplierKey, supplierItems] of Object.entries(itemsBySupplier)) {
      try {
        // Buscar el proveedor
        const supplierId = supplierItems[0].supplier_id;
        let finalSupplierId = supplierId;

        if (!finalSupplierId) {
          const { data: supplierData, error: supplierError } = await supabaseAdmin
            .from('suppliers')
            .select('id')
            .ilike('commercial_name', `%${supplierKey}%`)
            .limit(1)
            .single();

          if (supplierError || !supplierData) {
            errors.push(`No se encontró el proveedor "${supplierKey}"`);
            continue;
          }
          finalSupplierId = supplierData.id;
        }

        // Calcular totales para este proveedor
        const subtotal = supplierItems.reduce((sum: number, item: any) => {
          const cantidad = parseFloat(item.cantidad) || 0;
          const precio = parseFloat(item.precioUnitario) || 0;
          return sum + (cantidad * precio);
        }, 0);

        const iva = subtotal * 0.16;
        const total = subtotal + iva;
        const totalQuantity = supplierItems.reduce((sum: number, item: any) => 
          sum + parseFloat(item.cantidad), 0
        );

        // Preparar los items con precio total calculado
        const itemsWithTotal = supplierItems.map((item: any) => ({
          nombre: item.nombre,
          cantidad: parseFloat(item.cantidad),
          unidad: item.unidad,
          precioUnitario: parseFloat(item.precioUnitario),
          precioTotal: parseFloat(item.cantidad) * parseFloat(item.precioUnitario),
          proveedor: supplierKey
        }));

        // Crear la orden
        const orderData = {
          applicant_id: userId,
          store_id: storeIdToUse,
          date: new Date().toISOString().split('T')[0],
          supplier_id: finalSupplierId,
          items: JSON.stringify(itemsWithTotal),
          quantity: totalQuantity,
          unity: supplierItems[0]?.unidad || 'pza',
          price_excluding_iva: subtotal,
          price_with_iva: total,
          subtotal: subtotal,
          iva: iva,
          total: total,
          currency: currency,
          justification: justification || '',
          retention: retention || '',
          status: 'pending',
        };

        const { data: orderCreated, error: orderError } = await supabaseAdmin
          .from('orders')
          .insert([orderData])
          .select()
          .single();

        if (orderError) {
          console.error(`❌ Error creating order for ${supplierKey}:`, orderError);
          errors.push(`Error al crear orden para ${supplierKey}: ${orderError.message}`);
        } else {
          console.log(`✅ Orden creada para ${supplierKey}:`, orderCreated.id);
          createdOrders.push(orderCreated);
          
          // Crear el flujo de aprobaciones automáticamente
          if (userDepartmentId) {
            try {
              await createOrderApprovalsServer(orderCreated.id, userDepartmentId, userId);
              console.log(`✅ Flujo de aprobaciones creado para orden ${orderCreated.id}`);
            } catch (approvalError) {
              console.error(`⚠️ Error creando aprobaciones para orden ${orderCreated.id}:`, approvalError);
              // No fallar la creación de la orden si falla la creación de aprobaciones
            }
          } else {
            console.warn(`⚠️ No se pudo crear flujo de aprobaciones: usuario sin departamento asignado`);
          }
        }
      } catch (error) {
        console.error(`Error procesando proveedor ${supplierKey}:`, error);
        errors.push(`Error procesando ${supplierKey}`);
      }
    }

    // Respuesta
    if (createdOrders.length === 0) {
      return NextResponse.json(
        { 
          error: "No se pudieron crear las órdenes",
          details: errors.join('. ')
        },
        { status: 500 }
      );
    }

    const responseMessage = createdOrders.length === 1
      ? "Orden de compra creada exitosamente"
      : `${createdOrders.length} órdenes de compra creadas exitosamente (una por proveedor)`;

    return NextResponse.json({
      success: true,
      orders: createdOrders,
      order: createdOrders[0], // Para compatibilidad con código existente
      message: responseMessage,
      warnings: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("Error en crear orden:", error);
    return NextResponse.json(
      { 
        error: "Error al procesar la solicitud",
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
