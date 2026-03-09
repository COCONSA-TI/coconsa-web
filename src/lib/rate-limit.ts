/**
 * Rate limiting en memoria (sin dependencias externas).
 * Para producción con múltiples instancias, reemplazar con Redis/Upstash.
 *
 * Uso:
 *   import { rateLimit } from '@/lib/rate-limit';
 *   const allowed = rateLimit(ip, { maxRequests: 5, windowMs: 15 * 60 * 1000 });
 *   if (!allowed) return NextResponse.json({ error: '...' }, { status: 429 });
 */

interface RateLimitOptions {
  /** Número máximo de intentos permitidos en la ventana de tiempo */
  maxRequests?: number;
  /** Duración de la ventana en milisegundos (default: 15 minutos) */
  windowMs?: number;
}

// Map<identifier, timestamps[]>
const attempts = new Map<string, number[]>();

// Limpiar entradas expiradas cada 5 minutos para evitar fuga de memoria
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of attempts.entries()) {
    const valid = timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
    if (valid.length === 0) {
      attempts.delete(key);
    } else {
      attempts.set(key, valid);
    }
  }
}, 5 * 60 * 1000);

/**
 * Verifica si el identificador (IP, email, etc.) está dentro del límite.
 * Devuelve `true` si la solicitud está permitida, `false` si excede el límite.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): boolean {
  const maxRequests = options.maxRequests ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const now = Date.now();

  const previous = (attempts.get(identifier) ?? []).filter(
    (ts) => now - ts < windowMs
  );

  if (previous.length >= maxRequests) {
    return false;
  }

  attempts.set(identifier, [...previous, now]);
  return true;
}

/**
 * Devuelve cuántos intentos quedan antes de ser bloqueado.
 */
export function getRateLimitInfo(
  identifier: string,
  options: RateLimitOptions = {}
): { remaining: number; resetInMs: number } {
  const maxRequests = options.maxRequests ?? 5;
  const windowMs = options.windowMs ?? 15 * 60 * 1000;
  const now = Date.now();

  const previous = (attempts.get(identifier) ?? []).filter(
    (ts) => now - ts < windowMs
  );
  const oldest = previous[0] ?? now;
  const resetInMs = Math.max(0, windowMs - (now - oldest));

  return {
    remaining: Math.max(0, maxRequests - previous.length),
    resetInMs,
  };
}
