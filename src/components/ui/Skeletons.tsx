'use client';

import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

/**
 * Wrapper con el tema de COCONSA (gris claro)
 */
export function SkeletonWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SkeletonTheme baseColor="#e5e7eb" highlightColor="#f3f4f6">
      {children}
    </SkeletonTheme>
  );
}

/**
 * Skeleton para las stat cards del dashboard (4 tarjetas)
 */
export function DashboardStatsSkeleton() {
  return (
    <SkeletonWrapper>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <Skeleton width={120} height={14} />
              <Skeleton circle width={40} height={40} />
            </div>
            <Skeleton width={60} height={32} />
            <Skeleton width={100} height={12} className="mt-2" />
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton para una tabla con N filas
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <SkeletonWrapper>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} width={`${100 / cols}%`} height={16} />
            ))}
          </div>
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="border-b border-gray-100 px-6 py-4">
            <div className="flex gap-4 items-center">
              {Array.from({ length: cols }).map((_, colIdx) => (
                <div key={colIdx} style={{ width: `${100 / cols}%` }}>
                  <Skeleton height={14} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton para la lista de ordenes pendientes / recientes del dashboard
 */
export function OrdersListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonWrapper>
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100">
            <div className="flex-1">
              <Skeleton width={180} height={14} />
              <Skeleton width={120} height={12} className="mt-1" />
            </div>
            <Skeleton width={80} height={24} borderRadius={12} />
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton para el detalle de una orden de compra
 */
export function OrderDetailSkeleton() {
  return (
    <SkeletonWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton width={250} height={28} />
            <Skeleton width={150} height={16} className="mt-2" />
          </div>
          <div className="flex gap-2">
            <Skeleton width={120} height={36} borderRadius={8} />
            <Skeleton width={120} height={36} borderRadius={8} />
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main info */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <Skeleton width={160} height={20} className="mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton width={80} height={12} />
                  <Skeleton width={150} height={16} className="mt-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Side panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <Skeleton width={120} height={20} className="mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton width={80} height={12} />
                  <Skeleton width={120} height={16} className="mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <Skeleton width={120} height={20} className="mb-4" />
          <TableSkeleton rows={3} cols={4} />
        </div>

        {/* Approvals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <Skeleton width={140} height={20} className="mb-4" />
          <div className="flex gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-1 p-4 border border-gray-100 rounded-lg">
                <Skeleton width={100} height={14} />
                <Skeleton width={80} height={12} className="mt-2" />
                <Skeleton circle width={32} height={32} className="mt-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton para formulario de edicion de orden
 */
export function OrderFormSkeleton() {
  return (
    <SkeletonWrapper>
      <div className="space-y-6">
        <Skeleton width={280} height={28} />

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          {/* Form fields */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton width={120} height={14} className="mb-2" />
              <Skeleton height={40} borderRadius={8} />
            </div>
          ))}
        </div>

        {/* Items section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <Skeleton width={100} height={20} className="mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 mb-3">
              <div className="flex-1"><Skeleton height={40} borderRadius={8} /></div>
              <div className="w-20"><Skeleton height={40} borderRadius={8} /></div>
              <div className="w-20"><Skeleton height={40} borderRadius={8} /></div>
              <div className="w-28"><Skeleton height={40} borderRadius={8} /></div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between"><Skeleton width={80} /><Skeleton width={100} /></div>
              <div className="flex justify-between"><Skeleton width={60} /><Skeleton width={100} /></div>
              <div className="flex justify-between"><Skeleton width={50} /><Skeleton width={100} /></div>
            </div>
          </div>
        </div>
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton para la pagina de usuarios (tabla con filtros)
 */
export function UsersPageSkeleton() {
  return (
    <SkeletonWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton width={200} height={28} />
          <Skeleton width={140} height={36} borderRadius={8} />
        </div>
        {/* Search + filters */}
        <div className="flex gap-4">
          <div className="flex-1"><Skeleton height={40} borderRadius={8} /></div>
          <Skeleton width={150} height={40} borderRadius={8} />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton para la pagina de configuracion
 */
export function ConfigPageSkeleton() {
  return (
    <SkeletonWrapper>
      <div className="space-y-6">
        <Skeleton width={200} height={28} />
        {/* Tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={100} height={36} borderRadius={8} />
          ))}
        </div>
        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <Skeleton width={180} height={16} />
                <Skeleton width={120} height={12} className="mt-1" />
              </div>
              <Skeleton width={60} height={30} borderRadius={15} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonWrapper>
  );
}

/**
/**
 * Skeleton para la lista de ordenes de compra (con banner rojo, tabs, 5 stats cards y tabla)
 */
export function OrdersPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner Skeleton */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 w-56 bg-white/20 rounded"></div>
            <div className="h-4 w-72 bg-white/10 rounded mt-2"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-24 bg-white/10 rounded-lg"></div>
            <div className="h-10 w-36 bg-white/20 rounded-lg"></div>
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8 pb-4">
          <div className="h-5 w-20 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-5 w-40 bg-gray-100 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Stats Grid Skeleton (5 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-3 w-16 bg-gray-200 rounded mb-2"></div>
                <div className="h-7 w-12 bg-gray-200 rounded"></div>
              </div>
              <div className="w-10 h-10 rounded-full bg-gray-100"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters Skeleton */}
      <div className="bg-white rounded-xl shadow p-4 animate-pulse">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px] h-10 bg-gray-100 rounded-lg"></div>
          <div className="w-28 h-10 bg-gray-100 rounded-lg"></div>
          <div className="w-28 h-10 bg-gray-100 rounded-lg"></div>
        </div>
      </div>

      {/* Table / List Skeleton */}
      <div className="bg-white rounded-xl shadow overflow-hidden animate-pulse">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between">
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
          <div className="h-4 w-24 bg-gray-200 rounded"></div>
          <div className="h-4 w-32 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 flex items-center justify-between gap-4">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
              <div className="h-4 w-20 bg-gray-100 rounded"></div>
              <div className="h-4 w-28 bg-gray-100 rounded"></div>
              <div className="h-4 w-36 bg-gray-100 rounded"></div>
              <div className="h-4 w-20 bg-gray-200 rounded font-bold"></div>
              <div className="h-6 w-24 bg-gray-100 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton para la pagina de Presupuestos (con banner rojo, tabs, selector, 6 cards y tabla)
 */
export function PresupuestosPageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Banner Skeleton */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-xl shadow-lg p-6 text-white animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 w-56 bg-white/20 rounded"></div>
            <div className="h-4 w-72 bg-white/10 rounded mt-2"></div>
          </div>
          <div className="h-10 w-36 bg-white/20 rounded-lg"></div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="border-b border-gray-200">
        <div className="flex space-x-8 pb-4">
          <div className="h-5 w-36 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-5 w-36 bg-gray-100 rounded animate-pulse"></div>
          <div className="h-5 w-32 bg-gray-100 rounded animate-pulse"></div>
        </div>
      </div>

      {/* Selector de Obra Skeleton */}
      <div className="bg-white rounded-xl shadow p-4 sm:p-5 border border-gray-100 animate-pulse">
        <div className="max-w-md space-y-2">
          <div className="h-4 w-40 bg-gray-200 rounded"></div>
          <div className="h-10 w-full bg-gray-100 rounded-lg"></div>
        </div>
      </div>

      {/* Financial Summary Category Cards Skeleton (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl shadow p-4 border border-gray-100 animate-pulse">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-gray-100"></div>
              <div className="w-8 h-4 rounded-full bg-gray-100"></div>
            </div>
            <div className="h-3 w-16 bg-gray-200 rounded mb-2"></div>
            <div className="h-6 w-24 bg-gray-200 rounded mb-3"></div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full"></div>
          </div>
        ))}
      </div>

      {/* Content / Table Skeleton */}
      <div className="bg-white rounded-xl shadow overflow-hidden animate-pulse">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 w-20 bg-gray-100 rounded-full"></div>
            ))}
          </div>
          <div className="w-64 h-9 bg-gray-100 rounded-lg"></div>
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="h-4 w-24 bg-gray-200 rounded"></div>
              <div className="h-4 w-48 bg-gray-100 rounded"></div>
              <div className="h-4 w-12 bg-gray-100 rounded"></div>
              <div className="h-4 w-20 bg-gray-100 rounded"></div>
              <div className="h-4 w-20 bg-gray-100 rounded"></div>
              <div className="h-4 w-20 bg-gray-200 rounded font-bold"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton para lista de proyectos en reportes
 */
export function ProjectsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <SkeletonWrapper>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg">
            <Skeleton width="80%" height={14} />
            <Skeleton width="50%" height={12} className="mt-1" />
          </div>
        ))}
      </div>
    </SkeletonWrapper>
  );
}

/**
 * Skeleton generico de pagina completa con spinner (reemplazo del patron comun)
 */
export function FullPageSkeleton() {
  return (
    <SkeletonWrapper>
      <div className="min-h-[60vh] space-y-6 p-6">
        <Skeleton width={300} height={28} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <Skeleton width={100} height={14} className="mb-3" />
              <Skeleton width={60} height={28} />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <Skeleton width={180} height={20} className="mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="py-3 border-b border-gray-100">
              <Skeleton height={16} />
            </div>
          ))}
        </div>
      </div>
    </SkeletonWrapper>
  );
}

export { Skeleton, SkeletonTheme };
