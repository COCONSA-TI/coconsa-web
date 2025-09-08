import Link from 'next/link';
import { services } from '@/data/servicesData';

export default function ServicesSection() {
  return (
    <section id="servicios" className="py-16 sm:py-24 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado de la sección */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-blue-600 font-semibold">NUESTROS SERVICIOS</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">
            Soluciones Integrales para Proyectos de Construcción
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Desde la planeación hasta la ejecución, ofrecemos una gama completa de servicios para llevar tu proyecto al siguiente nivel con calidad y eficiencia garantizadas.
          </p>
        </div>

        {/* Grid de Servicios */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <div key={service.name} className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
              <div className="flex-shrink-0 text-blue-600">
                {service.icon}
              </div>
              <div className="mt-4 flex-grow">
                <h3 className="text-xl font-semibold text-gray-900">{service.name}</h3>
                <p className="mt-2 text-gray-600">{service.description}</p>
              </div>
              <div className="mt-6">
                <Link href={service.href} className="text-blue-600 font-semibold hover:underline">
                  Ver más →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Botón de Acción Principal */}
        <div className="mt-16 text-center">
          <Link href="/servicios" className="bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-lg">
            Ver todos los servicios
          </Link>
        </div>
      </div>
    </section>
  );
}