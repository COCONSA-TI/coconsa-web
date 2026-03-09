import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/schemas";
import { createSession } from "@/lib/auth";
import bcrypt from 'bcryptjs';
import { verifyRecaptcha } from "@/lib/captcha";
import { rateLimit } from "@/lib/rate-limit";
import { UserRoleRelation } from "@/types/database";

export async function POST(request: Request) {
  try {
    // Rate limiting por IP: máximo 5 intentos cada 15 minutos
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
      headersList.get("x-real-ip") ??
      "unknown";

    if (!rateLimit(ip, { maxRequests: 5, windowMs: 15 * 60 * 1000 })) {
      return NextResponse.json(
        { error: "Demasiados intentos de inicio de sesión. Espera 15 minutos e intenta de nuevo." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const body = await request.json();
    
    const validatedFields = LoginSchema.safeParse(body);
    
    if (!validatedFields.success) {
      return NextResponse.json(
        { 
          error: "Datos inválidos",
          details: validatedFields.error.flatten().fieldErrors,

        },
        { status: 400 }
      );
    }

    const { email, password, recaptchaToken } = validatedFields.data;

    // Verificar reCAPTCHA siempre, excepto cuando SKIP_RECAPTCHA=true en no-producción
    const skipRecaptcha =
      process.env.SKIP_RECAPTCHA === "true" &&
      process.env.NODE_ENV !== "production";

    if (!skipRecaptcha) {
      if (!recaptchaToken) {
        return NextResponse.json(
          { error: "Token de verificación requerido." },
          { status: 400 }
        );
      }
      const recaptchaResult = await verifyRecaptcha(recaptchaToken);
      if (!recaptchaResult.success) {
        return NextResponse.json(
          { error: "Verificación de seguridad fallida. Por favor, intenta nuevamente." },
          { status: 403 }
        );
      }
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id, 
        email, 
        password_hash,
        roles (
          name
        )
      `)
      .eq('email', email)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Credenciales incorrectas" },
        { status: 401 }
      );
    }

    const userRoles = user.roles as UserRoleRelation | UserRoleRelation[] | null;
    const roleName = Array.isArray(userRoles) ? userRoles[0]?.name : userRoles?.name || 'user';

    await createSession(user.id, user.email, roleName);

    return NextResponse.json({ 
      success: true,
      message: "Inicio de sesión exitoso",
      user: {
        id: user.id,
        email: user.email,
        role: roleName
      }
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}