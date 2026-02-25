'use client';

import { useState, useRef, useEffect } from 'react';
import { PurchaseOrderExtractedData } from '@/lib/schemas';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AttachedFile {
  file: File;
  preview: string | null;
}

interface ChatbotProps {
  onFormDataExtracted?: (data: PurchaseOrderExtractedData) => void;
  onOrderCreated?: (order: Order[]) => void;
}

// Importar tipo Order
import { Order } from '@/types/database';

interface AvailableOption {
  id: number;
  name?: string;
  commercial_name?: string;
}

export default function Chatbot({ onFormDataExtracted, onOrderCreated }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy el asistente de COCONSA. ¿Necesitas crear una orden de compra? Puedes darme toda la info de golpe o ir paso a paso. También puedes adjuntar evidencias.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<PurchaseOrderExtractedData>({});
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);
  const [availableStores, setAvailableStores] = useState<AvailableOption[]>([]);
  const [availableSuppliers, setAvailableSuppliers] = useState<AvailableOption[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Manejar selección de archivos
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    Array.from(files).forEach((file) => {
      // Validar tipo de archivo
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      
      if (!isImage && !isPdf) {
        alert(`El archivo "${file.name}" no es válido. Solo se permiten imágenes y PDFs.`);
        return;
      }

      // Validar tamaño (máx 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`El archivo "${file.name}" es muy grande. Máximo 10MB.`);
        return;
      }

      // Crear preview para imágenes
      let preview: string | null = null;
      if (isImage) {
        preview = URL.createObjectURL(file);
      }

      newFiles.push({ file, preview });
    });

    setAttachedFiles((prev) => [...prev, ...newFiles]);
    
    // Limpiar el input para permitir seleccionar el mismo archivo de nuevo
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Eliminar archivo adjunto
  const removeFile = (index: number) => {
    setAttachedFiles((prev) => {
      const newFiles = [...prev];
      // Liberar la URL del preview si existe
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Agregar mensaje del usuario
    const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newMessages);

    try {
      const response = await fetch('/api/v1/bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory: messages,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || 'Error al enviar el mensaje';
        const errorDetails = data.details ? `\n\n${data.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      // Agregar respuesta del bot
      setMessages([...newMessages, { role: 'assistant', content: data.message }]);

      // Actualizar datos extraídos
      if (data.extractedData) {
        setExtractedData(data.extractedData);
        onFormDataExtracted?.(data.extractedData);
      }

      // Actualizar listas de opciones disponibles
      if (data.availableStores) {
        setAvailableStores(data.availableStores);
      }
      if (data.availableSuppliers) {
        setAvailableSuppliers(data.availableSuppliers);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const errorMessages = [
        ...newMessages,
        {
          role: 'assistant' as const,
          content: `❌ ${errorMessage}\n\nSi el problema persiste, por favor contacta al administrador.`,
        },
      ];
      setMessages(errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createOrder = async () => {
    if (!extractedData.isComplete) return;

    setIsCreatingOrder(true);

    try {
      let response: Response;
      
      // Si hay archivos adjuntos, usar FormData
      if (attachedFiles.length > 0) {
        const formData = new FormData();
        formData.append('orderData', JSON.stringify(extractedData));
        
        // Agregar cada archivo
        attachedFiles.forEach((af) => {
          formData.append('evidence', af.file);
        });
        
        response = await fetch('/api/v1/orders/create', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Sin archivos, usar JSON normal
        response = await fetch('/api/v1/orders/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(extractedData),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear la orden');
      }

      setOrderCreated(true);
      
      // Limpiar archivos adjuntos después de crear la orden
      attachedFiles.forEach((af) => {
        if (af.preview) URL.revokeObjectURL(af.preview);
      });
      setAttachedFiles([]);
      
      const ordersCount = data.orders?.length || 1;
      const ordersInfo = ordersCount > 1 
        ? `Se crearon ${ordersCount} órdenes (una por proveedor)`
        : `Número de orden: ${data.order.id}`;
      
      const newMessages = [
        ...messages,
        {
          role: 'assistant' as const,
          content: `✅ ¡Órdenes creadas exitosamente!\n\n${ordersInfo}\nEstado: ${data.order.status}\n\n${data.message}`,
        },
      ];
      setMessages(newMessages);

      onOrderCreated?.(data.orders || [data.order]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      const newMessages = [
        ...messages,
        {
          role: 'assistant' as const,
          content: `❌ Error al crear la orden:\n\n${errorMessage}\n\nPor favor verifica que:\n• El nombre del solicitante esté registrado\n• El almacén/obra exista en el sistema\n• El proveedor esté dado de alta`,
        },
      ];
      setMessages(newMessages);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-red-600 text-white p-4">
        <h3 className="text-lg font-semibold">Asistente Virtual COCONSA</h3>
        <p className="text-sm text-red-100">Estamos aquí para ayudarte</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        {/* Archivos adjuntos preview */}
        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((af, index) => (
              <div
                key={index}
                className="relative group bg-gray-100 rounded-lg p-2 flex items-center gap-2"
              >
                {af.preview ? (
                  <img
                    src={af.preview}
                    alt={af.file.name}
                    className="w-10 h-10 object-cover rounded"
                  />
                ) : (
                  <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center">
                    <span className="text-red-600 text-xs font-bold">PDF</span>
                  </div>
                )}
                <span className="text-xs text-gray-700 max-w-[100px] truncate">
                  {af.file.name}
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex space-x-2">
          {/* Botón para adjuntar archivos */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,.pdf"
            multiple
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
            title="Adjuntar evidencia"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 disabled:bg-gray-100"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>

      {/* Botón para crear orden cuando está completa */}
      {extractedData.isComplete === true && !orderCreated && (
        <div className="border-t p-4 bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-900 mb-1">
                ✅ Información completa
              </p>
              <p className="text-xs text-green-700">
                Toda la información necesaria ha sido recopilada.
              </p>
            </div>
            <button
              onClick={createOrder}
              disabled={isCreatingOrder}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isCreatingOrder ? 'Creando...' : 'Crear Orden'}
            </button>
          </div>
        </div>
      )}

      {/* Opciones disponibles */}
      {(availableStores.length > 0 || availableSuppliers.length > 0) && !orderCreated && (
        <div className="border-t p-4 bg-blue-50">
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-blue-900 mb-2">
              📋 Ver opciones disponibles
            </summary>
            <div className="space-y-3 mt-2">
              {availableStores.length > 0 && (
                <div>
                  <p className="font-semibold text-blue-800 mb-1">Almacenes/Obras:</p>
                  <ul className="text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                    {availableStores.map((store) => (
                      <li key={store.id}>• {store.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {availableSuppliers.length > 0 && (
                <div>
                  <p className="font-semibold text-blue-800 mb-1">Proveedores:</p>
                  <ul className="text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                    {availableSuppliers.map((supplier) => (
                      <li key={supplier.id}>• {supplier.commercial_name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </details>
        </div>
      )}


    </div>
  );
}
