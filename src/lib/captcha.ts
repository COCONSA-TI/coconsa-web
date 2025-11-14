/**
 * Utilidad para verificar tokens de reCAPTCHA v3 en el servidor
 */

interface RecaptchaVerificationResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

/**
 * Verifica un token de reCAPTCHA v3 con Google
 * @param token - El token generado por reCAPTCHA en el cliente
 * @param minScore - Puntuación mínima requerida (0.0 - 1.0). Por defecto 0.5
 * @returns true si el token es válido y la puntuación es suficiente
 */
export async function verifyRecaptcha(
  token: string,
  minScore: number = 0.5
): Promise<{ success: boolean; score?: number; error?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;

  if (!secretKey) {
    console.error('RECAPTCHA_SECRET_KEY no está configurada');
    return { success: false, error: 'Configuración de reCAPTCHA faltante' };
  }

  if (!token) {
    return { success: false, error: 'Token de reCAPTCHA faltante' };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data: RecaptchaVerificationResponse = await response.json();

    if (!data.success) {
      console.error('Verificación de reCAPTCHA fallida:', data['error-codes']);
      return {
        success: false,
        error: 'Verificación de reCAPTCHA fallida',
      };
    }

    // reCAPTCHA v3 devuelve una puntuación de 0.0 a 1.0
    // 1.0 es muy probablemente una interacción legítima
    // 0.0 es muy probablemente un bot
    if (data.score < minScore) {
      console.warn(`Puntuación de reCAPTCHA baja: ${data.score}`);
      return {
        success: false,
        score: data.score,
        error: 'Puntuación de verificación demasiado baja',
      };
    }

    return {
      success: true,
      score: data.score,
    };
  } catch (error) {
    console.error('Error al verificar reCAPTCHA:', error);
    return {
      success: false,
      error: 'Error al verificar reCAPTCHA',
    };
  }
}
