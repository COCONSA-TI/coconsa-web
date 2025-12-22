export default function ModeComparisonCard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Modo Asistido */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">💬</span>
          <div>
            <h3 className="text-lg font-bold text-blue-900">Modo Asistido</h3>
            <p className="text-sm text-blue-700">Guiado por Asistente IA</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-blue-900">
              Perfecto para usuarios nuevos
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-blue-900">
              Preguntas paso a paso
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-blue-900">
              No necesitas conocer el proceso
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-blue-900">
              Interfaz conversacional natural
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-orange-600 font-bold">⚠</span>
            <p className="text-sm text-blue-900">
              Proceso secuencial (más lento)
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-blue-300">
          <p className="text-xs text-blue-700 italic">
            "Ideal para tu primera vez o cuando necesitas orientación"
          </p>
        </div>
      </div>

      {/* Modo Experto */}
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl">⚡</span>
          <div>
            <h3 className="text-lg font-bold text-green-900">Modo Experto</h3>
            <p className="text-sm text-green-700">Formulario Directo</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-green-900">
              Rápido y eficiente
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-green-900">
              Control total del formulario
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-green-900">
              Edición flexible de campos
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-600 font-bold">✓</span>
            <p className="text-sm text-green-900">
              Vista completa de toda la información
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-orange-600 font-bold">⚠</span>
            <p className="text-sm text-green-900">
              Requiere conocer el proceso
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-green-300">
          <p className="text-xs text-green-700 italic">
            "Ideal cuando conoces bien el proceso y quieres ir directo"
          </p>
        </div>
      </div>
    </div>
  );
}
