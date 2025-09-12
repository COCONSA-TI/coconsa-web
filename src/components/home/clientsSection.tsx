import Image from 'next/image';
import Link from 'next/link';

const clients = [
  { name: 'Peñoles', logoSrc: '/clients/penoles.jpg' },
  { name: 'Lala', logoSrc: '/clients/lala.jpg' },
  { name: 'Tyson', logoSrc: '/clients/tyson.jpg' },
  { name: 'Walmart', logoSrc: '/clients/walmart.jpg' },
  { name: 'Grupo Simsa', logoSrc: '/clients/grupo-simsa.jpg' },
];

export default function ClientsSection() {
  return (
    <section id="clientes" className="py-16 sm:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado de la sección */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-red-700 font-semibold">NUESTROS CLIENTES</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">
            La Confianza de los Líderes de la Industria
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Nos enorgullece haber colaborado en proyectos clave para algunas de las empresas más reconocidas a nivel nacional e internacional, construyendo relaciones duraderas basadas en resultados.
          </p>
        </div>

        {/* Grid de Logos */}
        <div className="mt-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 items-center">
            {clients.map((client) => (
              <div key={client.name} className="flex justify-center p-4">
                <div className="relative h-20 w-40 filter grayscale hover:grayscale-0 transition-all duration-300 ease-in-out">
                  <Image
                    src={client.logoSrc}
                    alt={`Logo de ${client.name}`}
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Botón de Acción Principal */}
        <div className="mt-16 text-center">
          <Link href="/clientes" className="bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors duration-300 text-lg">
            Ver Todos los Clientes
          </Link>
        </div>
      </div>
    </section>
  );
}