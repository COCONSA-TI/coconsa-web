'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeOptions {
  /**
   * Tabla(s) de Supabase a escuchar. Cuando haya un INSERT/UPDATE/DELETE,
   * se ejecutará onChange.
   */
  tables: string[];

  /**
   * Callback que se ejecuta cuando hay un cambio en la DB o cuando
   * el usuario regresa a la pestaña (después de un tiempo mínimo).
   */
  onchange: () => void;

  /**
   * Tiempo mínimo (ms) entre refetches automáticos.
   * Evita ráfagas de refetch si hay muchos cambios rápidos.
   * Default: 2000ms (2 segundos)
   */
  throttleMs?: number;

  /**
   * Tiempo mínimo (ms) que debe pasar antes de refetch al volver a la pestaña.
   * Default: 30000ms (30 segundos)
   */
  staleTimeMs?: number;

  /**
   * Si true, habilita las suscripciones realtime.
   * Útil para desactivar condicionalmente (ej: si el usuario no está autenticado).
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Hook que combina Supabase Realtime + Visibility API para mantener
 * los datos frescos sin polling agresivo.
 *
 * Cómo funciona:
 * 1. Se suscribe a cambios de Supabase Realtime (WebSockets manejados por Supabase)
 * 2. Cuando el usuario cambia de pestaña y regresa, refetch si los datos están "stale"
 * 3. Throttle automático para evitar ráfagas de llamadas
 *
 * @example
 * ```tsx
 * useRealtime({
 *   tables: ['orders', 'order_approvals'],
 *   onchange: () => fetchOrders(),
 * });
 * ```
 */
export function useRealtime({
  tables,
  onchange,
  throttleMs = 2000,
  staleTimeMs = 30_000,
  enabled = true,
}: UseRealtimeOptions) {
  const lastFetchRef = useRef<number>(Date.now());
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Estabilizar la referencia del callback
  const onChangeRef = useRef(onchange);
  onChangeRef.current = onchange;

  const throttledOnChange = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastFetchRef.current;

    if (elapsed >= throttleMs) {
      // Suficiente tiempo ha pasado, ejecutar inmediatamente
      lastFetchRef.current = now;
      onChangeRef.current();
    } else if (!throttleTimerRef.current) {
      // Programar ejecución para cuando el throttle expire
      const remaining = throttleMs - elapsed;
      throttleTimerRef.current = setTimeout(() => {
        lastFetchRef.current = Date.now();
        throttleTimerRef.current = null;
        onChangeRef.current();
      }, remaining);
    }
    // Si ya hay un timer programado, ignorar (el cambio se capturará en el próximo refetch)
  }, [throttleMs]);

  useEffect(() => {
    if (!enabled) return;

    // --- 1. Supabase Realtime ---
    const channelName = `realtime-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table },
        () => {
          throttledOnChange();
        }
      );
    });

    channel.subscribe();
    channelRef.current = channel;

    // --- 2. Visibility API (refetch al volver a la pestaña) ---
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastFetchRef.current;
        if (elapsed >= staleTimeMs) {
          lastFetchRef.current = Date.now();
          onChangeRef.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // --- 3. Online event (refetch al recuperar conexión) ---
    const handleOnline = () => {
      lastFetchRef.current = Date.now();
      onChangeRef.current();
    };

    window.addEventListener('online', handleOnline);

    // --- Cleanup ---
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, throttledOnChange, staleTimeMs, ...tables]); // eslint-disable-line react-hooks/exhaustive-deps
}
