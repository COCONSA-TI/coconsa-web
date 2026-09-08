"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Chatbot from "@/components/Chatbot";
import PurchaseOrderForm from "@/components/admin/PurchaseOrderForm";
import { Order } from "@/types/database";

// Tipo para datos del formulario manual
interface OrderFormData {
  applicant_name: string;
  store_name: string;
  supplier_name: string;
  justification: string;
  currency: string;
  retention: string;
  items: {
    id: string;
    nombre: string;
    cantidad: string;
    unidad: string;
    precioUnitario: string;
  }[];
  total: number;
}

// Unión de tipos para órdenes creadas
type CreatedOrderData = Order[] | OrderFormData;

export default function CrearOrdenPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"asistido" | "manual">("asistido");
  const [lastOrderCreated, setLastOrderCreated] = useState<CreatedOrderData | null>(null);

  const handleChatbotOrderCreated = (orders: Order[]) => {
    setLastOrderCreated(orders);
    // Redirigir al hub después de 2 segundos
    setTimeout(() => {
      router.push('/dashboard/ordenes-compra');
    }, 2000);
  };

  const handleFormOrderCreated = (data: OrderFormData) => {
    setLastOrderCreated(data);
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
                    ? "border-red-600 text-red-600 font-semibold"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              <span className="flex items-center gap-2">
                <span>Modo Asistido</span>
              </span>
              <span className="block text-xs text-gray-500 mt-1">
                Con ayuda del asistente COCONSA
              </span>
            </button>

            <button
              onClick={() => setActiveTab("manual")}
              className={`
                whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-colors flex-shrink-0
                ${
                  activeTab === "manual"
                    ? "border-red-600 text-red-600 font-semibold"
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
      <div className="bg-gray-50 rounded-xl p-4 sm:p-6 border border-gray-200">
        {activeTab === "asistido" ? (
          <div>
            <div className="mb-4 bg-red-50/80 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-900 text-sm sm:text-base">
                  Modo Asistido COCONSA
                </h3>
                <p className="text-xs sm:text-sm text-red-800 mt-0.5">
                  El asistente te guiará paso a paso para recopilar todos los datos de tu orden de compra (materiales o destajo).
                </p>
              </div>
            </div>
            <Chatbot 
              onOrderCreated={handleChatbotOrderCreated}
            />
          </div>
        ) : (
          <div>
            <div className="mb-4 sm:mb-6 bg-red-50/80 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-red-900 text-sm sm:text-base">
                  Formulario Manual de Orden
                </h3>
                <p className="text-xs sm:text-sm text-red-800 mt-0.5">
                  Completa todos los campos del formulario directamente para enviar tu solicitud a aprobación.
                </p>
              </div>
            </div>
            <PurchaseOrderForm
              onSubmit={handleFormOrderCreated}
            />
          </div>
        )}
      </div>

      {/* Notificación de orden creada */}
      {lastOrderCreated && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-red-700 text-white p-4 rounded-xl shadow-2xl max-w-md animate-slide-up z-50 border border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white text-red-700 flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base">¡Orden Creada!</h4>
              <p className="text-xs sm:text-sm text-red-100">
                Redirigiendo al hub de órdenes...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
