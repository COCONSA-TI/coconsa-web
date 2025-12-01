import ClientChatbot from "@/components/ClientChatbot";

export default function ClientReportsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Portal de Clientes
          </h1>
          <p className="text-gray-600">
            Consulta el avance de tus proyectos en tiempo real
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold text-lg mb-2">Avances en Tiempo Real</h3>
            <p className="text-sm text-gray-600">
              Consulta el avance físico y financiero de tu proyecto actualizado constantemente
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">👷</div>
            <h3 className="font-bold text-lg mb-2">Contacto Directo</h3>
            <p className="text-sm text-gray-600">
              Accede a la información de contacto de tu supervisor y equipo del proyecto
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">💬</div>
            <h3 className="font-bold text-lg mb-2">Asistente Inteligente</h3>
            <p className="text-sm text-gray-600">
              Pregunta cualquier duda sobre tu proyecto y obtén respuestas instantáneas
            </p>
          </div>
        </div>

        <ClientChatbot />

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            ¿Necesitas ayuda? Contacta a soporte:{" "}
            <a
              href="mailto:soporte@coconsa.com"
              className="text-blue-600 hover:underline"
            >
              soporte@coconsa.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
