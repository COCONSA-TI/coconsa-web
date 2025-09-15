// src/app/galeria/page.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Base de datos de imágenes. A cada imagen le asignamos una categoría.
// Usa las categorías de tus servicios para que todo sea consistente.
const allProjects = [
  { src: '/gallery/proyecto-1.jpg', alt: 'Nave industrial de acero', category: 'Naves Industriales' },
  { src: '/gallery/proyecto-2.jpg', alt: 'Cimentación para centro comercial', category: 'Edificaciones' },
  { src: '/gallery/proyecto-3.jpg', alt: 'Pavimentación de un patio de maniobras', category: 'Urbanizaciones' },
  { src: '/gallery/proyecto-4.jpg', alt: 'Estructura metálica de un edificio comercial', category: 'Edificaciones' },
  { src: '/gallery/proyecto-5.jpg', alt: 'Vista aérea de un complejo industrial', category: 'Naves Industriales' },
  { src: '/gallery/proyecto-6.jpg', alt: 'Maquinaria en proyecto de parque solar', category: 'Parques Solares' },
  { src: '/gallery/proyecto-7.jpg', alt: 'Construcción de gasolinera', category: 'Gasolineras' },
  { src: '/gallery/proyecto-8.jpg', alt: 'Planta de tratamiento de agua municipal', category: 'PTAR' },
  { src: '/gallery/proyecto-9.jpg', alt: 'Infraestructura vial en zona urbana', category: 'Vialidades' },
  { src: '/gallery/proyecto-10.png', alt: 'Obra hidráulica en canal de riego', category: 'Obras Hidráulicas' },
  { src: '/gallery/proyecto-11.jpg', alt: 'Terracerías para desarrollo habitacional', category: 'Terracerías' },
  { src: '/gallery/proyecto-12.jpg', alt: 'Construcción de planta industrial', category: 'Naves Industriales' },
  { src: '/gallery/proyecto-13.jpg', alt: 'Obra civil en proyecto comercial', category: 'Edificaciones' },
  { src: '/gallery/proyecto-14.jpg', alt: 'Pavimentación de calle urbana', category: 'Urbanizaciones' },
  { src: '/gallery/proyecto-15.jpg', alt: 'Instalación de estructura metálica', category: 'Edificaciones' },
  { src: '/gallery/proyecto-16.jpg', alt: 'Complejo industrial desde el aire', category: 'Naves Industriales' },
  { src: '/gallery/proyecto-17.jpg', alt: 'Maquinaria en obra vial', category: 'Vialidades' },
  { src: '/gallery/proyecto-18.jpg', alt: 'Construcción de gasolinera', category: 'Gasolineras' }
  // ...Añade aquí todas las fotos de tus proyectos
];

// Obtenemos las categorías únicas para crear los botones de filtro
const categories = ['Todo', ...Array.from(new Set(allProjects.map(p => p.category)))];

export default function GaleriaPage() {
  const [filter, setFilter] = useState('Todo');
  const [index, setIndex] = useState(-1);

  const filteredProjects = filter === 'Todo' 
    ? allProjects 
    : allProjects.filter(p => p.category === filter);

  return (
    <main className="bg-white">
      {/* Encabezado */}
      <section className="py-16 sm:py-24 text-center bg-gray-50">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Galería de Proyectos
          </h1>
          <p className="mt-4 text-lg max-w-3xl mx-auto text-gray-600">
            Nuestro trabajo es nuestra mejor carta de presentación. Explora una selección de proyectos que demuestran nuestro compromiso con la calidad y la excelencia en la construcción.
          </p>
        </div>
      </section>

      {/* Galería con Filtros */}
      <section className="py-16 container mx-auto px-4">

        {/* Grid de Imágenes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project, i) => (
            <div
              key={project.src}
              className="relative aspect-w-4 aspect-h-3 overflow-hidden rounded-lg cursor-pointer group"
              onClick={() => setIndex(i)}
            >
              <Image
                src={project.src}
                alt={project.alt}
                width={600}
                height={450}
                className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-end p-4">
                <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-y-4 group-hover:translate-y-0">
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={filteredProjects}
      />
      
      {/* CTA */}
      <section className="bg-red-600">
        <div className="container mx-auto text-center text-white px-4 py-12">
          <h2 className="text-3xl font-bold mb-4">Inspírate para tu Próximo Gran Proyecto</h2>
          <Link href="/contacto" className="bg-white text-red-600 font-bold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors">
            Contáctanos y Empecemos a Construir
          </Link>
        </div>
      </section>
    </main>
  );
}