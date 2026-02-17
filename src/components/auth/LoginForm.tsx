'use client';

import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema } from '@/lib/schemas';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { z } from 'zod';

// Schema para el formulario (sin recaptchaToken)
const LoginFormSchema = LoginSchema.omit({ recaptchaToken: true });
type LoginFormInputs = z.infer<typeof LoginFormSchema>;

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormInputs>({
    resolver: zodResolver(LoginFormSchema),
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setIsLoading(true);
    setError('');

    try {
      if (!executeRecaptcha) {
        setError('reCAPTCHA no está disponible. Por favor, recarga la página.');
        setIsLoading(false);
        return;
      }

      // Genera el token de reCAPTCHA v3
      const recaptchaToken = await executeRecaptcha('login');

      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          recaptchaToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Error al iniciar sesión');
        return;
      }

      // Redirigir al dashboard
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Error de conexión. Por favor, intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded shadow-md w-full max-w-sm flex flex-col gap-4">
      <div className="mb-8 flex justify-center">
        <Image
          src="/logo-coconsa.png"
          alt="Company Logo"
          width={120}
          height={120}
          priority
        />
      </div>

      <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
        Iniciar Sesión
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register('email')}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
          placeholder="tu@ejemplo.com"
        />
        {errors.email && (
          <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          {...register('password')}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900"
          placeholder="********"
        />
        {errors.password && (
          <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
      </button>

      <p className="text-xs text-gray-500 text-center mt-2">
        Protegido por reCAPTCHA v3
      </p>
    </form>
  );
}
