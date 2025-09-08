import Link from 'next/link';
import { services } from '@/data/servicesData';

export default function ServiciosPage() {
    return (
        <div className="bg-white">
            {/* Encabezado */}
            <div className="py-16 sm:py-24 text-center bg-gray-50">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                        Nuestros Servicios
                    </h1>
                    <p className="mt-4 text-lg max-w-3xl mx-auto text-gray-600">
                        Ofrecemos un portafolio completo de soluciones en construcción e infraestructura, adaptándonos a la escala y complejidad de cada proyecto con un solo objetivo: superar tus expectativas.
                    </p>
                </div>
            </div>

            {/* Grid de Servicios */}
            <div className="container mx-auto px-4 py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service) => (
                        <Link href={service.href} key={service.name} className="block bg-white p-8 rounded-lg shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                            <div className="text-blue-600 mb-4">
                                {service.icon}
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                            <p className="text-gray-600">{service.description}</p>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}