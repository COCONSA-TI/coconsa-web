'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ExtractedData {
  applicant_name: string | null;
  store_name: string | null;
  supplier_name: string | null;
  items: Array<{
    nombre: string;
    cantidad: string;
    unidad: string;
    precioUnitario: number;
  }>;
  justification: string | null;
  currency: string | null;
  retention: string | null;
  isComplete: boolean;
}

export default function ChatBotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: '¡Hola! Soy tu asistente de COCONSA. ¿Qué necesitas hacer hoy? Puedo ayudarte a crear una orden de compra.',
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string; content: string}>>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Llamar al API del bot
      const response = await fetch('/api/v1/bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          conversationHistory: conversationHistory,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.message,
          role: 'assistant',
          timestamp: new Date(),
        };

        setMessages(prev => [...prev, botMessage]);
        setConversationHistory(data.conversationHistory);
        setExtractedData(data.extractedData);

        // Si la orden está completa, intentar crearla
        if (data.extractedData?.isComplete) {
          console.log('🎯 Orden completa detectada, creando...', data.extractedData);
          await createOrder(data.extractedData);
        } else {
          console.log('📝 Datos recopilados hasta ahora:', data.extractedData);
        }
      } else {
        throw new Error(data.error || 'Error al procesar el mensaje');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const createOrder = async (data: ExtractedData) => {
    try {
      setIsLoading(true);
      
      const response = await fetch('/api/v1/orders/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        const order = result.order;
        const successMessage: Message = {
          id: Date.now().toString(),
          content: `✅ ¡Excelente! Tu orden de compra #${order.id} ha sido creada exitosamente.\n\n📋 Resumen:\n- Solicitante: ${data.applicant_name}\n- Almacén: ${data.store_name}\n- Proveedor: ${data.supplier_name}\n- Total de artículos: ${data.items.length}\n- Subtotal: $${Number(order.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}\n- IVA (16%): $${Number(order.iva).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}\n- Total: $${Number(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}\n- Estado: ${order.status}\n\n📄 La orden ha sido guardada en el sistema.`,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, successMessage]);

        // Mensaje con botón de descarga de PDF
        const pdfMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `PDF_DOWNLOAD:${order.id}`,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, pdfMessage]);
        
        // Resetear el historial para nueva conversación
        setConversationHistory([]);
        setExtractedData(null);
      } else {
        throw new Error(result.error || 'Error al crear la orden');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ Hubo un problema al crear la orden: ${error instanceof Error ? error.message : 'Error desconocido'}. Por favor verifica los datos e intenta nuevamente.`,
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-black p-6 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">ChatBot IA</h1>
            <p className="text-purple-100 text-sm">Asistente inteligente para automatización de procesos</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => {
          // Detectar si el mensaje es un botón de descarga de PDF
          const isPdfDownload = message.content.startsWith('PDF_DOWNLOAD:');
          const orderId = isPdfDownload ? message.content.split(':')[1] : null;

          if (isPdfDownload && orderId) {
            return (
              <div key={message.id} className="flex justify-start">
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 max-w-[70%]">
                  <p className="text-sm font-semibold text-green-800 mb-3">
                    📄 Tu orden de compra está lista
                  </p>
                  <a
                    href={`/api/v1/orders/${orderId}/pdf`}
                    download
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar PDF
                  </a>
                  <p className="text-xs text-green-600 mt-3">
                    ¿Necesitas crear otra orden de compra? Solo dímelo.
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-4 ${
                  message.role === 'user'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.content}</p>
                <p
                  className={`text-xs mt-2 ${
                    message.role === 'user' ? 'text-red-100' : 'text-gray-500'
                  }`}
                >
                  {message.timestamp.toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-900"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
        
        {/* Quick Actions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setInput('Quiero crear una orden de compra')}
            className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            � Crear orden de compra
          </button>
          <button
            onClick={() => {
              setMessages([{
                id: '1',
                content: '¡Hola! Soy tu asistente de COCONSA. ¿Qué necesitas hacer hoy? Puedo ayudarte a crear una orden de compra.',
                role: 'assistant',
                timestamp: new Date(),
              }]);
              setConversationHistory([]);
              setExtractedData(null);
            }}
            className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            🔄 Nueva conversación
          </button>
        </div>
        
        {/* Extracted Data Preview */}
        {extractedData && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
            <p className="font-semibold text-blue-900 mb-1">📊 Datos recopilados:</p>
            <div className="text-blue-800">
              {extractedData.applicant_name && <p>👤 Solicitante: {extractedData.applicant_name}</p>}
              {extractedData.store_name && <p>🏢 Almacén: {extractedData.store_name}</p>}
              {extractedData.supplier_name && <p>🏭 Proveedor: {extractedData.supplier_name}</p>}
              {extractedData.items.length > 0 && (
                <p>📦 Artículos: {extractedData.items.length}</p>
              )}
              {extractedData.isComplete && (
                <p className="text-green-600 font-semibold mt-1">✅ Información completa - Creando orden...</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
