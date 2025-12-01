# 🤖 Chatbot con IA - Documentación

## 📋 Descripción

Este chatbot utiliza **Google Gemini AI** para interactuar con usuarios de manera natural y extraer información automáticamente para rellenar formularios.

## ✨ Características

- ✅ **Conversación natural** - El bot habla de forma amigable y conversacional
- ✅ **Extracción automática** - Detecta y extrae información del usuario
- ✅ **Llenado de formularios** - Rellena campos automáticamente
- ✅ **Historial de conversación** - Mantiene contexto entre mensajes
- ✅ **Validación de datos** - Usa Zod para validar la información
- ✅ **Responsive** - Funciona en móvil y escritorio

## 🚀 Configuración

### 1. Obtener API Key de Gemini

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia tu API key

### 2. Configurar Variables de Entorno

Agrega a tu archivo `.env.local`:

```bash
GEMINI_API_KEY=tu_api_key_aqui
```

### 3. Instalar Dependencias

```bash
npm install @google/generative-ai
```

## 📁 Estructura de Archivos

```
src/
├── app/
│   └── api/
│       └── v1/
│           └── bot/
│               └── route.ts          # API del chatbot
├── components/
│   ├── Chatbot.tsx                   # Componente del chat
│   └── ChatbotFormExample.tsx        # Ejemplo de integración
└── lib/
    └── schemas.ts                     # Schemas de validación
```

## 🎯 Uso Básico

### Implementación Simple

```tsx
'use client';

import Chatbot from '@/components/Chatbot';

export default function MyPage() {
  const handleDataExtracted = (data) => {
    console.log('Datos extraídos:', data);
    // Usa los datos aquí
  };

  return (
    <div className="h-screen">
      <Chatbot onFormDataExtracted={handleDataExtracted} />
    </div>
  );
}
```

### Integración con Formulario

```tsx
'use client';

import { useState } from 'react';
import Chatbot from '@/components/Chatbot';

export default function FormPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const handleDataExtracted = (data) => {
    setFormData(prev => ({
      ...prev,
      ...(data.name && { name: data.name }),
      ...(data.email && { email: data.email }),
      ...(data.phone && { phone: data.phone }),
    }));
  };

  return (
    <div>
      <Chatbot onFormDataExtracted={handleDataExtracted} />
      
      <form>
        <input 
          value={formData.name} 
          onChange={(e) => setFormData({...formData, name: e.target.value})}
        />
        {/* Más campos... */}
      </form>
    </div>
  );
}
```

## 🔧 API del Chatbot

### Endpoint

```
POST /api/v1/bot
```

### Request Body

```json
{
  "message": "Hola, quiero información sobre sus servicios",
  "conversationHistory": [
    {
      "role": "user",
      "content": "Mensaje anterior del usuario"
    },
    {
      "role": "assistant",
      "content": "Respuesta anterior del bot"
    }
  ]
}
```

### Response

```json
{
  "success": true,
  "message": "¡Hola! Claro, con gusto te ayudo...",
  "extractedData": {
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "5512345678",
    "company": "Mi Empresa SA",
    "message": "Necesito información sobre construcción",
    "projectType": "Industrial",
    "budget": "500000",
    "timeline": "3 meses"
  },
  "conversationHistory": [
    // Historial actualizado
  ]
}
```

## 📊 Datos Extraídos

El chatbot puede extraer la siguiente información:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre completo del usuario |
| `email` | string | Correo electrónico |
| `phone` | string | Teléfono (10 dígitos) |
| `company` | string | Nombre de la empresa |
| `message` | string | Descripción del proyecto |
| `projectType` | string | Tipo de proyecto |
| `budget` | string | Presupuesto estimado |
| `timeline` | string | Plazo deseado |

## 🎨 Personalización

### Modificar el Prompt del Sistema

Edita `SYSTEM_PROMPT` en `/src/app/api/v1/bot/route.ts`:

```typescript
const SYSTEM_PROMPT = `Eres un asistente virtual de [TU EMPRESA].

Tu objetivo es...

Instrucciones:
1. ...
2. ...
`;
```

### Agregar Nuevos Campos

1. **Actualiza el schema** en `src/lib/schemas.ts`:

```typescript
export const ChatbotExtractedDataSchema = z.object({
  // Campos existentes...
  newField: z.string().optional(),
});
```

