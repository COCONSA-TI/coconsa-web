import Link from 'next/link';

const services = [
  {
    name: 'Naves Industriales',
    description: 'Diseñamos y construimos naves a la medida, optimizadas para la operación y logística de tu empresa.',
    href: '/servicios/naves-industriales',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6M9 11.25h6m-6 4.5h6M6.75 21v-2.25a2.25 2.25 0 012.25-2.25h6a2.25 2.25 0 012.25 2.25V21" /></svg>
  },
  {
    name: 'Cimentaciones Profundas',
    description: 'Garantizamos la estabilidad y seguridad de tus estructuras con soluciones de cimentación de alta ingeniería.',
    href: '/servicios/cimentaciones-profundas',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
  },
  {
    name: 'Terracerías y Pavimentos',
    description: 'Preparamos y nivelamos terrenos, creando superficies duraderas y seguras para cualquier tipo de proyecto.',
    href: '/servicios/terracerias-pavimentos',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
  },
  {
    name: 'Obra Civil e Infraestructura',
    description: 'Ejecutamos proyectos de infraestructura pública y privada que impulsan el desarrollo y conectan comunidades.',
    href: '/servicios/obra-civil',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m-3-1l-3-1m3 1v5.505M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    name: 'Proyectos Comerciales',
    description: 'Construimos espacios comerciales funcionales y atractivos que potencian el éxito de tu negocio.',
    href: '/servicios/proyectos-comerciales',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.25v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0h2.25m11.25 0h2.25m-7.5 0h2.25M3.375 15h17.25c.621 0 1.125-.504 1.125-1.125V6.375c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v7.5c0 .621.504 1.125 1.125 1.125z" /></svg>
  },
  {
    name: 'Renta de Maquinaria',
    description: 'Ofrecemos una flota de maquinaria pesada moderna y en óptimas condiciones para tus proyectos.',
    href: '/servicios/renta-maquinaria',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 00-5.84-2.56m5.84 2.56v4.82M15.59 14.37a14.98 14.98 0 00-5.84-2.56m0 0a14.98 14.98 0 00-5.84 2.56m5.84-2.56v-4.82a6 6 0 015.84-7.38m-5.84 7.38v-4.82" /></svg>
  }
];

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