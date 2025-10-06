                    'use client';

import { useActionState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ContactFormSchema } from '@/lib/schemas';
import { sendContactMessage } from '@/lib/actions';
import { z } from 'zod';

// Define el tipo de datos del formulario
type ContactFormData = z.infer<typeof ContactFormSchema>;

export default function ContactForm() {
  const [state, formAction] = useActionState(sendContactMessage, null);
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ContactFormData>({
    resolver: zodResolver(ContactFormSchema),
    mode: 'onBlur',
  });

  // Cuando el formulario se envía con éxito, resetea los campos
  useEffect(() => {
    if (state?.success) {
      reset();
    }
  }, [state, reset]);

  return (
    <div className="bg-white p-8 rounded-lg shadow-lg">
      <h3 className="text-2xl font-semibold text-gray-800 mb-6">Envíanos un Mensaje</h3>
      <form action={formAction} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nombre Completo</label>
          <input
            id="name"
            {...register('name')}
            className={`text-black mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.name?.message && <p className="text-red-500 text-sm mt-1">{errors.name?.message}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Correo</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            className={`text-black mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.email?.message && <p className="text-red-500 text-sm mt-1">{errors.email?.message}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Teléfono (Opcional)</label>
          <input
            id="phone"
            type="tel"
            {...register('phone')}
            className={`text-black mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">Mensaje</label>
          <textarea
            id="message"
            rows={4}
            {...register('message')}
            className={`text-black mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 ${errors.message ? 'border-red-500' : 'border-gray-300'}`}
          ></textarea>
          {errors.message?.message && <p className="text-red-500 text-sm mt-1">{errors.message?.message}</p>}
        </div>
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-red-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-red-700 transition-colors duration-300 disabled:bg-gray-400"
          >
            {isSubmitting ? 'Enviando...' : 'Enviar Mensaje'}
          </button>
        </div>
        {state?.message && (
          <p className={`text-center font-medium ${state?.success ? 'text-green-500' : 'text-red-500'}`}>
            {state?.message}
          </p>
        )}
      </form>
    </div>
  );
}