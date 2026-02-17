import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | COCONSA Sistema Interno",
  description: "Acceso al sistema interno de COCONSA",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
