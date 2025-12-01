import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('📦 Datos recibidos para crear orden:', body);
    
    const {
      applicant_name,
      store_name,
      supplier_name,
      items,
      justification,
      currency = 'MXN',
      retention,
    } = body;

    // Validaciones básicas
    if (!applicant_name || !store_name || !supplier_name || !items || items.length === 0) {
      console.log('❌ Faltan datos requeridos');
      return NextResponse.json(
        { error: "Faltan datos requeridos para crear la orden" },
        { status: 400 }
      );
    }

    // Buscar el usuario por nombre
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .ilike('full_name', `%${applicant_name}%`)
      .limit(1)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: `No se encontró el usuario: ${applicant_name}` },
        { status: 404 }
      );
    }

    // Buscar el almacén por nombre
    const { data: storeData, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .ilike('name', `%${store_name}%`)
      .limit(1)
      .single();

    if (storeError || !storeData) {
      return NextResponse.json(
        { error: `No se encontró el almacén u obra: ${store_name}` },
        { status: 404 }
      );
    }

    // Buscar el proveedor por nombre
    const { data: supplierData, error: supplierError } = await supabaseAdmin
      .from('suppliers')
      .select('id')
      .ilike('commercial_name', `%${supplier_name}%`)
      .limit(1)
      .single();

    if (supplierError || !supplierData) {
      return NextResponse.json(
        { error: `No se encontró el proveedor: ${supplier_name}` },
        { status: 404 }
      );
    }

    // Calcular totales
    const subtotal = items.reduce((sum: number, item: any) => {
      const cantidad = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precioUnitario) || 0;
      return sum + (cantidad * precio);
    }, 0);

    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    const totalQuantity = items.reduce((sum: number, item: any) => sum + parseFloat(item.cantidad), 0);

    // Preparar los items con precio total calculado
    const itemsWithTotal = items.map((item: any) => ({
      ...item,
      precioTotal: parseFloat(item.cantidad) * parseFloat(item.precioUnitario)
    }));

    // Crear la orden
    const orderData = {
      applicant_id: userData.id,
      store_id: storeData.id,
      date: new Date().toISOString().split('T')[0],
      supplier_id: supplierData.id,
      items: JSON.stringify(itemsWithTotal),
      quantity: totalQuantity,
      unity: items[0]?.unidad || 'pza',
      price_excluding_iva: subtotal,
      price_with_iva: total,
      subtotal: subtotal,
      iva: iva,
      total: total,
      currency: currency,
      justification: justification || '',
      retention: retention || '',
      status: 'PENDIENTE',
    };

    const { data: orderCreated, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([orderData])
      .select()
      .single();

    if (orderError) {
      console.error("❌ Error creating order:", orderError);
      return NextResponse.json(
        { error: "Error al crear la orden de compra" },
        { status: 500 }
      );
    }

    console.log('✅ Orden creada exitosamente:', orderCreated);

    return NextResponse.json({
      success: true,
      order: orderCreated,
      message: "Orden de compra creada exitosamente",
    });

  } catch (error) {
    console.error("Error en crear orden:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
