import Image from 'next/image';
import Link from 'next/link';

export default function ProjectsSection() {
  return (
    <section id="proyectos" className="py-16 sm:py-24 bg-gray-900 text-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Columna de Texto */}
          <div className="space-y-6 text-center lg:text-left">
            <p className="text-red-700 font-semibold">PORTAFOLIO DE PROYECTOS</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Nuestra Huella en la República Mexicana
            </h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              Hemos tenido el privilegio de participar en el desarrollo de infraestructura clave a lo largo del país. Cada punto en el mapa representa un proyecto completado, una relación de confianza y un paso más en la construcción del futuro de México.
            </p>

            {/* Estadísticas de Impacto */}
            <div className="flex justify-center lg:justify-start space-x-8 pt-4">
              <div className="text-center">
                <span className="block text-4xl font-bold text-red-700">15+</span>
                <span className="text-gray-400">Estados</span>
              </div>
              <div className="text-center">
                <span className="block text-4xl font-bold text-red-700">200+</span>
                <span className="text-gray-400">Proyectos</span>
              </div>
              <div className="text-center">
                <span className="block text-4xl font-bold text-red-700">40</span>
                <span className="text-gray-400">Años</span>
              </div>
            </div>

            <div className="pt-6">
              <Link href="/proyectos" className="inline-block bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors duration-300 text-lg">
                Explora el Mapa Interactivo
              </Link>
            </div>
          </div>

          {/* Columna del Mapa (Imagen Estática) */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-lg h-auto">
              <Image
                src="/mapa-proyectos.png"
                alt="Mapa de México mostrando la ubicación de los proyectos de COCONSA"
                width={600}
                height={450}
                className="rounded-lg shadow-2xl"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}