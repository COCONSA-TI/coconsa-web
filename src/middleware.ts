import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

// Definición de rutas protegidas con roles permitidos
const protectedRoutes = [
  { path: '/dashboard', roles: ['admin', 'user', 'supervisor'] },
  { path: '/dashboard/chatbot', roles: ['admin'] },
  { path: '/dashboard/ordenes-compra', roles: ['admin', 'user', 'supervisor'] },
  { path: '/dashboard/reportes', roles: ['admin', 'supervisor'] },
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Obtener el token de sesión
  const cookie = request.cookies.get('session')?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Verificar si es una ruta protegida
  const protectedRoute = protectedRoutes.find(route => path.startsWith(route.path));

  if (protectedRoute) {
    // Redirigir a login si no hay sesión
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Verificar permisos de rol
    const userRole = session.role;
    if (userRole && !protectedRoute.roles.includes(userRole)) {
      // Redirigir a dashboard principal si no tiene permisos
      return NextResponse.redirect(new URL('/dashboard?error=unauthorized', request.url));
    }
  }

  // Redirigir a dashboard si ya está logueado e intenta acceder a login
  if (path === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configurar las rutas que el middleware debe revisar
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
