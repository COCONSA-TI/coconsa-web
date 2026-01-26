"use client";

import React, { useState, useRef, useEffect } from "react";
import DOMPurify from "isomorphic-dompurify";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  success: boolean;
  message: string;
  detectedProject: string | null;
  availableProjects: string[];
  conversationHistory: Message[];
}

export default function ClientChatbot() {
  const [message, setMessage] = useState("");
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage("");
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/bot/client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      const data: ChatResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al procesar la solicitud");
      }

      if (data.success) {
        setConversationHistory(data.conversationHistory);
      }
    } catch (error) {
      console.error("Error:", error);
      setError(
        error instanceof Error ? error.message : "Error desconocido"
      );
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setConversationHistory([]);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[600px] max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Asistente de Reportes COCONSA</h2>
            <p className="text-sm text-blue-100">
              Consulta información sobre tus proyectos
            </p>
          </div>
          {conversationHistory.length > 0 && (
            <button
              onClick={clearChat}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-400 rounded text-sm transition-colors"
            >
              Nueva Consulta
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {conversationHistory.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="text-4xl mb-4">👷‍♂️</div>
            <h3 className="text-lg font-semibold mb-2">
              ¡Bienvenido al Portal de Clientes!
            </h3>
            <p className="text-sm mb-4">
              Puedo ayudarte a consultar información sobre tus proyectos
            </p>
            <div className="text-left max-w-md mx-auto bg-white p-4 rounded-lg shadow-sm">
              <p className="font-semibold mb-2">Puedes preguntar sobre:</p>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Avances físicos del proyecto</li>
                <li>• Avances financieros y presupuesto</li>
                <li>• Información del supervisor</li>
                <li>• Contactos del equipo</li>
                <li>• Actualizaciones recientes</li>
              </ul>
            </div>
          </div>
        )}

        {conversationHistory.map((msg, index) => (
          <div
            key={index}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-4 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-800 shadow-md"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center mb-2">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2">
                    C
                  </div>
                  <span className="text-xs font-semibold text-gray-600">
                    Asistente COCONSA
                  </span>
                </div>
              )}
              <div
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(msg.content
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\n/g, "<br/>"))
                }}
              />
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg p-4 shadow-md">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 bg-white border-t rounded-b-lg">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribe tu pregunta sobre el proyecto..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {loading ? "..." : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
