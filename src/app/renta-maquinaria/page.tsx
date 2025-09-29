// src/app/renta-maquinaria/page.tsx
'use client'; // Necesario para usar hooks como useQuotation
import Image from 'next/image';
import Link from 'next/link';
import { useQuotation } from '@/context/QuotationContext';
import { useState } from 'react'; // 1. Importa useState

// Catálogo de maquinaria. Fácil de expandir y mantener.
const machineryCatalog = [
  {
    category: 'Bulldozers',
    description: 'Potencia y precisión para empuje, desmonte y nivelación de grandes superficies de terreno.',
    imageSrc: '/machines/bulldozer.jpg',
  },
  {
    category: 'Camiones de Volteo',
    description: 'Transporte eficiente y seguro de materiales a granel como tierra, grava y escombro.',
    imageSrc: '/machines/camion-volteo.jpg',
  },
  {
    category: 'Excavadora',
    description: 'Versatilidad para excavación, zanjeo y movimiento de tierras en todo tipo de proyectos constructivos.',
    imageSrc: '/machines/excavadora.jpg',
  },
  {
    category: 'Motoconformadora',
    description: 'Alta precisión para la nivelación final de superficies, ideal para la creación de caminos y plataformas.',
    imageSrc: '/machines/motoconformadora.jpg',
  },
  {
    category: 'Pipa Freightliner',
    description: 'Suministro y riego de agua para control de polvo, compactación y otros usos esenciales en obra.',
    imageSrc: '/machines/pipa-freightliner.jpg',
  },
  {
    category: 'Retroexcavadora',
    description: 'Equipo multifuncional, perfecto para zanjas, carga de materiales y trabajos en espacios reducidos.',
    imageSrc: '/machines/retroexcavadora.jpg',
  },
  {
    category: 'Tractocamión con Góndola',
    description: 'Transporte de grandes volúmenes de material a granel para el abastecimiento eficiente de tus proyectos.',
    imageSrc: '/machines/tractocamion-gondola.jpg',
  }
];

export default function RentaMaquinariaPage() {
  const { addItem, items } = useQuotation(); 
  // 2. Crea un estado para rastrear los items recién añadidos
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // 3. Crea una función para manejar el clic
  const handleAddItem = (category: string) => {
    addItem(category);
    setJustAdded(category); // Marca el item como recién añadido

    // 4. Revierte el estado del botón después de 2 segundos
    setTimeout(() => {
      setJustAdded(null);
    }, 2000);
  };

  return (
    <main className="bg-white">
      {/* 1. Hero Section */}
      <section className="relative h-[50vh] flex items-center justify-center text-white">
        <Image
          src="/machines/maquinaria-hero.jpg"
          alt="Flota de maquinaria pesada de COCONSA en un proyecto"
          layout="fill"
          objectFit="cover"
          className="brightness-50"
          priority
        />
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-bold">Renta de Maquinaria Pesada</h1>
          <p className="mt-4 text-lg md:text-xl max-w-3xl">Equipos modernos y operadores certificados para garantizar la máxima eficiencia en tu proyecto.</p>
        </div>
      </section>

      {/* 2. Catálogo de Maquinaria */}
      <section className="py-16 sm:py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Nuestro Catálogo de Equipos</h2>
            <p className="mt-2 text-lg text-gray-600">Encuentra la maquinaria que necesitas para cada fase de tu obra.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {machineryCatalog.map((machine) => {
              // 5. Comprueba si el item ya está en la cotización o si se acaba de añadir
              const isAdded = items.some(item => item.id === machine.category);
              const wasJustAdded = justAdded === machine.category;

              return (
                <div key={machine.category} className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col group">
                  <div className="relative h-56">
                    <Image
                      src={machine.imageSrc}
                      alt={`Imagen de ${machine.category}`}
                      layout="fill"
                      objectFit="cover"
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-6 flex-grow flex flex-col">
                    <h3 className="text-2xl font-bold text-gray-900">{machine.category}</h3>
                    <p className="mt-2 text-gray-600 flex-grow">{machine.description}</p>
                    {/* BOTÓN CON LÓGICA CONDICIONAL */}
                    <button 
                      onClick={() => handleAddItem(machine.category)}
                      disabled={isAdded || wasJustAdded} // Deshabilitado si ya está añadido
                      className={`
                        mt-6 w-full text-center font-bold py-2 px-4 rounded-lg transition-colors
                        ${isAdded || wasJustAdded 
                          ? 'bg-green-500 text-white cursor-not-allowed' // Estilo para botón añadido
                          : 'bg-red-600 text-white hover:bg-red-700' // Estilo normal
                        }
                      `}
                    >
                      {isAdded || wasJustAdded ? 'Añadido ✓' : 'Añadir a Cotización'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {/* AÑADIR UN BOTÓN PARA IR A LA PÁGINA DE COTIZACIÓN */}
          <div className="text-center mt-12">
            <Link href="/cotizacion" className="bg-gray-800 text-white font-bold py-3 px-8 rounded-lg hover:bg-black transition-colors">
                Ver Cotización ({items.length})
            </Link>
          </div>
        </div>
      </section>
      
  {/* 3. Por Qué Elegirnos */}
      <section className="py-16 container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Ventajas de Nuestro Servicio</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto text-gray-900">
            <div className="text-center p-4">
                <h3 className="text-xl font-semibold mb-2">Flota Moderna</h3>
                <p>Equipos de las mejores marcas con tecnología de punta para un rendimiento óptimo.</p>
            </div>
            <div className="text-center p-4">
                <h3 className="text-xl font-semibold mb-2">Operadores Expertos</h3>
                <p>Personal certificado y con amplia experiencia para garantizar operaciones seguras y eficientes.</p>
            </div>
            <div className="text-center p-4">
                <h3 className="text-xl font-semibold mb-2">Mantenimiento Riguroso</h3>
                <p>Todos nuestros equipos siguen un estricto programa de mantenimiento preventivo para evitar contratiempos.</p>
            </div>
        </div>
      </section>

      {/* 4. CTA Específico */}
      <section className="bg-red-600">
        <div className="container mx-auto text-center text-white px-4 py-12">
          <h2 className="text-3xl font-bold mb-4">¿Necesitas un Equipo para tu Obra?</h2>
          <p className="max-w-2xl mx-auto mb-8">
            Contacta a nuestro departamento de maquinaria para obtener una cotización y asegurar la disponibilidad de los equipos que necesitas.
          </p>
          <Link href="/cotizacion" className="bg-white text-red-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors">
            Solicitar Cotización
          </Link>
        </div>
      </section>
    </main>
  );
}