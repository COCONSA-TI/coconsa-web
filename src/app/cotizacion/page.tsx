// src/app/cotizacion/page.tsx
'use client';

import { useActionState, useState } from 'react';
import { useQuotation } from '@/context/QuotationContext';
import { DateRange } from 'react-day-picker';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { format } from 'date-fns';
import { sendQuotation, FormState } from '@/lib/actions';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { QuotationSchema } from '@/lib/schemas';
import { z } from 'zod';


type QuotationFormData = z.infer<typeof QuotationSchema>;
const initialState: FormState = { message: '' };

export default function CotizacionPage() {
  const { items, updateItemQuantity, removeItem } = useQuotation();
  const [range, setRange] = useState<DateRange | undefined>();
  const [state, formAction] = useActionState(sendQuotation, initialState);

  const { register, handleSubmit, formState: { errors } } = useForm<QuotationFormData>({
    resolver: zodResolver(QuotationSchema),
    mode: 'onChange',
  });

  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!/[0-9]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Tab' && e.key !== 'Enter') {
      e.preventDefault();
    }
  };

  const handleQuantityChange = (id: string, value: string) => {
    let quantity = parseInt(value, 10);
    if (isNaN(quantity) || value === '') {
      quantity = 1;
    }
    if (quantity > 10) quantity = 10;
    if (quantity < 1) quantity = 1;
    updateItemQuantity(id, quantity);
  };

  // Formato para mostrar las fechas seleccionadas
  let footer = <p>Por favor, selecciona el primer día.</p>;
  if (range?.from) {
    if (!range.to) {
      footer = <p>{format(range.from, 'PPP', { locale: es })}</p>;
    } else if (range.to) {
      footer = (
        <p>
          {format(range.from, 'PPP', { locale: es })}–{format(range.to, 'PPP', { locale: es })}
        </p>
      );
    }
  }

  if (items.length === 0) {
    return (
      <main className="w-full bg-white min-h-screen">
        <div className="container mx-auto text-center py-24">
            <h1 className="text-3xl font-bold text-black">Tu cotización está vacía</h1>
            <p className="mt-4 text-lg text-black">Añade maquinaria desde nuestro catálogo para solicitar una cotización.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full bg-white min-h-screen">
<div className="container mx-auto px-4 py-16">
  <h1 className="text-6xl font-bold mb-16 text-black text-center tracking-tight">Solicitud de Compra</h1>
  
  <form action={formAction} className="max-w-4xl mx-auto">
    {/* SECCIÓN 1: RESUMEN DE MAQUINARIA */}
    <div className="mb-12">
      <h2 className="text-2xl font-semibold mb-4 text-black">Maquinaria Seleccionada</h2>
      <div className="space-y-4">
        {items.map(item => (
          <div key={item.id} className="flex justify-between items-center border border-gray-200 p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <span className="font-bold text-black">{item.id}</span>
            <div className="flex items-center gap-4">
              <label className="text-gray-600">Cantidad:</label>
              <input
                type="number"
                name={`quantity_${item.id}`}
                value={item.quantity}
                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                className="w-20 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black text-center"
                min="1"
                max="10"
              />
              <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:text-red-700 font-medium">Eliminar</button>
            </div>
          </div>
        ))}
      </div>
      {state.errors?.items && <p className="text-red-500 text-sm mt-1">{state.errors.items[0]}</p>}
    </div>

    {/* SECCIÓN 2: SELECCIÓN DE FECHAS */}
    <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-black">Agendar cita</h2>
        <div className="flex justify-center p-6 border border-gray-200 rounded-lg bg-gray-50">
          <DayPicker
            mode="range"
            selected={range}
            onSelect={setRange}
            footer={footer}
            locale={es}
            numberOfMonths={2}
            disabled={{ before: new Date() }}
            className="bg-white p-4 rounded-lg shadow-sm text-black"
          />
        </div>
        {state.errors?.dateRange && <p className="text-red-500 text-sm mt-1">{state.errors.dateRange[0]}</p>}
    </div>
    
    {/* SECCIÓN 3: DATOS DE CONTACTO */}
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-black">Tus Datos de Contacto</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block mb-2 font-medium text-black">Nombre Completo</label>
          <input 
            type="text"
            id="name"
            {...register("name")}
            className="text-black w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="company" className="block mb-2 font-medium text-black">Empresa (Opcional)</label>
          <input 
            type="text"
            id="company"
            {...register("company")}
            className="text-black w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.company && <p className="text-red-500 text-sm mt-1">{errors.company.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block mb-2 font-medium text-black">Correo Electrónico</label>
          <input 
            type="email"
            id="email"
            {...register("email")}
            className="text-black w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="block mb-2 font-medium text-black">Teléfono</label>
          <input 
            type="tel"
            id="phone"
            {...register("phone")}
            onKeyDown={handlePhoneKeyDown}
            maxLength={10}
            placeholder="##-####-####"
            className={`text-black w-full p-2 border rounded-lg ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
          />
          {state.errors?.phone && <p className="text-red-500 text-sm mt-1">{state.errors.phone[0]}</p>}
        </div>
      </div>
    </div>

    {/* Inputs ocultos para pasar los datos del carrito y fechas al Server Action */}
    <input type="hidden" name="items" value={JSON.stringify(items)} />
    <input type="hidden" name="dateRange" value={JSON.stringify(range) || ''} />

    {/* Mensaje de error general del formulario */}
    {state.message && !state.errors && (
      <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
        {state.message}
      </div>
    )}

    <SubmitButton />
  </form>
</div>
</main>
);
}