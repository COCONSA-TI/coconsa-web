'use client';

import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, LoginFormData } from '@/lib/schemas';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(LoginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/v1/login', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
                setError(result.error || 'Error al iniciar sesión');
                return;
            }

            // Redirigir al dashboard o página principal
            router.push('/dashboard');
            router.refresh();
        } catch (err) {
            setError('Error de conexión. Por favor, intenta nuevamente.');
            console.error('Error en login:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
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
            </form>
        </div>
    );
}