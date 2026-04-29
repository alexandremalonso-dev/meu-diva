"use client";

import { useState } from 'react';
import type { TerapeutaPublico } from '../types';

// 🎨 PALETA DE CORES
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaTexto: "#374151",
};

interface SobreProps {
  terapeuta: TerapeutaPublico;
  mostrarBioApenas?: boolean;
}

export function Sobre({ terapeuta, mostrarBioApenas = false }: SobreProps) {
  const [expandido, setExpandido] = useState(false);
  
  const bio = terapeuta.bio || '';
  const bioCurta = bio.length > 200 ? bio.substring(0, 200) + '...' : bio;
  
  if (mostrarBioApenas) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4" style={{ color: CORES.azul }}>
          Sobre
        </h2>
        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-line" style={{ color: CORES.cinzaTexto }}>
            {bio}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4" style={{ color: CORES.azul }}>
        Sobre
      </h2>
      
      <div className="prose max-w-none">
        <p className="text-gray-700 whitespace-pre-line" style={{ color: CORES.cinzaTexto }}>
          {expandido ? bio : bioCurta}
        </p>
        
        {bio.length > 200 && (
          <button
            onClick={() => setExpandido(!expandido)}
            className="text-sm font-medium mt-2 transition-all hover:opacity-80"
            style={{ color: CORES.rosa }}
          >
            {expandido ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>
      
      {/* Formação */}
      {terapeuta.experiencia && (
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 mb-2" style={{ color: CORES.verdeEscuro }}>
            Formação e Experiência
          </h3>
          <p className="text-gray-700 whitespace-pre-line text-sm" style={{ color: CORES.cinzaTexto }}>
            {terapeuta.experiencia}
          </p>
        </div>
      )}
    </div>
  );
}