'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AdminNavbarProps {
  onMenuClick?: () => void;
}

export default function AdminNavbar({ onMenuClick }: AdminNavbarProps) {
  const router = useRouter();
  const { isAdmin } = useAuth();

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
          {/* Botón hamburguesa (móvil) */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

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
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-gray-900">COCONSA</h1>
                <p className="text-xs text-gray-500">Sistema Interno</p>
              </div>
            </Link>
          </div>

          {/* Navegación (oculta en móvil, visible en desktop) */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link 
              href="/dashboard" 
              className="text-gray-700 hover:text-red-600 font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/dashboard/ordenes-compra" 
              className="text-gray-700 hover:text-red-600 font-medium transition-colors"
            >
              Órdenes de Compra
            </Link>
            {isAdmin && (
              <>
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
              </>
            )}
          </nav>

          {/* Botón de logout */}
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <span className="hidden sm:inline">Cerrar Sesión</span>
            <svg className="w-5 h-5 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
