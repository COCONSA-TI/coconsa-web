import Image from 'next/image';

export default function HeroSection() {
    return (
        <section className="relative h-[60vh] text-white">
            {/* Imagen de Fondo */}
            <Image
                src="/imagen_principal.jpg"
                alt="Construcción de fraccionamiento"
                layout="fill"
                objectFit="cover"
                quality={85}
                priority
            />
            {/* Capa oscura para legibilidad del texto */}
            <div className="absolute inset-0 bg-black opacity-50"></div>

            {/* Contenido de Texto */}
            <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-4">
                <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-4">
                    Construimos los cimientos de tu futuro
                </h1>
                <p className="text-lg md:text-xl max-w-3xl">
                    Más de 40 años de experiencia en proyectos de construcción industrial, comercial e infraestructura.
                </p>
            </div>
        </section>
    );
}