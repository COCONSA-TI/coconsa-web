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
  const { isAdmin, isDepartmentHead } = useAuth();

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      // Error silencioso - el usuario será redirigido al login
    }
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50 border-b border-gray-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Lado izquierdo: Hamburguesa y Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              aria-label="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="bg-white p-1 rounded-lg border border-gray-100 shadow-sm group-hover:shadow-md transition-shadow">
                <Image
                  src="/logo-coconsa.png"
                  alt="Logo de COCONSA"
                  width={34}
                  height={34}
                  priority
                />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-extrabold text-gray-900 tracking-tight leading-none">COCONSA</h1>
                <p className="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mt-0.5">Sistema Interno</p>
              </div>
            </Link>
          </div>

          {/* Navegación (oculta en móvil, visible en desktop) */}
          {/* TEMPORAL: Solo Dashboard, Órdenes de Compra y Listas de Necesidades durante el desarrollo */}
          <nav className="hidden lg:flex items-center space-x-1">
            <Link 
              href="/dashboard" 
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
            >
              Dashboard
            </Link>
            <Link 
              href="/dashboard/ordenes-compra" 
              className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
            >
              Órdenes de Compra
            </Link>
            {isAdmin && (
              <Link 
                href="/dashboard/listas-necesidades" 
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
              >
                Listas de Necesidades
              </Link>
            )}
            {isDepartmentHead && (
              <Link 
                href="/dashboard/proveedores" 
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
              >
                Proveedores
              </Link>
            )}
            {/* TODO: Descomentar cuando las demás secciones estén listas
            {isAdmin && (
              <>
                <Link 
                  href="/dashboard/proyectos" 
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                >
                  Proyectos
                </Link>
                <Link 
                  href="/dashboard/clientes" 
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all"
                >
                  Clientes
                </Link>
              </>
            )}
            */}
          </nav>

          {/* Botón de logout */}
          <div className="flex items-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-gray-900 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors shadow-sm text-sm font-medium"
            >
              <span className="hidden sm:inline">Cerrar Sesión</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
