import HeroSection from "@/components/home/heroSection";
import AboutSection from "@/components/home/aboutSection";
import CertificationsSection from "@/components/home/certificationsSection";
import ServicesSection from "@/components/home/servicesSection";
import ClientsSection from "@/components/home/clientsSection";
import GallerySection from "@/components/home/gallerySection";
import ProjectsSection from "@/components/home/projectsSection";
import MachinesSection from "@/components/home/machinesSection";
import ContactSection from "@/components/home/contactSection";

  

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
