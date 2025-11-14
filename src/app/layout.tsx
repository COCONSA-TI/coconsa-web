import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import 'leaflet/dist/leaflet.css';
import { QuotationProvider } from "@/context/QuotationContext";
import RecaptchaProvider from "@/components/RecaptchaProvider";

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
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <RecaptchaProvider>
          <QuotationProvider>
            {children}
          </QuotationProvider>
        </RecaptchaProvider>
      </body>
    </html>
  );
}
