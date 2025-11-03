import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import 'leaflet/dist/leaflet.css';
import { QuotationProvider } from "@/context/QuotationContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en">
      <body className="{inter.className}">
        <QuotationProvider>
        <main className={`min-h-screen flex flex-col ${geistSans.variable} ${geistMono.variable} font-sans`}>
          {children}
        </main>
        </QuotationProvider>
      </body>
    </html>
  );
}
