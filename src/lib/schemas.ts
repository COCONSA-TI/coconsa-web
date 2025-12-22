import { z } from 'zod';

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
    recaptchaToken: z.string().optional(),
});

export const LoginSchema = z.object({
    email: z.string().email({ message: 'Por favor, introduce un correo electrónico válido.' }),
    password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres.' }),
    recaptchaToken: z.string(),
});

export type LoginFormData = z.infer<typeof LoginSchema>;

// Schema para el chatbot
export const ChatbotMessageSchema = z.object({
    message: z.string().min(1, { message: 'El mensaje no puede estar vacío.' }),
    conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
    })).optional(),
});

export const ChatbotExtractedDataSchema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    company: z.string().optional(),
    message: z.string().optional(),
    projectType: z.string().optional(),
    budget: z.string().optional(),
    timeline: z.string().optional(),
});

// Schema para datos extraídos de órdenes de compra
export const PurchaseOrderExtractedDataSchema = z.object({
    applicant_name: z.string().nullable().optional(),
    applicant_id: z.string().nullable().optional(),
    store_name: z.string().nullable().optional(),
    store_id: z.number().nullable().optional(),
    supplier_name: z.string().nullable().optional(),
    items: z.array(z.object({
        nombre: z.string(),
        cantidad: z.union([z.string(), z.number()]),
        unidad: z.string(),
        precioUnitario: z.number(),
    })).optional(),
    justification: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    retention: z.string().nullable().optional(),
    isComplete: z.boolean().optional(),
});

export type ChatbotMessage = z.infer<typeof ChatbotMessageSchema>;
export type ChatbotExtractedData = z.infer<typeof ChatbotExtractedDataSchema>;
export type PurchaseOrderExtractedData = z.infer<typeof PurchaseOrderExtractedDataSchema>;