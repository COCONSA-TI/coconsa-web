import Image from 'next/image';

export type Service = {
  name: string;
  description: string;
  href: string;
  icon: React.ReactNode;
};

export const services: Service[] = [
  {
    name: 'Naves Industriales',
    description: 'Construcción integral de naves industriales, desde la cimentación hasta la entrega llave en mano.',
    href: '/servicios/naves-industriales',
    icon: <Image src="/services/naves-industriales.jpg" alt="Icono de Naves Industriales" width={100} height={50} className="w-100 h-50" />
  },
  {
    name: 'Edificaciones',
    description: 'Desarrollo de edificaciones verticales y horizontales, incluyendo proyectos comerciales y residenciales.',
    href: '/servicios/edificaciones',
    icon: <Image src="/services/edificaciones.jpg" alt="Icono de Edificaciones" width={100} height={50} className="w-100 h-50" />
  },
  {
    name: 'Movimiento de Tierras',
    description: 'Excavación, nivelación y preparación de terrenos a gran escala para cualquier tipo de proyecto constructivo.',
    href: '/servicios/movimiento-de-tierras',
    icon: <Image src="/services/movimiento-de-tierras.jpg" alt="Icono de Movimiento de Tierras" width={100} height={50} className="w-100 h-50" /> 
  },
  {
    name: 'Urbanizaciones',
    description: 'Creación de infraestructura urbana completa: vialidades, redes de agua potable, drenaje y electrificación.',
    href: '/servicios/urbanizaciones',
    icon: <Image src="/services/urbanizaciones.jpg" alt="Icono de Urbanizaciones" width={100} height={50} className="w-100 h-50" />
  },
  {
    name: 'Gasolineras',
    description: 'Construcción y remodelación de estaciones de servicio, cumpliendo con todas las normativas de seguridad.',
    href: '/servicios/gasolineras',
    icon: <Image src="/services/gasolineras.jpg" alt="Icono de Gasolineras" width={100} height={50} className="w-100 h-50" /> 
  },
  {
    name: 'Plantas de Tratamiento de Agua',
    description: 'Ingeniería y construcción de PTAR para el tratamiento de aguas residuales industriales y municipales.',
    href: '/servicios/ptar',
    icon: <Image src="/services/plantas-de-tratamiento-de-agua.jpg" alt="Icono de Plantas de Tratamiento de Agua" width={100} height={50} className="w-100 h-50" />
  },
  {
    name: 'Parques Solares',
    description: 'Preparación de sitio, cimentaciones e infraestructura civil para proyectos de energía fotovoltaica.',
    href: '/servicios/parques-solares',
    icon: <Image src="/services/parques-solares.jpg" alt="Icono de Parques Solares" width={100} height={50} className="w-100 h-50" />},
  {
    name: 'Sistemas de Riego',
    description: 'Diseño e instalación de sistemas de riego eficientes para proyectos agrícolas y agroindustriales.',
    href: '/servicios/sistemas-de-riego',
    icon: <Image src="/services/sistemas-de-riego.jpg" alt="Icono de Sistemas de Riego" width={100} height={50} className="w-100 h-50" />},
  {
    name: 'Establos',
    description: 'Construcción de establos.',
    href: '/servicios/tif',
    icon: <Image src="/services/establos.jpg" alt="Icono de Establos" width={100} height={50} className="w-100 h-50" />
  },
];