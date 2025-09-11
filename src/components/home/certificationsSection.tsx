import Image from 'next/image';

const certifications = [
  {
    name: 'ISNetworld Member',
    description: 'Cumplimos con los más altos estándares internacionales de seguridad y gestión de contratistas.',
    logoSrc: '/certifications/isn.webp',
    alt: 'Logo de certificación ISNetworld'
  },
  {
    name: 'Empresa Socialmente Responsable',
    description: 'Reconocimiento a nuestro compromiso con el desarrollo social y el cuidado del medio ambiente.',
    logoSrc: '/certifications/esr.png',
    alt: 'Distintivo ESR como Empresa Socialmente Responsable'
  },
  {
    name: 'Registro REPSE',
    description: 'Autorizados y registrados ante la STPS para la prestación de servicios y obras especializadas.',
    logoSrc: '/certifications/repse.png',
    alt: 'Registro REPSE de la Secretaría del Trabajo y Previsión Social'
  }
];

export default function CertificationsSection() {
  return (
    <section id="certificaciones" className="py-16 sm:py-24 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado de la sección */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-red-700 font-semibold">CONFIANZA Y CUMPLIMIENTO</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">
            Compromiso con la Calidad y la Seguridad
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Nuestras certificaciones y registros son el reflejo de nuestro compromiso con la excelencia, garantizando las mejores prácticas en cada proyecto para tu total tranquilidad.
          </p>
        </div>

        {/* Logos de Certificaciones */}
        <div className="mt-12">
          <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
            {certifications.map((cert) => (
              <div key={cert.name} className="flex flex-col items-center text-center w-64">
                <div className="relative h-24 w-48 mb-4">
                  <Image
                    src={cert.logoSrc}
                    alt={cert.alt}
                    layout="fill"
                    objectFit="contain"
                  />
                </div>
                <h3 className="font-semibold text-gray-800">{cert.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{cert.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}