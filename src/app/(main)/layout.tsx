import type { Metadata } from "next";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "COCONSA - Empresa Constructora",
  description: "Lideres en construcción industrial y comercial en la Comarca Lagunera.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="font-montserrat">
      <Navbar />
      <main className="min-h-screen flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
