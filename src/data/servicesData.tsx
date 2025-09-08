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
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h6M9 11.25h6m-6 4.5h6M6.75 21v-2.25a2.25 2.25 0 012.25-2.25h6a2.25 2.25 0 012.25 2.25V21" /></svg>
  },
  {
    name: 'Edificaciones',
    description: 'Desarrollo de edificaciones verticales y horizontales, incluyendo proyectos comerciales y residenciales.',
    href: '/servicios/edificaciones',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 12h15M5.25 12v-6.75a2.25 2.25 0 012.25-2.25h6a2.25 2.25 0 012.25 2.25v6.75m-15 0v6.75a2.25 2.25 0 002.25 2.25h6a2.25 2.25 0 002.25-2.25v-6.75m-15 0h15" /></svg>
  },
  {
    name: 'Movimiento de Tierras',
    description: 'Excavación, nivelación y preparación de terrenos a gran escala para cualquier tipo de proyecto constructivo.',
    href: '/servicios/movimiento-de-tierras',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-6h6" /></svg> // Placeholder icon
  },
  {
    name: 'Urbanizaciones',
    description: 'Creación de infraestructura urbana completa: vialidades, redes de agua potable, drenaje y electrificación.',
    href: '/servicios/urbanizaciones',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m-3-1l-3-1m3 1v5.505M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    name: 'Gasolineras',
    description: 'Construcción y remodelación de estaciones de servicio, cumpliendo con todas las normativas de seguridad.',
    href: '/servicios/gasolineras',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
  },
  {
    name: 'Plantas de Tratamiento de Agua',
    description: 'Ingeniería y construcción de PTAR para el tratamiento de aguas residuales industriales y municipales.',
    href: '/servicios/ptar',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.998 15.998 0 011.622-3.385m5.043.025a15.998 15.998 0 001.622-3.385m3.388 1.62a15.998 15.998 0 01-3.388-1.62m-16.5 7.499a15.998 15.998 0 0116.5 0m-16.5 0a15.998 15.998 0 0016.5 0" /></svg>
  },
  {
    name: 'Parques Solares',
    description: 'Preparación de sitio, cimentaciones e infraestructura civil para proyectos de energía fotovoltaica.',
    href: '/servicios/parques-solares',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
  },
  {
    name: 'Sistemas de Riego',
    description: 'Diseño e instalación de sistemas de riego eficientes para proyectos agrícolas y agroindustriales.',
    href: '/servicios/sistemas-de-riego',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" /></svg>
  },
  {
    name: 'Establos',
    description: 'Construcción de establos.',
    href: '/servicios/tif',
    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-4.243-4.243l3.275-3.275a4.5 4.5 0 00-6.336 4.486c.046.58.176 1.193.34 1.743m4.843-2.344a3.004 3.004 0 00-4.243-4.243L6.75 12.75a3.004 3.004 0 004.243 4.243" /></svg>
  },
];