import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { LoginSchema } from "@/lib/schemas";
import { createSession } from "@/lib/auth";
import bcrypt from 'bcryptjs';
import { verifyRecaptcha } from "@/lib/captcha";

export async function POST(request: Request) {
  try {
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

    // Solo verificar reCAPTCHA en producción
    if (process.env.NODE_ENV === 'production') {
      const recaptchaResult = await verifyRecaptcha(recaptchaToken);
      
      if (!recaptchaResult.success) {
        return NextResponse.json(
          { error: "Verificación de seguridad fallida. Por favor, intenta nuevamente." },
          { status: 403 }
        );
      }
    } else {
      console.log('⚠️ Modo desarrollo: Saltando verificación de reCAPTCHA');
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, role')
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

    await createSession(user.id, user.email, user.role);

    return NextResponse.json({ 
      success: true,
      message: "Inicio de sesión exitoso",
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}