2. **Modifica el prompt de extracción** en `route.ts`:

```typescript
const extractionPrompt = `
{
  "name": "...",
  "newField": "nuevo campo o null"
}
`;
```

### Cambiar el Modelo de IA

En `route.ts`, cambia el modelo:

```typescript
// Gemini Flash (rápido y económico)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Gemini Pro (más potente)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
```

## 🧪 Ejemplos de Conversación

### Ejemplo 1: Extracción de Datos Básicos

**Usuario:** "Hola, me llamo Juan Pérez"
**Bot:** "¡Hola Juan! Mucho gusto. ¿Podrías compartirme tu correo electrónico?"

**Usuario:** "Sí, es juan@ejemplo.com"
**Bot:** "Perfecto, Juan. ¿Y cuál es tu número de teléfono?"

**Usuario:** "5512345678"
**Bot:** "Excelente. ¿En qué tipo de proyecto podemos ayudarte?"

### Ejemplo 2: Información Compleja

**Usuario:** "Necesito construir una nave industrial de 2000m² en Monterrey con presupuesto de 5 millones en 6 meses"
**Bot:** "Entendido. Tenemos experiencia en construcción industrial. Para comenzar, ¿podrías compartirme tu nombre completo?"

## 🐛 Solución de Problemas

### Error: "GEMINI_API_KEY no está configurada"

**Solución:** 
1. Verifica que `.env.local` tenga `GEMINI_API_KEY=tu_key`
2. Reinicia el servidor de desarrollo

### El bot no extrae información correctamente

**Soluciones:**
1. Verifica que el usuario proporcione información clara
2. Revisa los logs del servidor para ver la respuesta de Gemini
3. Ajusta el prompt de extracción para ser más específico

### Respuestas lentas

**Soluciones:**
1. Usa `gemini-1.5-flash` en lugar de `gemini-1.5-pro`
2. Reduce `maxOutputTokens` en la configuración
3. Considera implementar streaming de respuestas

### Error de parsing JSON

**Solución:**
Gemini a veces devuelve texto con markdown. El código ya incluye limpieza:

```typescript
extractedText = extractedText
  .replace(/```json\n?/g, "")
  .replace(/```\n?/g, "")
  .trim();
```

## 📈 Métricas y Límites

### Límites de Gemini (Free Tier)

- **15 RPM** (Requests per minute)
- **1,500 RPD** (Requests per day)
- **1 millón de tokens/mes**

### Optimizaciones

1. **Caché de conversaciones** - Almacena en estado local
2. **Debouncing** - Evita múltiples peticiones simultáneas
3. **Límite de mensajes** - Limita el historial a últimos 10 mensajes

## 🔒 Seguridad

### Buenas Prácticas

✅ **Nunca expongas la API key** en el cliente
✅ **Valida todas las entradas** con Zod
✅ **Limita rate limiting** en producción
✅ **Sanitiza datos extraídos** antes de usar
✅ **Implementa timeouts** para peticiones

### Validación de Datos

El código ya incluye validación:

```typescript
const validatedFields = ChatbotMessageSchema.safeParse(body);
if (!validatedFields.success) {
  return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
}
```

## 🚀 Deploy a Producción

### Variables de Entorno en Vercel

```bash
vercel env add GEMINI_API_KEY
```

### Variables de Entorno en Railway

```bash
railway variables set GEMINI_API_KEY=tu_key
```

### Consideraciones

1. **Monitorea el uso** de la API de Gemini
2. **Implementa rate limiting** para evitar abusos
3. **Agrega logging** para debugging
4. **Considera caché** para reducir costos

## 📚 Recursos

- [Documentación de Gemini](https://ai.google.dev/docs)
- [Google AI Studio](https://makersuite.google.com/)
- [Límites y Pricing](https://ai.google.dev/pricing)
- [Best Practices](https://ai.google.dev/docs/best_practices)

## 🤝 Soporte

Si encuentras problemas:

1. Revisa los logs del servidor
2. Verifica la consola del navegador
3. Consulta la documentación de Gemini
4. Revisa los ejemplos en este documento

---

**Última actualización:** Noviembre 2025
**Versión:** 1.0.0
**Estado:** ✅ Producción Ready
