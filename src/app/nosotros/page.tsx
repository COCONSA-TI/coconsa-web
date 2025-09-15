// src/app/nosotros/page.tsx
import Image from 'next/image';
import Link from 'next/link';

// Datos para la línea de tiempo. Fácil de expandir.
const timelineEvents = [
  { year: 1992, title: 'Fundación de COCONSA', description: 'Nace en Torreón, Coahuila, con el objetivo de ofrecer servicios de construcción de la más alta calidad en la región.' },
  { year: '2000s', title: 'Expansión al Sector Industrial', description: 'Nos consolidamos como un socio estratégico para la construcción de naves y complejos industriales para clientes nacionales e internacionales.' },
  { year: '2010s', title: 'Obtención de Certificaciones ISO', description: 'Implementamos sistemas de gestión de calidad, medio ambiente y seguridad, obteniendo las certificaciones ISO que avalan nuestra excelencia.' },
  { year: '2020s', title: 'Innovación y Grandes Proyectos', description: 'Incursionamos en proyectos de infraestructura a gran escala, como parques solares y plantas de tratamiento, adoptando nuevas tecnologías.' },
];

const values = [
    { name: 'Calidad', description: 'Superamos los estándares para entregar resultados excepcionales.' },
    { name: 'Seguridad', description: 'Priorizamos la integridad de nuestro equipo y proyectos.' },
    { name: 'Honestidad', description: 'Actuamos con transparencia y ética en cada acuerdo.' },
    { name: 'Mejora Continua', description: 'Innovamos constantemente para ofrecer las mejores soluciones.' },
];

export default function NosotrosPage() {
  return (
    <main className="bg-white text-gray-800">
      {/* 1. Hero Section */}
      <section className="relative h-[40vh] flex items-center justify-center text-white">
        <Image
          src="/imagen_principal.jpg"
          alt="Oficinas corporativas de COCONSA"
          layout="fill"
          objectFit="cover"
          className="brightness-50"
          priority
        />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold">Más de 4 Décadas Construyendo Confianza</h1>
        </div>
      </section>

      {/* 2. Misión y Visión */}
      <section className="py-16 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-center">
          <div>
            <h2 className="text-3xl font-bold text-red-700 mb-4">Nuestra Misión</h2>
            <p className="text-lg leading-relaxed">
                Realizar obras que generen el mayor valor al cliente con base en ofrecer la más alta calidad, el cumplimiento de los tiempos requeridos, con la máxima seguridad y cuidando el entorno ecológico.

            </p>
          </div>
          <div>
            <h2 className="text-3xl font-bold text-red-700 mb-4">Nuestra Visión</h2>
            <p className="text-lg leading-relaxed">
                Ser una empresa consolidada en base a un crecimiento vertical siendo autosuficientes en la construcción de obras tecnológicas, civiles, hidráulicas, urbanizaciones y terracerías que detonen el desarrollo del país, con base en que sus mayores ventajas competitivas sean sus recursos humanos e infraestructura.
            </p>
          </div>
        </div>
      </section>
      
      {/* 3. Línea de Tiempo */}
      <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-12">Nuestra Trayectoria</h2>
              <div className="relative max-w-2xl mx-auto">
                  <div className="absolute left-1/2 w-0.5 h-full bg-red-300 transform -translate-x-1/2"></div>
                  {timelineEvents.map((event, index) => (
                      <div key={index} className="mb-8 flex justify-between items-center w-full">
                          <div className={`order-1 w-5/12 ${index % 2 !== 0 ? 'md:order-3' : ''}`}></div>
                          <div className="z-20 flex items-center order-2 bg-red-600 shadow-xl w-8 h-8 rounded-full">
                              <h3 className="mx-auto font-semibold text-sm text-white">{event.year}</h3>
                          </div>
                          <div className={`order-3 w-5/12 bg-white p-4 rounded-lg shadow-lg ${index % 2 !== 0 ? 'md:order-1' : ''}`}>
                              <h4 className="font-bold text-gray-900">{event.title}</h4>
                              <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </section>
      
      {/* 4. Valores y Equipo */}
      <section className="py-16 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
                <h2 className="text-3xl font-bold mb-6">Nuestros Valores</h2>
                <div className="space-y-4">
                    {values.map(value => (
                        <div key={value.name}>
                            <h3 className="text-xl font-semibold text-red-700">{value.name}</h3>
                            <p className="text-gray-600">{value.description}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <Image src="/nosotros/nosotros.png" alt="Equipo de COCONSA" width={600} height={400} className="rounded-lg shadow-2xl"/>
                <h3 className="text-2xl font-bold mt-6">Un Equipo Comprometido con la Excelencia</h3>
                <p className="text-gray-600 mt-2">Nuestro mayor activo es nuestro talentoso equipo de ingenieros, arquitectos, técnicos y personal administrativo que hacen posible cada proyecto.</p>
            </div>
        </div>
      </section>

      {/* 5. CTA a Proyectos */}
      <section className="bg-gray-900 text-white">
        <div className="container mx-auto text-center px-4 py-12">
          <h2 className="text-3xl font-bold mb-4">Ve Nuestros Resultados</h2>
          <p className="max-w-2xl mx-auto mb-8">
            Nuestra historia y valores se reflejan en cada obra que entregamos. Explora nuestro portafolio para ver nuestro compromiso en acción.
          </p>
          <Link href="/proyectos" className="bg-red-600 font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors">
            Explorar Proyectos
          </Link>
        </div>
      </section>
    </main>
  );
}