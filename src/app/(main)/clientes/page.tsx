import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Clientes | COCONSA - Empresas que Confían en Nosotros',
  description: 'Conozca las empresas que han confiado en COCONSA para sus proyectos de construcción. Nuestra cartera de clientes incluye líderes en diversos sectores industriales.',
  keywords: 'clientes COCONSA, empresas constructoras, proyectos industriales, clientes construcción, referencias COCONSA',
};

const clients = [
    // Fila 1
    { name: 'GRUPO SIMSA', logoSrc: '/clients/grupo-simsa.jpg' },
    { name: 'DILSA', logoSrc: '/clients/dilsa.jpg' },
    { name: 'PEÑOLES', logoSrc: '/clients/penoles.jpg' },
    { name: 'MAGNELEC', logoSrc: '/clients/magnelec.png' },
    // Fila 2
    { name: 'Tecnológico de Monterrey', logoSrc: '/clients/tec-mty.jpg' },
    { name: 'ECOGAS', logoSrc: '/clients/ecogas.png' },
    { name: 'LALA', logoSrc: '/clients/lala.jpg' },
    { name: 'CONAGUA', logoSrc: '/clients/conagua.jpg' },
    // Fila 3
    { name: 'Voltrak', logoSrc: '/clients/voltrak.jpg' },
    { name: 'GTO', logoSrc: '/clients/gto.png' },
    { name: 'Casas GEO', logoSrc: '/clients/casas-geo.jpg' },
    { name: 'Walmart', logoSrc: '/clients/walmart.jpg' },
    // Fila 4
    { name: 'EIFFAGE', logoSrc: '/clients/eiffage.png' },
    { name: 'Atlas Casas', logoSrc: '/clients/atlas.jpg' },
    { name: 'PRODIEL', logoSrc: '/clients/prodiel.jpg' },
    { name: 'Ruba', logoSrc: '/clients/ruba.jpg' },
    // Fila 5
    { name: 'SIMAS', logoSrc: '/clients/simas.jpg' },
    { name: 'JARSA', logoSrc: '/clients/jarsa.jpg' },
    { name: 'Tyson', logoSrc: '/clients/tyson.jpg' },
    { name: 'HOMEX', logoSrc: '/clients/homex.jpg' },
    // Fila 6
    { name: 'Ticsa', logoSrc: '/clients/ticsa.png' },
    { name: 'Colegio Alemán', logoSrc: '/clients/colegio-aleman.png' },
    { name: 'TOZZI', logoSrc: '/clients/tozzi.png' },
    { name: 'PASA', logoSrc: '/clients/pasa.png' },
    // Fila 7
    { name: 'Huntec', logoSrc: '/clients/huntec.png' },
    { name: 'MEGACABLE', logoSrc: '/clients/megacable.png' },
    { name: 'TREBOTTI', logoSrc: '/clients/trebotti.png' },
    { name: 'NUPLEN', logoSrc: '/clients/nuplen.png' },
    // Fila 8
    { name: '7-Eleven', logoSrc: '/clients/seven-eleven.png' },
    { name: 'enel', logoSrc: '/clients/enel-group.png' },
    { name: 'Bachoco', logoSrc: '/clients/bachoco.png' },
    { name: 'TAYCO', logoSrc: '/clients/tayco.png' },
    // Fila 9
    { name: 'Miner S.A', logoSrc: '/clients/miner.png' },
    { name: 'CUATRO D', logoSrc: '/clients/cuatro-D.png' },
    { name: 'Vitro', logoSrc: '/clients/vitro.png' },
    { name: 'ENGIE', logoSrc: '/clients/engie.png' },
    // Fila 10
    { name: 'HBP Group', logoSrc: '/clients/hbp.webp' },
    { name: 'Milwaukee', logoSrc: '/clients/milwaukee.png' },
    { name: 'SIRSA Construcción', logoSrc: '/clients/sirsa.png' },
    { name: 'LINAMAR', logoSrc: '/clients/linamar.jpeg' },
];

export default function ClientesPage() {
    return (
        <main className="bg-white">
            {/* Encabezado */}
            <section className="py-16 sm:py-24 text-center bg-gray-50">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                        La Confianza de Grandes Empresas
                    </h1>
                    <p className="mt-4 text-lg max-w-3xl mx-auto text-gray-600">
                        Nuestra mayor satisfacción es la confianza que nuestros clientes depositan en nosotros para llevar a cabo sus proyectos más importantes.
                    </p>
                </div>
            </section>

            {/* Muro de Logos Unificado */}
            <section className="py-16 container mx-auto px-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center">
                    {clients.map((client) => (
                        <div key={client.name} title={client.name} className="flex justify-center p-4">
                            <div className="relative h-20 w-full filter grayscale hover:grayscale-0 transition-all duration-300 ease-in-out">
                                <Image
                                    src={client.logoSrc}
                                    alt={`Logo de ${client.name}`}
                                    layout="fill"
                                    objectFit="contain"
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA */}
            <section className="bg-red-600">
                <div className="container mx-auto text-center text-white px-4 py-12">
                    <h2 className="text-3xl font-bold mb-4">Conviértete en Nuestro Próximo Caso de Éxito</h2>
                    <Link href="/contacto" className="bg-white text-red-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors">
                        Inicia tu Proyecto
                    </Link>
                </div>
            </section>
        </main>
    );
}