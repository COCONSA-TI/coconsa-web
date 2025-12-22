"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Chatbot from "@/components/Chatbot";
import PurchaseOrderForm from "@/components/admin/PurchaseOrderForm";

export default function CrearOrdenPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"asistido" | "manual">("asistido");
  const [lastOrderCreated, setLastOrderCreated] = useState<any>(null);

  const handleOrderCreated = (order: any) => {
    setLastOrderCreated(order);
    // Redirigir al hub después de 2 segundos
    setTimeout(() => {
      router.push('/dashboard/ordenes-compra');
    }, 2000);
  };

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      {/* Header con botón de regreso */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={() => router.back()}
          className="mb-3 sm:mb-4 text-sm sm:text-base text-gray-600 hover:text-gray-900 flex items-center gap-2 transition-colors"
        >
          <span>←</span>
          <span>Volver a Órdenes de Compra</span>
        </button>
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
            Nueva Orden de Compra
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Elige tu método preferido para crear la orden
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 sm:mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("asistido")}
              className={`
                whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0
                ${
                  activeTab === "asistido"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <span className="flex items-center gap-2">
                <span>Modo Asistido</span>
              </span>
              <span className="block text-xs text-gray-500 mt-1">
                Con ayuda del chatbot
              </span>
            </button>

            <button
              onClick={() => setActiveTab("manual")}
              className={`
                whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0
                ${
                  activeTab === "manual"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <span className="flex items-center gap-2">
                <span>Modo Manual</span>
              </span>
              <span className="block text-xs text-gray-500 mt-1">
                Formulario directo
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
        {activeTab === "asistido" ? (
          <div>
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
              <div>
                <h3 className="font-semibold text-blue-900 mb-1 text-sm sm:text-base">
                  Modo Asistido
                </h3>
                <p className="text-xs sm:text-sm text-blue-800">
                  El asistente virtual te guiará paso a paso para crear tu orden de compra. 
                  Tu nombre se detecta automáticamente.
                </p>
              </div>
            </div>
            <Chatbot 
              onOrderCreated={handleOrderCreated}
            />
          </div>
        ) : (
          <div>
            <div className="mb-4 sm:mb-6 bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <div>
                <h3 className="font-semibold text-green-900 mb-1 text-sm sm:text-base">
                  Modo Manual
                </h3>
                <p className="text-xs sm:text-sm text-green-800">
                  Completa todos los campos del formulario directamente. Ideal para
                  crear órdenes rápidamente cuando conoces todos los detalles.
                </p>
              </div>
            </div>
            <PurchaseOrderForm
              onSubmit={handleOrderCreated}
            />
          </div>
        )}
      </div>

      {/* Notificación de orden creada */}
      {lastOrderCreated && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg max-w-md animate-slide-up z-50">
          <div>
            <h4 className="font-bold mb-1 text-sm sm:text-base">¡Orden Creada!</h4>
            <p className="text-xs sm:text-sm">
              Redirigiendo al hub de órdenes...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
