import {email, z} from 'zod';

export const QuotationSchema = z.object({
    name: z.string().min(3, { message: "El nombre es muy corto." }).max(100, { message: "El nombre es muy largo." }),
    email: z.string().email({ message: "Por favor, introduce un correo electrónico válido." }),
    phone: z.string()
        .regex(/^[0-9]+$/, { message: "El teléfono solo debe contener números." })
        .length(10, { message: "El teléfono debe tener exactamente 10 dígitos." }),
    company: z.string().optional(),
});

export const ContactFormSchema = z.object({
    name: z.string().min(3, { message: 'Tu nombre debe tener al menos 3 caracteres.' }),
    email: z.string().email({ message: 'Por favor, introduce un correo válido.' }),
    phone: z.string().optional(),
    message: z.string().min(10, { message: 'Tu mensaje debe tener al menos 10 caracteres.' }),
});