// src/app/certificaciones/page.tsx
import Image from 'next/image';
import Link from 'next/link';

// Datos de las certificaciones ISO
const isoCertifications = [
  {
    name: 'ISO 9001:2015',
    title: 'Gestión de la Calidad',
    description: 'Esta certificación garantiza que nuestros procesos están estandarizados para entregar consistentemente proyectos que cumplen y superan las expectativas del cliente.',
    benefit: 'Beneficio para ti: Calidad predecible y resultados confiables.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    name: 'ISO 14001:2015',
    title: 'Gestión Ambiental',
    description: 'Demuestra nuestro compromiso con la sostenibilidad, gestionando y minimizando el impacto ambiental de nuestras operaciones en cada proyecto.',
    benefit: 'Beneficio para ti: Proyectos responsables y cumplimiento normativo ambiental.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582" /></svg>
  },
  {
    name: 'ISO 45001:2018',
    title: 'Seguridad y Salud en el Trabajo',
    description: 'Priorizamos la seguridad de nuestro equipo y de todos los involucrados en la obra, implementando un sistema de gestión para prevenir riesgos y accidentes.',
    benefit: 'Beneficio para ti: Entornos de trabajo seguros y reducción de riesgos en tu proyecto.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.745 3.745 0 013.296-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.745 3.745 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg>
  },
];

// Datos de otros registros que ya teníamos
const otherCredentials = [
  { name: 'ISNetworld Member', logoSrc: '/certifications/isn.png', alt: 'Logo de certificación ISNetworld' },
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
              <div className="text-blue-600 mb-4">{cert.icon}</div>
              <h3 className="text-xl font-bold text-gray-900">{cert.name}</h3>
              <p className="text-blue-700 font-semibold mt-1">{cert.title}</p>
              <p className="text-gray-600 mt-4 flex-grow">{cert.description}</p>
              <p className="mt-6 font-bold text-gray-800 bg-gray-100 p-3 rounded-md">{cert.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Sección de Otros Registros */}
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
      </section>
      
      {/* CTA */}
      <section className="bg-blue-600">
        <div className="container mx-auto text-center text-white px-4 py-12">
          <h2 className="text-3xl font-bold mb-4">Trabaja con un Socio Certificado</h2>
          <p className="max-w-2xl mx-auto mb-8">
            Nuestras certificaciones te dan la seguridad y tranquilidad que tu proyecto merece. Contáctanos y construyamos juntos.
          </p>
          <Link href="/contacto" className="bg-white text-blue-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition-colors">
            Iniciar Conversación
          </Link>
        </div>
      </section>
    </main>
  );
}