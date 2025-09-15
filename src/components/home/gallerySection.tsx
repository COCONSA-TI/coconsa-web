'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

const images = [
  { src: '/gallery/proyecto-1.jpg', alt: 'Nave industrial de acero construida para cliente del sector automotriz' },
  { src: '/gallery/proyecto-2.jpg', alt: 'Cimentación profunda para un centro comercial en Torreón' },
  { src: '/gallery/proyecto-3.jpg', alt: 'Pavimentación de un patio de maniobras de gran extensión' },
  { src: '/gallery/proyecto-4.jpg', alt: 'Estructura metálica de un edificio comercial en proceso de construcción' },
  { src: '/gallery/proyecto-5.jpg', alt: 'Vista aérea de un complejo industrial completado por COCONSA' },
  { src: '/gallery/proyecto-6.jpg', alt: 'Maquinaria pesada trabajando en un proyecto de infraestructura vial' },
];

export default function GallerySection() {
  const [index, setIndex] = useState(-1);

  return (
    <section id="galeria" className="py-16 sm:py-24 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado de la sección */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-red-700 font-semibold">GALERÍA</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-gray-900">
            Proyectos que Hablan por Sí Mismos
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Explora una selección de nuestros proyectos completados, un testimonio tangible de nuestro compromiso con la calidad, la ingeniería de primer nivel y la atención al detalle.
          </p>
        </div>

        {/* Mosaico de Imágenes */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          {images.map((image, i) => (
            <div
              key={i}
              className={`relative overflow-hidden rounded-lg cursor-pointer group ${i === 0 || i === 3 ? 'col-span-2 row-span-2' : ''
                }`}
              onClick={() => setIndex(i)}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={800}
                height={600}
                className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0  group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
                <p className="text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300">Ver foto</p>
              </div>
            </div>
          ))}
        </div>

        {/* Botón de Acción Principal */}
        <div className="mt-16 text-center">
          <Link href="/galeria" className="bg-red-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-red-700 transition-colors duration-300 text-lg">
            Ver Portafolio Completo
          </Link>
        </div>
      </div>

      {/* Componente Lightbox que se activa al hacer clic */}
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={images}
      />
    </section>
  );
}