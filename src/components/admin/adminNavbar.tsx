'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminNavbar() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo y Título */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-3">
              <Image
                src="/logo-coconsa.png"
                alt="Logo de COCONSA"
                width={40}
                height={40}
                priority
                className="drop-shadow-sm"
              />
              <div>
                <h1 className="text-lg font-bold text-gray-900">COCONSA</h1>
                <p className="text-xs text-gray-500">Sistema Interno</p>
              </div>
            </Link>
          </div>

          {/* Navegación */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link 
              href="/dashboard" 
              className="text-gray-700 hover:text-red-600 font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/dashboard/cotizaciones" 
              className="text-gray-700 hover:text-red-600 font-medium transition-colors"
            >
              Cotizaciones
            </Link>
            <Link 
              href="/dashboard/proyectos" 
              className="text-gray-700 hover:text-red-600 font-medium transition-colors"
            >
              Proyectos
            </Link>
            <Link 
              href="/dashboard/clientes" 
              className="text-gray-700 hover:text-red-600 font-medium transition-colors"
            >
              Clientes
            </Link>
          </nav>

          {/* Botón de logout */}
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
}
