'use client';

import { useState, useRef, useEffect } from 'react';
import { RETENTION_OPTIONS, calculateRetentions } from '@/types/database';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface AttachedFile {
  file: File;
  preview: string | null;
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
  retention: string[] | null;
  payment_type: 'credito' | 'de_contado' | null;
  tax_type: 'sin_iva' | 'con_iva' | null;
  iva_percentage: 0 | 8 | 16 | null;
  isComplete: boolean;
}

export default function ChatBotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hola, soy tu asistente de COCONSA. Puedo ayudarte a crear una orden de compra. Recuerda que deberas adjuntar archivos de evidencia antes de crear la orden.',
      role: 'assistant',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: string; content: string}>>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [pendingOrderData, setPendingOrderData] = useState<ExtractedData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const validFiles: AttachedFile[] = [];

    for (const file of newFiles) {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf'
        || file.type === 'application/msword'
        || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || file.type === 'application/vnd.ms-excel'
        || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (!isValidType) continue;
      if (file.size > 10 * 1024 * 1024) continue; // max 10MB

      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      validFiles.push({ file, preview });
    }

    setAttachedFiles(prev => [...prev, ...validFiles]);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => {
      const removed = prev[index];
      if (removed.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

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

        // Si la orden está completa, verificar evidencia antes de crear
        if (data.extractedData?.isComplete) {
          if (attachedFiles.length === 0) {
            // Bloquear creacion - pedir evidencia
            setPendingOrderData(data.extractedData);
            const warningMessage: Message = {
              id: (Date.now() + 2).toString(),
              content: 'IMPORTANTE: Debes adjuntar al menos un archivo de evidencia antes de crear la orden. Usa el boton de clip para adjuntar archivos (imagenes, PDF, Word o Excel). Una vez adjuntados, presiona el boton "Crear orden" que aparecera abajo.',
              role: 'assistant',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, warningMessage]);
          } else {
            await createOrder(data.extractedData);
          }
        }
      } else {
        throw new Error(data.error || 'Error al procesar el mensaje');
      }
    } catch (error) {
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

  const handleCreateWithEvidence = async () => {
    if (!pendingOrderData) return;
    if (attachedFiles.length === 0) {
      const warningMessage: Message = {
        id: Date.now().toString(),
        content: 'No se puede crear la orden sin evidencia. Por favor adjunta al menos un archivo.',
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, warningMessage]);
      return;
    }
    await createOrder(pendingOrderData);
    setPendingOrderData(null);
  };

  const createOrder = async (data: ExtractedData) => {
    try {
      setIsLoading(true);

      // Siempre enviar como FormData con evidencia
      const formData = new FormData();
      formData.append('orderData', JSON.stringify(data));
      attachedFiles.forEach((af) => {
        formData.append('evidence', af.file);
      });

      const response = await fetch('/api/v1/orders/create', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        const order = result.order;

        // Build retention breakdown text if applicable
        let retentionText = '';
        if (data.retention && data.retention.length > 0 && data.tax_type === 'con_iva') {
          const subtotal = Number(order.subtotal);
          const ivaPercentage = data.iva_percentage || 16;
          const ivaAmount = subtotal * (ivaPercentage / 100);
          const { breakdown } = calculateRetentions(data.retention, subtotal, ivaAmount);
          retentionText = breakdown
            .map(item => `\n- ${item.label}: -$${item.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}`)
            .join('');
        }

        const successMessage: Message = {
          id: Date.now().toString(),
          content: `Tu orden de compra #${order.id} ha sido creada.\n\nResumen:\n- Solicitante: ${data.applicant_name}\n- Almacen: ${data.store_name}\n- Proveedor: ${data.supplier_name}\n- Total de articulos: ${data.items.length}\n- Tipo de pago: ${data.payment_type === 'credito' ? 'Credito' : data.payment_type === 'de_contado' ? 'De Contado' : 'N/A'}\n- Subtotal: $${Number(order.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}${data.tax_type === 'con_iva' ? `\n- IVA (${data.iva_percentage || 16}%): $${Number(order.iva).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}` : ''}${retentionText}\n- Total: $${Number(order.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${order.currency}\n- Evidencias adjuntas: ${attachedFiles.length} archivo(s)\n- Estado: ${order.status}\n\nLa orden ha sido guardada en el sistema.`,
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
        
        // Resetear todo para nueva conversación
        setConversationHistory([]);
        setExtractedData(null);
        setPendingOrderData(null);
        // Limpiar archivos adjuntos
        attachedFiles.forEach(af => {
          if (af.preview) URL.revokeObjectURL(af.preview);
        });
        setAttachedFiles([]);
      } else {
        throw new Error(result.error || 'Error al crear la orden');
      }
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `Hubo un problema al crear la orden: ${error instanceof Error ? error.message : 'Error desconocido'}. Por favor verifica los datos e intenta nuevamente.`,
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
                    Tu orden de compra esta lista
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
                    Necesitas crear otra orden de compra? Solo dimelo.
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
        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((af, index) => (
              <div key={index} className="relative group bg-white border border-gray-200 rounded-lg p-2 flex items-center gap-2 max-w-[200px]">
                {af.preview ? (
                  <img src={af.preview} alt={af.file.name} className="w-8 h-8 object-cover rounded" />
                ) : (
                  <svg className="w-8 h-8 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                <span className="text-xs text-gray-600 truncate">{af.file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none hover:bg-red-600"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pending order - waiting for evidence */}
        {pendingOrderData && (
          <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              Orden lista para crear - Se requiere evidencia ({attachedFiles.length} archivo(s) adjunto(s))
            </p>
            {attachedFiles.length > 0 ? (
              <button
                type="button"
                onClick={handleCreateWithEvidence}
                disabled={isLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Crear orden con {attachedFiles.length} archivo(s) de evidencia
              </button>
            ) : (
              <p className="text-xs text-amber-600">Adjunta al menos un archivo de evidencia usando el boton de clip para poder crear la orden.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Clip button for file attachment */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="px-3 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Adjuntar evidencia (obligatorio)"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
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
            Crear orden de compra
          </button>
          <button
            onClick={() => {
              setMessages([{
                id: '1',
                content: 'Hola, soy tu asistente de COCONSA. Puedo ayudarte a crear una orden de compra. Recuerda que deberas adjuntar archivos de evidencia antes de crear la orden.',
                role: 'assistant',
                timestamp: new Date(),
              }]);
              setConversationHistory([]);
              setExtractedData(null);
              setPendingOrderData(null);
              attachedFiles.forEach(af => {
                if (af.preview) URL.revokeObjectURL(af.preview);
              });
              setAttachedFiles([]);
            }}
            className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Nueva conversacion
          </button>
        </div>
        
        {/* Extracted Data Preview */}
        {extractedData && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
            <p className="font-semibold text-blue-900 mb-1">Datos recopilados:</p>
            <div className="text-blue-800">
              {extractedData.applicant_name && <p>Solicitante: {extractedData.applicant_name}</p>}
              {extractedData.store_name && <p>Almacen: {extractedData.store_name}</p>}
              {extractedData.supplier_name && <p>Proveedor: {extractedData.supplier_name}</p>}
              {extractedData.items.length > 0 && (
                <p>Articulos: {extractedData.items.length}</p>
              )}
              {extractedData.retention && extractedData.retention.length > 0 && (
                <p>Retenciones: {extractedData.retention.map(key => {
                  const opt = RETENTION_OPTIONS.find(o => o.key === key);
                  return opt ? opt.label : key;
                }).join(', ')}</p>
              )}
              <p className={attachedFiles.length > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                Evidencia: {attachedFiles.length > 0 ? `${attachedFiles.length} archivo(s) adjunto(s)` : 'Sin archivos - OBLIGATORIO'}
              </p>
              {extractedData.isComplete && attachedFiles.length > 0 && (
                <p className="text-green-600 font-semibold mt-1">Informacion completa - Creando orden...</p>
              )}
              {extractedData.isComplete && attachedFiles.length === 0 && (
                <p className="text-amber-600 font-semibold mt-1">Datos completos - Falta adjuntar evidencia</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
