import type { Metadata } from "next";
import AdminNavbar from "@/components/admin/adminNavbar";
import AdminSidebar from "@/components/admin/adminSidebar";
import AdminFooter from "@/components/admin/adminFooter";

export const metadata: Metadata = {
  title: "Dashboard | COCONSA Sistema Interno",
  description: "Sistema interno de gestión COCONSA",
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <AdminNavbar />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
      <AdminFooter />
    </div>
  );
}
