'use server';

import { z } from 'zod';
import { Resend } from 'resend';
import { redirect } from 'next/navigation';
import QuotationEmail from '@/components/emails/QuotationEmail'; 
import ConfirmationEmail from '@/components/emails/ConfirmationEmail';
import { ContactFormSchema } from './schemas';
import React from 'react';
import ContactFormEmail from '@/components/emails/ContactFormEmail';

const resend = new Resend(process.env.RESEND_API_KEY);
const salesEmail = process.env.SALES_EMAIL as string;
const fromEmail = process.env.FROM_EMAIL as string;

if (!salesEmail || !fromEmail) {
  throw new Error('Las variables de entorno SALES_EMAIL y FROM_EMAIL deben estar definidas');
}

const QuotationSchema = z.object({
  name: z.string().min(3, { message: 'El nombre debe tener al menos 3 caracteres.' }),
  email: z.string().email({ message: 'Por favor, introduce un correo electrónico válido.' }),
    phone: z.string()
    .regex(/^[0-9]+$/, { message: "El teléfono solo debe contener números." })
    .min(10, { message: 'El teléfono debe tener al menos 10 dígitos.' }),
  company: z.string().optional(),
  items: z.array(z.object({
    id: z.string(),
    quantity: z.number().min(1, "La cantidad no puede ser cero.").max(10, "No puedes solicitar más de 10 unidades del mismo equipo."),
  })).min(1, { message: "Debes seleccionar al menos una máquina." }),
  dateRange: z.object({
    from: z.date(),
    to: z.date().optional(),
  }).refine(data => data.from, { message: "Debes seleccionar una fecha de inicio." }),
});

export type FormState = {
  message: string;
  errors?: {
    [key: string]: string[] | undefined;
  };
};

export async function sendQuotation(prevState: FormState, formData: FormData): Promise<FormState> {
  const rawFormData = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
    phone: formData.get('phone') as string,
    company: formData.get('company') as string || '',
    items: JSON.parse(formData.get('items') as string || '[]'),
    dateRange: (() => {
      const range = JSON.parse(formData.get('dateRange') as string || '{}');
      return {
        from: range.from ? new Date(range.from) : new Date(),
        to: range.to ? new Date(range.to) : undefined,
      };
    })(),
  };

  const validatedFields = QuotationSchema.safeParse(rawFormData);

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return {
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, email, phone, company, items, dateRange } = validatedFields.data;

  try {
        // 2. Prepara ambos correos y envíalos en paralelo

        const formattedDateRange = {
          from: dateRange.from.toISOString(),
          to: dateRange.to?.toISOString() || dateRange.from.toISOString()
        };

        const quotationEmailElement = QuotationEmail({ 
          name, 
          company: company || 'N/A', 
          email, 
          phone, 
          items, 
          dateRange: formattedDateRange 
        }) as React.ReactElement;
        
        const confirmationEmailElement = ConfirmationEmail({ 
          name, 
          items 
        }) as React.ReactElement;

        const sendToSales = resend.emails.send({
            from: fromEmail,
            to: [salesEmail],
            subject: `Nueva Solicitud de Cotización de ${name}`,
            react: quotationEmailElement,
        });

        const sendToCustomer = resend.emails.send({
            from: fromEmail,
            to: [email],
            subject: 'Confirmación de tu Solicitud de Cotización - COCONSA',
            react: confirmationEmailElement,
        });

        const [salesResult, customerResult] = await Promise.all([sendToSales, sendToCustomer]);

        if (salesResult.error) {
            console.error("Error sending to sales:", salesResult.error);
            return { 
              message: 'No se pudo enviar la cotización a ventas.',
              errors: { form: ['Error al enviar el correo a ventas.'] }
            };
        }
        if (customerResult.error) {
            console.error("Error sending to customer:", customerResult.error);
        }

    } catch (exception) {
        console.error("ERROR AL ENVIAR CORREOS:", exception);
        return { 
          message: 'Ocurrió un error inesperado al enviar los correos.',
          errors: { form: ['Error interno del servidor.'] }
        };
    }
    redirect('/gracias');
}

export async function sendContactMessage(prevState: unknown, formData: FormData) {
  const validatedFields = ContactFormSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    message: formData.get('message'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, email, phone, message } = validatedFields.data;
  
  try {
    const contactFormEmailElement = await ContactFormEmail({ name, email, phone, message });

    await resend.emails.send({
      from: fromEmail,
      to: [salesEmail],
      subject: `Nuevo Mensaje de Contacto de ${name}`,
      replyTo: email,
      react: contactFormEmailElement,
    });

    return { success: true, message: '¡Mensaje enviado con éxito!' };
  } catch (error) {
    console.error('Error al enviar mensaje de contacto:', error);
    return { success: false, message: 'No se pudo enviar el mensaje. Inténtalo de nuevo.' };
  }
}