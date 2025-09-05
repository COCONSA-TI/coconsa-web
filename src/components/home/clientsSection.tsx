import Image from 'next/image';

const clients = [
  { name: 'Caterpillar', logoSrc: '/clients/caterpillar.svg' },
  { name: 'John Deere', logoSrc: '/clients/john-deere.svg' },
  { name: 'HEB', logoSrc: '/clients/heb.svg' },
  { name: 'Soriana', logoSrc: '/clients/soriana.svg' },
  { name: 'Lala', logoSrc: '/clients/lala.svg' },
  { name: 'Pilgrims', logoSrc: '/clients/pilgrims.svg' },
  { name: 'Tyson', logoSrc: '/clients/tyson.svg' },
  { name: 'Sumitomo', logoSrc: '/clients/sumitomo.svg' },
  // ... añade más clientes según sea necesario
];

export default function ClientsSection() {
  return (
    <section id="clientes" className="py-16 sm:py-24 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado de la sección */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-blue-600 font-semibold">NUESTROS CLIENTES</p>
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
      </div>
    </section>
  );
}