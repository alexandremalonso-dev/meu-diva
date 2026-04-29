"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

function TestEventsContent() {
  const { user } = useAuth();
  const { isConnected, lastEvent, subscribe } = useRealtimeEvents();
  const [events, setEvents] = useState<any[]>([]);

  // Escutar todos os eventos
  subscribe("*", (event) => {
    console.log("📨 Evento recebido:", event);
    setEvents(prev => [event, ...prev].slice(0, 20));
  });

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Teste de WebSocket de Eventos</h1>
        <p className="text-gray-500">Faça login para testar o WebSocket</p>
        <a href="/auth/login" className="inline-block mt-4 px-4 py-2 bg-[#E03673] text-white rounded-lg">
          Ir para Login
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Teste de WebSocket de Eventos</h1>
      
      <div className="mb-4 p-3 bg-gray-100 rounded-lg">
        <p><strong>Usuário:</strong> {user.full_name || user.email}</p>
        <p><strong>Role:</strong> {user.role}</p>
      </div>
      
      <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: isConnected ? '#10B981' : '#EF4444', color: 'white' }}>
        <p className="font-semibold">
          Status: {isConnected ? '✅ Conectado' : '❌ Desconectado'}
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Último Evento:</h2>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
          {lastEvent ? JSON.stringify(lastEvent, null, 2) : 'Nenhum evento recebido ainda'}
        </pre>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Histórico de Eventos (últimos 20):</h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-gray-500">Nenhum evento recebido</p>
          ) : (
            events.map((event, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="font-mono text-sm">
                  <span className="font-bold text-[#E03673]">{event.type}</span>
                  <span className="text-gray-400 text-xs ml-2">{event.timestamp}</span>
                </p>
                <pre className="text-xs mt-1 overflow-x-auto">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function TestEventsPage() {
  return (
    <AuthProvider>
      <TestEventsContent />
    </AuthProvider>
  );
}