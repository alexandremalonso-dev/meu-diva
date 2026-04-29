"use client";

import type { TerapeutaPublico } from '../types';

// 🎨 PALETA DE CORES
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  branco: "#FFFFFF",
};

interface InformacoesSessaoProps {
  terapeuta: TerapeutaPublico;
  isLoggedIn?: boolean;
}

export function InformacoesSessao({ terapeuta, isLoggedIn = false }: InformacoesSessaoProps) {
  const has30min = terapeuta.session_duration_30min;
  const has50min = terapeuta.session_duration_50min;
  
  const durations = [];
  if (has30min) durations.push('30 minutos');
  if (has50min) durations.push('50 minutos');
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4" style={{ color: CORES.azul }}>
        ⏱️ Informações da Sessão
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Preço */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Valor da sessão</h3>
          <p className="text-3xl font-bold" style={{ color: CORES.verdeEscuro }}>
            R$ {terapeuta.session_price?.toFixed(2).replace('.', ',')}
          </p>
        </div>
        
        {/* Durações */}
        {durations.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-1">Duração</h3>
            <div className="flex gap-2">
              {durations.map(dur => (
                <span key={dur} className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: CORES.cinza, color: CORES.azul }}>
                  {dur}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Abordagem */}
        {terapeuta.abordagem && (
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Abordagem</h3>
            <p className="text-gray-900" style={{ color: CORES.cinzaTexto }}>{terapeuta.abordagem}</p>
          </div>
        )}
        
        {/* Especialidades */}
        {terapeuta.specialties && (
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Especialidades</h3>
            <p className="text-gray-900" style={{ color: CORES.cinzaTexto }}>{terapeuta.specialties}</p>
          </div>
        )}
      </div>
      
      {/* Política de remarcação - visível para todos */}
      <div className="mt-6 pt-6 border-t">
        <h3 className="text-sm font-medium text-gray-500 mb-2">📋 Política de Remarcação</h3>
        <p className="text-gray-700" style={{ color: CORES.cinzaTexto }}>
          Remarcações podem ocorrer até 24 hora(s) antes sem custo adicional
        </p>
      </div>

      {/* Aviso para não logado */}
      {!isLoggedIn && (
        <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: `${CORES.rosa}10`, color: CORES.rosa }}>
          <p className="text-sm">
            🔒 Faça login para agendar sessões
          </p>
        </div>
      )}
    </div>
  );
}