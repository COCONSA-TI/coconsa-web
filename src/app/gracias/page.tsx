// src/app/gracias/page.tsx
import Link from 'next/link';
import { CheckCircleIcon } from '@heroicons/react/24/solid'; // Necesitarás instalar heroicons

export default function GraciasPage() {
  return (
    <main className="flex items-center justify-center min-h-[70vh] bg-gray-50">
      <div className="text-center p-8 max-w-lg mx-auto bg-white rounded-lg shadow-md">
        <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
        
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          ¡Solicitud Enviada!
        </h1>
        
        <p className="text-gray-600 text-lg mb-6">
          Gracias por contactarnos. Hemos recibido tu solicitud de cotización y nuestro equipo se pondrá en contacto contigo a la brevedad.
        </p>
        
        <Link 
          href="/"
          className="inline-block bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors"
        >
          Volver al Inicio
        </Link>
      </div>
    </main>
  );
}