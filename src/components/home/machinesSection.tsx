import Image from 'next/image';
import Link from 'next/link';

const machineFeatures = [
    'Excavadoras y Retroexcavadoras',
    'Tractores y Motoniveladoras',
    'Grúas y Montacargas',
    'Vibrocompactadores',
    'Operadores Certificados',
    'Mantenimiento Riguroso',
];

export default function MachinesSection() {
    return (
        <section id="renta-maquinaria" className="py-16 sm:py-24 bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Columna de Imagen */}
                    <div className="relative aspect-w-4 aspect-h-3 rounded-lg overflow-hidden shadow-2xl">
                        <Image
                            src="/renta-maquinaria.jpg"
                            alt="Maquinaria pesada de COCONSA trabajando en un proyecto de construcción"
                            width={800}
                            height={600}
                            className="object-cover"
                        />
                    </div>

                    {/* Columna de Texto */}
                    <div className="space-y-6">
                        <div className="text-left">
                            <p className="text-blue-600 font-semibold">RENTA DE MAQUINARIA</p>
                            <h2 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">
                                El Equipo que tu Proyecto Necesita
                            </h2>
                        </div>
                        <p className="text-lg text-gray-600 leading-relaxed">
                            Impulsa la eficiencia de tu obra con nuestra flota de maquinaria pesada. Ofrecemos equipos modernos, en perfecto estado de mantenimiento y operados por personal certificado, garantizando seguridad y rendimiento en cada jornada.
                        </p>

                        {/* Lista de Características/Beneficios */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4">
                            {machineFeatures.map((feature) => (
                                <div key={feature} className="flex items-center">
                                    <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                                    <span className="text-gray-700">{feature}</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6">
                            <Link href="/renta-maquinaria" className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-blue-700 transition-colors duration-300 text-lg">
                                Ver Catálogo de Maquinaria
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}