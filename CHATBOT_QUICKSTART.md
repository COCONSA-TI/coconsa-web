# 🤖 Chatbot con Gemini AI - Guía Rápida

## 🚀 Inicio Rápido (3 pasos)

### 1️⃣ Instalar
```bash
npm install @google/generative-ai
```

### 2️⃣ Configurar
Obtén tu API key en [Google AI Studio](https://makersuite.google.com/app/apikey) y agrégala a `.env.local`:
```bash
GEMINI_API_KEY=tu_api_key_aqui
```

### 3️⃣ Usar
```tsx
import Chatbot from '@/components/Chatbot';

export default function Page() {
  return (
    <div className="h-screen">
      <Chatbot onFormDataExtracted={(data) => console.log(data)} />
    </div>
  );
}
```

## 📁 Archivos Creados

```
src/
├── app/api/v1/bot/route.ts          # ⭐ API del chatbot
├── components/
│   ├── Chatbot.tsx                   # ⭐ Componente de chat
│   └── ChatbotFormExample.tsx        # ⭐ Ejemplo completo
└── lib/schemas.ts                    # Schemas actualizados
```

## 🎯 Características

- ✅ Conversación natural con IA
- ✅ Extracción automática de datos
- ✅ Rellena formularios automáticamente
- ✅ Historial de conversación
- ✅ Responsive (móvil y escritorio)
- ✅ TypeScript + Validación con Zod

## 📊 Datos que Extrae

El chatbot puede detectar y extraer:

- 👤 **Nombre completo**
- 📧 **Email**
- 📱 **Teléfono**
- 🏢 **Empresa**
- 💬 **Mensaje/Proyecto**
- 🏗️ **Tipo de proyecto**
- 💰 **Presupuesto**
- 📅 **Plazo**

## 🔧 API Endpoint

```
POST /api/v1/bot
```

**Request:**
```json
{
  "message": "Hola, necesito información",
  "conversationHistory": []
}
```

**Response:**
```json
{
  "success": true,
  "message": "¡Hola! ¿En qué puedo ayudarte?",
  "extractedData": {
    "name": null,
    "email": null,
    ...
  },
  "conversationHistory": [...]
}
```

## 📖 Ejemplo Completo

Ver `src/components/ChatbotFormExample.tsx` para un ejemplo completo de integración con formulario.

Para ejecutar el ejemplo:

1. Crea una página:
```tsx
// src/app/chatbot-demo/page.tsx
import ChatbotFormExample from '@/components/ChatbotFormExample';

export default function Demo() {
  return <ChatbotFormExample />;
}
```

2. Visita: `http://localhost:3000/chatbot-demo`

## 🎨 Personalización

### Cambiar el Prompt

Edita `SYSTEM_PROMPT` en `src/app/api/v1/bot/route.ts`

### Cambiar Colores

El chatbot usa las clases de Tailwind. Personaliza en `Chatbot.tsx`:
- `bg-red-600` → Color principal
- `bg-gray-100` → Mensajes del bot

### Agregar Campos

1. Actualiza `ChatbotExtractedDataSchema` en `schemas.ts`
2. Modifica el prompt de extracción en `route.ts`

## 🐛 Solución Rápida de Problemas

| Problema | Solución |
|----------|----------|
| "GEMINI_API_KEY no configurada" | Agrega la key a `.env.local` y reinicia |
| Bot no responde | Verifica logs del servidor, revisa límites de API |
| Datos no se extraen | El usuario debe ser más específico en sus mensajes |
| Respuestas lentas | Usa `gemini-1.5-flash` en lugar de `pro` |

## 📚 Documentación Completa

Ver [CHATBOT_DOCUMENTATION.md](./CHATBOT_DOCUMENTATION.md) para:
- Guía detallada de uso
- Personalización avanzada
- Mejores prácticas
- Ejemplos completos
- Troubleshooting

## 🔒 Seguridad

⚠️ **IMPORTANTE:**
- Nunca expongas `GEMINI_API_KEY` en el cliente
- Siempre valida datos en el servidor
- Implementa rate limiting en producción
- `.env.local` debe estar en `.gitignore`

## 💰 Costos

**Gemini Free Tier:**
- ✅ 15 requests/minuto
- ✅ 1,500 requests/día
- ✅ 1 millón tokens/mes

Perfecto para desarrollo y proyectos pequeños.

## 🚀 Deploy

### Vercel
```bash
vercel env add GEMINI_API_KEY
```

### Railway
```bash
railway variables set GEMINI_API_KEY=tu_key
```

## 📞 Links Útiles

- [Google AI Studio (Obtener API Key)](https://makersuite.google.com/app/apikey)
- [Documentación de Gemini](https://ai.google.dev/docs)
- [Límites y Pricing](https://ai.google.dev/pricing)

---

**¿Listo para producción?** ✅

Solo necesitas:
1. ✅ API key de Gemini
2. ✅ Variables de entorno configuradas
3. ✅ Personalizar el prompt (opcional)

---

**Implementado:** Noviembre 2025
**Stack:** Next.js 15 + Gemini AI + TypeScript + Zod
