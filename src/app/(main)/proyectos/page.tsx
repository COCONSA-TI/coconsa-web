'use client';

// src/app/proyectos/page.tsx
import dynamic from 'next/dynamic';

// Importación dinámica fuera del componente para evitar errores de SSR
const InteractiveMap = dynamic(
    () => import('@/components/interactiveMap'),
    {
        loading: () => <p className="flex items-center justify-center h-full text-gray-500">Cargando mapa...</p>,
        ssr: false // Deshabilita el renderizado del servidor para este componente
    }
);

export default function ProyectosPage() {

    return (
        <div className="bg-white">
            {/* Encabezado de la página */}
            <div className="py-16 sm:py-24 text-center bg-gray-50">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                        Nuestra Huella en la República
                    </h1>
                    <p className="mt-4 text-lg max-w-3xl mx-auto text-gray-600">
                        Explora nuestros proyectos a lo largo de México. Cada punto representa un desafío superado y un cliente satisfecho.
                    </p>
                </div>
            </div>

            {/* Contenedor del Mapa Interactivo */}
            <div className="container mx-auto px-4 py-12">
                <div className="w-full h-[600px] bg-gray-200 rounded-lg shadow-lg overflow-hidden">
                    <InteractiveMap />
                </div>
            </div>

            {/* ... Sección de Proyectos Destacados ... */}
        </div>
    );
}