import Image from 'next/image';
import Link from 'next/link';

// Datos de las certificaciones ISO
const isoCertifications = [
  {
    name: 'ISO 9001:2015',
    title: 'Gestión de la Calidad',
    description: 'Esta certificación garantiza que nuestros procesos están estandarizados para entregar consistentemente proyectos que cumplen y superan las expectativas del cliente.',
    benefit: 'Beneficio para ti: Calidad predecible y resultados confiables.',
    iconSrc: '/certifications/iso9001.webp',
    iconAlt: 'ISO 9001',
  },
  {
    name: 'ISO 14001:2015',
    title: 'Gestión Ambiental',
    description: 'Demuestra nuestro compromiso con la sostenibilidad, gestionando y minimizando el impacto ambiental de nuestras operaciones en cada proyecto.',
    benefit: 'Beneficio para ti: Proyectos responsables y cumplimiento normativo ambiental.',
    iconSrc: '/certifications/iso14001.webp',
    iconAlt: 'ISO 14001',
  },
  {
    name: 'ISO 45001:2018',
    title: 'Seguridad y Salud en el Trabajo',
    description: 'Priorizamos la seguridad de nuestro equipo y de todos los involucrados en la obra, implementando un sistema de gestión para prevenir riesgos y accidentes.',
    benefit: 'Beneficio para ti: Entornos de trabajo seguros y reducción de riesgos en tu proyecto.',
    iconSrc: '/certifications/iso45001.png',
    iconAlt: 'ISO 45001',
  },
];

// Datos de otros registros que ya teníamos
const otherCredentials = [
  { name: 'ISNetworld Member', logoSrc: '/certifications/isn.webp', alt: 'Logo de certificación ISNetworld' },
  { name: 'Empresa Socialmente Responsable', logoSrc: '/certifications/esr.png', alt: 'Distintivo ESR' },
  { name: 'Registro REPSE', logoSrc: '/certifications/repse.png', alt: 'Registro REPSE' }
];

export default function CertificacionesPage() {
  return (
    <main className="bg-white">
      {/* Encabezado */}
      <section className="py-16 sm:py-24 text-center bg-gray-50">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Nuestro Compromiso con la Excelencia
          </h1>
          <p className="mt-4 text-lg max-w-3xl mx-auto text-gray-600">
            Las certificaciones y registros que mantenemos son más que logos; son la garantía de que cada proyecto se ejecuta con los más altos estándares de calidad, seguridad y responsabilidad.
          </p>
        </div>
      </section>

      {/* Sección de Certificaciones ISO */}
      <section className="py-16 container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Estándares Internacionales (ISO)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {isoCertifications.map((cert) => (
            <div key={cert.name} className="bg-white border border-gray-200 rounded-lg shadow-lg p-8 text-center flex flex-col items-center">
              <div className="mb-4">
                <div className="mx-auto w-16 h-16 relative filter grayscale hover:grayscale-0 transition-all duration-300">
                  <Image
                    src={cert.iconSrc}
                    alt={cert.iconAlt}
                    width={64}
                    height={64}
                    style={{ objectFit: 'contain' }}
                    loading="lazy"
                  />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{cert.name}</h3>
              <p className="text-red-700 font-semibold mt-1">{cert.title}</p>
              <p className="text-gray-600 mt-4 flex-grow">{cert.description}</p>
              <p className="mt-6 font-bold text-gray-800 bg-gray-100 p-3 rounded-md">{cert.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sección de Otros Registros
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Otros Registros y Distintivos</h2>
          <div className="flex flex-wrap justify-center items-center gap-x-16 gap-y-8">
            {otherCredentials.map((cred) => (
              <div key={cred.name} className="flex flex-col items-center text-center w-64">
                <div className="relative h-24 w-48 mb-4">
                  <Image src={cred.logoSrc} alt={cred.alt} layout="fill" objectFit="contain" />
                </div>
                <h3 className="font-semibold text-gray-800">{cred.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section> */}
      
      {/* CTA */}
      <section className="bg-red-600">
        <div className="container mx-auto text-center text-white px-4 py-12">
          <h2 className="text-3xl font-bold mb-4">Trabaja con un Socio Certificado</h2>
          <p className="max-w-2xl mx-auto mb-8">
            Nuestras certificaciones te dan la seguridad y tranquilidad que tu proyecto merece. Contáctanos y construyamos juntos.
          </p>
          <Link href="/contacto" className="bg-white text-red-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors">
            Iniciar Conversación
          </Link>
        </div>
      </section>
    </main>
  );
}