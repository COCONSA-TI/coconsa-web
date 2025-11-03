// src/app/servicios/[slug]/page.tsx
import Image from 'next/image';
import Link from 'next/link';
import { services } from '@/data/servicesData'; // Importamos nuestra fuente de datos
import { notFound } from 'next/navigation'; // Para manejar servicios no encontrados

// Esta función recibe los parámetros de la URL, en este caso el "slug"
export default function ServicioDetallePage({ params }: { params: { slug: string } }) {
  
  // 1. Buscamos el servicio correspondiente al slug de la URL
  const service = services.find(s => s.href === `/servicios/${params.slug}`);

  // 2. Si no se encuentra el servicio, mostramos una página 404
  if (!service) {
  notFound();
  }

  // 3. Si se encuentra, usamos sus datos para renderizar la página
  return (
  <main className="bg-gray-50">
    {/* Hero Section - Usa datos dinámicos */}
    <section className="relative h-[50vh] flex items-center justify-center text-white">
    <Image
      src={`/services/${service.name.toLowerCase().replace(/ /g, '-')}.jpg`}
      alt={`Imagen representativa del servicio de ${service.name}`}
      layout="fill"
      objectFit="cover"
      className="brightness-50"
      priority
    />
    <div className="relative z-10 text-center px-4">
      <h1 className="text-4xl md:text-6xl font-bold">{service.name}</h1>
      <p className="mt-4 text-lg md:text-xl max-w-3xl">{service.description}</p>
    </div>
    </section>

    <div className="container mx-auto px-4 py-16">
    <div className="max-w-4xl mx-auto">
      {/* Descripción General */}
      <section className="space-y-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-4">{service.name}</h2>
      <p className="text-gray-600 leading-relaxed">
        {/* Aquí iría un texto más detallado sobre el servicio específico. */}
        En COCONSA, nuestro servicio de **{service.name}** está diseñado para cumplir con los más altos estándares de calidad y eficiencia. Contamos con la experiencia y el equipo necesario para llevar a cabo proyectos de cualquier escala, asegurando resultados que superan las expectativas de nuestros clientes.
      </p>

      {/* Aquí podrías añadir más secciones específicas como "Características", "Proyectos Relacionados", etc. */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">¿Interesado en este servicio?</h3>
        <p className="text-gray-600 mb-6">Nuestro equipo de expertos está listo para asesorarte en tu proyecto de {service.name}. Contáctanos para recibir una cotización personalizada.</p>
        <Link href="/contacto" className="inline-block bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors">
        Solicitar Información
        </Link>
      </div>
      </section>
    </div>
    </div>
  </main>
  );
}