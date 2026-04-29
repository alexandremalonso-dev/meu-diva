"use client";

import type { TerapeutaPublico } from '../types';
import { ShieldCheck, Video, Lock, Instagram, ExternalLink } from 'lucide-react';

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaTexto: "#374151",
};

interface ConfiancaProps {
  terapeuta: TerapeutaPublico;
}

// ✅ Extrai o handle real do Instagram a partir da URL
function extractInstagramHandle(url: string): string {
  // Remove trailing slash, query params e hash
  const clean = url.replace(/[?#].*$/, '').replace(/\/$/, '');
  const parts = clean.split('/');
  const handle = parts[parts.length - 1];
  return handle ? `@${handle}` : '@instagram';
}

const trustItems = [
  {
    key: 'verified',
    icon: ShieldCheck,
    color: CORES.verdeEscuro,
    bg: '#f0fdf4',
    border: '#bbf7d0',
    title: 'Profissional verificado',
    description: 'Documentos e formação verificados pela equipe Meu Divã',
    alwaysShow: false,
  },
  {
    key: 'online',
    icon: Video,
    color: CORES.azul,
    bg: '#eff6ff',
    border: '#bfdbfe',
    title: 'Atendimento online',
    description: 'Sessões por videochamada segura e criptografada',
    alwaysShow: true,
  },
  {
    key: 'payment',
    icon: Lock,
    color: CORES.rosa,
    bg: '#fdf2f8',
    border: '#fbcfe8',
    title: 'Pagamento 100% seguro',
    description: 'Processado via Stripe com criptografia de ponta a ponta',
    alwaysShow: true,
  },
];

export function Confianca({ terapeuta }: ConfiancaProps) {
  const handle = terapeuta.instagram_url
    ? extractInstagramHandle(terapeuta.instagram_url)
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#E03673]" />
          Confiança e Segurança
        </h2>
      </div>

      <div className="p-5 space-y-3">
        {trustItems.map((item) => {
          if (!item.alwaysShow && item.key === 'verified' && !terapeuta.verified) return null;
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="flex items-start gap-3 p-3 rounded-lg border transition-colors"
              style={{ backgroundColor: item.bg, borderColor: item.border }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: item.color + '18' }}
              >
                <Icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.description}</p>
              </div>
            </div>
          );
        })}

        {/* Instagram */}
        {handle && (
          <a
            href={terapeuta.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-pink-100 bg-gradient-to-r from-pink-50 to-purple-50 hover:from-pink-100 hover:to-purple-100 transition-all group"
          >
            <div className="flex items-center gap-3">
              {/* Ícone Instagram com gradiente */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
                <Instagram className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Instagram</p>
                {/* ✅ Handle real extraído da URL */}
                <p className="text-sm font-semibold text-gray-800 group-hover:text-[#E03673] transition-colors">
                  {handle}
                </p>
              </div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#E03673] transition-colors flex-shrink-0" />
          </a>
        )}
      </div>
    </div>
  );
}