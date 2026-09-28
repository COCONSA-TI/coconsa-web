'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AdminNavbarProps {
  onMenuClick?: () => void;
}

export default function AdminNavbar({ onMenuClick }: AdminNavbarProps) {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();

  const [comprasOpen, setComprasOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const comprasRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isDashboardActive = pathname === '/dashboard';
  const isComprasActive =
    pathname.startsWith('/dashboard/ordenes-compra') ||
    pathname.startsWith('/dashboard/listas-necesidades') ||
    pathname.startsWith('/dashboard/presupuestos') ||
    pathname.startsWith('/dashboard/proveedores');

  const handleMouseEnterCompras = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setComprasOpen(true);
  };

  const handleMouseLeaveCompras = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setComprasOpen(false);
    }, 150);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (comprasRef.current && !comprasRef.current.contains(e.target as Node)) {
        setComprasOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50 border-b border-gray-200">
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

          {/* Navegación Desktop con Categorías */}
          <nav className="hidden lg:flex items-center space-x-1.5">
            <Link
              href="/dashboard"
              className={`px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                isDashboardActive
                  ? 'text-red-600 bg-red-50'
                  : 'text-gray-700 hover:text-red-600 hover:bg-gray-50'
              }`}
            >
              Dashboard
            </Link>

            {/* Dropdown Compras */}
            <div
              className="relative"
              ref={comprasRef}
              onMouseEnter={handleMouseEnterCompras}
              onMouseLeave={handleMouseLeaveCompras}
            >
              <button
                onClick={() => setComprasOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  isComprasActive || comprasOpen
                    ? 'text-red-600 bg-red-50'
                    : 'text-gray-700 hover:text-red-600 hover:bg-gray-50'
                }`}
                aria-expanded={comprasOpen}
              >
                <span>Compras</span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${
                    comprasOpen ? 'rotate-180 text-red-600' : 'text-gray-400'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Menú desplegable Compras */}
              {comprasOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 mb-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    Módulo de Compras
                  </div>

                  <Link
                    href="/dashboard/ordenes-compra"
                    onClick={() => setComprasOpen(false)}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg mx-1 transition-colors ${
                      pathname.startsWith('/dashboard/ordenes-compra')
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-red-600'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-amber-50 text-amber-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold flex items-center gap-1.5">
                        Órdenes de Compra
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">IA</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Solicitudes, cotizaciones y firmas</div>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/listas-necesidades"
                    onClick={() => setComprasOpen(false)}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg mx-1 transition-colors ${
                      pathname.startsWith('/dashboard/listas-necesidades')
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-red-600'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Listas de Necesidades</div>
                      <div className="text-xs text-gray-500 mt-0.5">Compras menores y anticipos</div>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/presupuestos"
                    onClick={() => setComprasOpen(false)}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg mx-1 transition-colors ${
                      pathname.startsWith('/dashboard/presupuestos')
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-red-600'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Presupuestos de Obra</div>
                      <div className="text-xs text-gray-500 mt-0.5">Control de insumos y avances</div>
                    </div>
                  </Link>

                  <Link
                    href="/dashboard/proveedores"
                    onClick={() => setComprasOpen(false)}
                    className={`flex items-start gap-3 px-3 py-2 rounded-lg mx-1 transition-colors ${
                      pathname.startsWith('/dashboard/proveedores')
                        ? 'bg-red-50 text-red-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-red-600'
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-violet-50 text-violet-600 flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Proveedores</div>
                      <div className="text-xs text-gray-500 mt-0.5">Catálogo y datos bancarios</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Lado derecho: Perfil de usuario y Logout estilizado */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 hover:border-gray-200"
                aria-label="Menú de usuario"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-red-600 to-red-500 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-white">
                  {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-gray-900 leading-tight max-w-[130px] truncate">
                    {user?.full_name || 'Usuario'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium leading-none mt-0.5 truncate max-w-[130px]">
                    {user?.department_name || (isAdmin ? 'Administrador' : 'Colaborador')}
                  </p>
                </div>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 transition-transform hidden sm:block ${
                    userMenuOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Menú flotante del usuario */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 divide-y divide-gray-100">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {user?.full_name || 'Usuario'}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                      {user?.email}
                    </p>
                    <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold bg-red-50 text-red-700 rounded-full border border-red-100">
                      {isAdmin ? 'Administrador' : (user?.department_name || 'Colaborador')}
                    </span>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
