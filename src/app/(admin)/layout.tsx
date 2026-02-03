import type { Metadata } from "next";
import AdminLayoutClient from "@/components/admin/AdminLayoutClient";

export const metadata: Metadata = {
  title: "Dashboard | COCONSA Sistema Interno",
  description: "Sistema interno de gestión COCONSA",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
