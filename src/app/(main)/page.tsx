import { Metadata } from 'next';
import HeroSection from "@/components/home/heroSection";
import AboutSection from "@/components/home/aboutSection";
import CertificationsSection from "@/components/home/certificationsSection";
import ServicesSection from "@/components/home/servicesSection";
import ClientsSection from "@/components/home/clientsSection";
import GallerySection from "@/components/home/gallerySection";
import ProjectsSection from "@/components/home/projectsSection";
import MachinesSection from "@/components/home/machinesSection";
import ContactSection from "@/components/home/contactSection";

export const metadata: Metadata = {
  title: 'COCONSA - Constructora y Maquinaria | Líder en Construcción y Renta de Maquinaria',
  description: 'COCONSA es una empresa líder en construcción y renta de maquinaria pesada en México. Ofrecemos servicios de construcción, renta y venta de maquinaria con los más altos estándares de calidad.',
  keywords: 'COCONSA, construcción, maquinaria pesada, renta de maquinaria, construcción industrial, proyectos de construcción, México',
};

  

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <CertificationsSection />
      <ServicesSection />
      <ClientsSection />
      <GallerySection />
      <ProjectsSection />
      <MachinesSection />
      <ContactSection />
    </>
  );
}
