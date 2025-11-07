# Configuración del Sistema de Login

## 1. Instalar Dependencias

```bash
npm install @supabase/supabase-js @supabase/ssr bcryptjs jose
npm install --save-dev @types/bcryptjs
```

## 2. Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto con las siguientes variables:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
JWT_SECRET=tu_jwt_secret_seguro
```

### Obtener las credenciales de Supabase:

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Settings → API
3. Copia:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

### Generar JWT_SECRET:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Configurar la Base de Datos en Supabase

1. Ve a SQL Editor en tu proyecto de Supabase
2. Ejecuta el contenido del archivo `supabase-setup.sql`
3. Esto creará:
   - Tabla `users`
   - Índices necesarios
   - Políticas de seguridad (RLS)
   - Un usuario de ejemplo

## 4. Crear un Usuario de Prueba

### Generar hash de contraseña:

```javascript
// Ejecuta este código en Node.js o en la consola del navegador
const bcrypt = require('bcryptjs');
const password = 'tu_contraseña';
const hash = await bcrypt.hash(password, 10);
console.log(hash);
```

### Insertar usuario en Supabase:

```sql
INSERT INTO users (email, password_hash, role, full_name)
VALUES (
  'tu_email@ejemplo.com',
  'el_hash_generado',
  'admin',
  'Tu Nombre'
);
```

## 5. Probar el Login

1. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Navega a: `http://localhost:3000/login`

3. Ingresa las credenciales del usuario que creaste

## 6. Proteger Rutas

Para proteger una ruta, agrégala al array `protectedRoutes` en `src/middleware.ts`:

```typescript
const protectedRoutes = ['/dashboard', '/admin', '/tu-ruta-protegida'];
```

## 7. Obtener Usuario Actual

En cualquier Server Component:

```typescript
import { getSession } from '@/lib/auth';

export default async function ProtectedPage() {
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }
  
  return <div>Hola {session.email}</div>;
}
```

En Client Components:

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch('/api/v1/me')
      .then(res => res.json())
      .then(data => setUser(data.user));
  }, []);

  return <div>{user?.email}</div>;
}
```

## 8. Cerrar Sesión

```typescript
const handleLogout = async () => {
  await fetch('/api/v1/logout', { method: 'POST' });
  router.push('/login');
  router.refresh();
};
```

## Estructura de Archivos Creados

```
src/
├── lib/
│   ├── auth.ts              # Funciones JWT y sesiones
│   ├── schemas.ts           # Schemas de validación Zod
│   └── supabase/
│       ├── client.ts        # Cliente Supabase (frontend)
│       └── server.ts        # Cliente Admin Supabase (backend)
├── app/
│   ├── login/
│   │   └── page.tsx         # Página de login
│   └── api/
│       └── v1/
│           ├── login/
│           │   └── route.ts # API endpoint de login
│           └── logout/
│               └── route.ts # API endpoint de logout
└── middleware.ts            # Middleware de autenticación

supabase-setup.sql          # Script SQL para configurar la DB
.env.example               # Ejemplo de variables de entorno
```

## Solución de Problemas

### Error: Cannot find module '@supabase/supabase-js'
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Error: Cannot find module 'bcryptjs'
```bash
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### Error: Cannot find module 'jose'
```bash
npm install jose
```

### Error de CORS
Ya está configurado correctamente en la API. Si tienes problemas:
1. Verifica que las variables de entorno estén correctas
2. Revisa la configuración de CORS en Supabase (Authentication → URL Configuration)

### Contraseña incorrecta siempre
1. Verifica que el hash en la DB sea correcto
2. Asegúrate de usar bcrypt para generar el hash
3. Verifica que estés usando bcrypt.compare() correctamente
