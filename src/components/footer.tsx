import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* Columna 1: Logo e Información */}
          <div className="space-y-4">
            <Image
              src="/logo-coconsa.png"
              alt="Logo de COCONSA"
              width={180}
              height={45}
            />
            <p className="text-sm">
              Líderes en construcción y renta de maquinaria en la Comarca Lagunera desde 1992.
            </p>
          </div>

          {/* Columna 2: Navegación */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Navegación</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/servicios" className="hover:text-red-700 transition-colors">Servicios</Link></li>
              <li><Link href="/proyectos" className="hover:text-red-700 transition-colors">Proyectos</Link></li>
              <li><Link href="/nosotros" className="hover:text-red-700 transition-colors">Nosotros</Link></li>
              <li><Link href="/contacto" className="hover:text-red-700 transition-colors">Contacto</Link></li>
            </ul>
          </div>

          {/* Columna 3: Contacto */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Contacto</h3>
            <div className="space-y-2 text-sm">
              <p>Joaquin Serrano #255,<br />Torreón, Coahuila, México, CP 27019</p>
              <p><strong>Teléfono:</strong> 871 754 1464</p>
              <p><strong>Email:</strong> ventas@coconsa.com.mx</p>
            </div>
          </div>

        </div>

        {/* Barra de Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} COCONSA S.A. de C.V. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}