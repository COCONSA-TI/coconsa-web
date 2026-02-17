export default function AdminFooter() {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-6">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
        <p>© {new Date().getFullYear()} COCONSA. Todos los derechos reservados.</p>
        <div className="flex gap-4 mt-2 md:mt-0">
          <a href="#" className="hover:text-red-600 transition-colors">Ayuda</a>
          <a href="#" className="hover:text-red-600 transition-colors">Privacidad</a>
          <a href="#" className="hover:text-red-600 transition-colors">Términos</a>
        </div>
      </div>
    </footer>
  );
}
