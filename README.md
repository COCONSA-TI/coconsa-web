# COCONSA Web

Sitio web corporativo para COCONSA - Empresa líder en construcción industrial y comercial en la Comarca Lagunera.

Este proyecto está construido con [Next.js](https://nextjs.org) 15 y utiliza las últimas tecnologías web.

## 🛡️ Protección con reCAPTCHA v3

Los formularios de este sitio están protegidos con **Google reCAPTCHA v3** (invisible):
- ✅ Formulario de login
- ✅ Formulario de contacto

### 🚀 Configuración Rápida de reCAPTCHA

1. **Instalar dependencia:**
```bash
npm install react-google-recaptcha-v3
```

2. **Configurar claves en `.env.local`:**
```bash
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=tu_site_key
RECAPTCHA_SECRET_KEY=tu_secret_key
```

3. **Obtener claves:** [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin)

📖 **Documentación completa:** Ver [RECAPTCHA_README.md](./RECAPTCHA_README.md)

---

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Este proyecto requiere las siguientes variables de entorno. Crea un archivo `.env.local` basado en `.env.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret

# Resend (emails)
RESEND_API_KEY=your_resend_api_key
SALES_EMAIL=ventas@coconsa.com
FROM_EMAIL=noreply@coconsa.com

# reCAPTCHA v3
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
```

Ver [.env.example](./.env.example) para más detalles.

## Características

- ✅ **Next.js 15** - Framework React con App Router
- ✅ **TypeScript** - Type safety
- ✅ **Tailwind CSS** - Estilos modernos
- ✅ **Supabase** - Base de datos y autenticación
- ✅ **reCAPTCHA v3** - Protección de formularios (invisible)
- ✅ **Resend** - Envío de emails
- ✅ **React Hook Form** - Manejo de formularios
- ✅ **Zod** - Validación de esquemas
- ✅ **Leaflet** - Mapas interactivos
- ✅ **React Email** - Templates de emails

## Estructura del Proyecto

```
coconsa-web/
├── src/
│   ├── app/              # App Router de Next.js
│   │   ├── (main)/       # Rutas públicas
│   │   ├── (admin)/      # Panel de administración
│   │   ├── api/          # API routes
│   │   └── login/        # Página de login
│   ├── components/       # Componentes React
│   │   ├── auth/         # Componentes de autenticación
│   │   ├── forms/        # Componentes de formularios
│   │   ├── home/         # Componentes de la home
│   │   └── emails/       # Templates de emails
│   ├── lib/              # Utilidades y configuración
│   │   ├── captcha.ts    # Validación reCAPTCHA
│   │   ├── auth.ts       # Funciones de autenticación
│   │   ├── schemas.ts    # Schemas de validación (Zod)
│   │   └── actions.ts    # Server actions
│   ├── context/          # React Context
│   └── data/             # Data estática
├── public/               # Archivos estáticos
└── docs/                 # Documentación
```

## Documentación Adicional

- [RECAPTCHA_README.md](./RECAPTCHA_README.md) - Guía completa de reCAPTCHA
- [RECAPTCHA_QUICKSTART.md](./RECAPTCHA_QUICKSTART.md) - Inicio rápido
- [RECAPTCHA_CHECKLIST.md](./RECAPTCHA_CHECKLIST.md) - Checklist de configuración
- [RECAPTCHA_SETUP.md](./RECAPTCHA_SETUP.md) - Configuración detallada
- [LOGIN_SETUP.md](./LOGIN_SETUP.md) - Configuración del sistema de login

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
