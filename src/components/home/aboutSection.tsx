import Image from 'next/image';
import Link from 'next/link';

const values = [
  { name: 'Calidad', description: 'Superamos los estándares para entregar resultados excepcionales.' },
  { name: 'Seguridad', description: 'Priorizamos la integridad de nuestro equipo y proyectos.' },
  { name: 'Honestidad', description: 'Actuamos con transparencia y ética en cada acuerdo.' },
  { name: 'Mejora Continua', description: 'Innovamos constantemente para ofrecer las mejores soluciones.' },
];

export default function AboutSection() {
  return (
    <section id="nosotros" className="py-16 sm:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Columna de Imagen */}
          <div className="order-last lg:order-first">
            <div className="aspect-w-4 aspect-h-3 rounded-lg overflow-hidden shadow-2xl">
              <Image
                src="/imagen-nosotros.jpg"
                alt="Equipo de ingenieros de COCONSA supervisando una obra de construcción"
                width={800}
                height={600}
                className="object-cover"
              />
            </div>
          </div>

          {/* Columna de Texto */}
          <div className="space-y-6">
            <div className="text-left">
              <p className="text-red-700 font-semibold mb-2">SOBRE NOSOTROS</p>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Más de 40 Años Forjando el Futuro de la Construcción
              </h2>
            </div>
            <p className="text-lg text-gray-600 leading-relaxed">
              Somos una empresa constructora fundada en 1992 en Torreón, Coahuila, dedicada a satisfacer las necesidades de nuestros clientes en el sector industrial, comercial e infraestructura. Nuestro compromiso es ejecutar proyectos con los más altos estándares de calidad, seguridad y honestidad, buscando siempre la mejora continua y la plena satisfacción del cliente.
            </p>

            {/* Sección de Valores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              {values.map((value) => (
                <div key={value.name} className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-800">{value.name}</h3>
                  <p className="text-sm text-gray-600">{value.description}</p>
                </div>
              ))}
            </div>

            <div className="pt-4">
              <Link href="/nosotros" className="text-red-700 font-semibold hover:underline">
                Conoce más sobre nuestra historia →
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}