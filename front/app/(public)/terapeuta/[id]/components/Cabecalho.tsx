"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Calendar, Coins, Star, ShieldCheck } from 'lucide-react';
import type { TerapeutaPublico } from '../types';
import { getFotoSrc } from '@/lib/utils';

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  branco: "#FFFFFF",
};

interface CabecalhoProps {
  terapeuta: TerapeutaPublico;
  isLoggedIn?: boolean;
  onAgendar?: () => void;
}

export function Cabecalho({ terapeuta, isLoggedIn = false, onAgendar }: CabecalhoProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fotoUrl = terapeuta.foto_url ? getFotoSrc(terapeuta.foto_url) ?? "" : null;
  const nomeCompleto = terapeuta.full_name || "Nome não disponível";
  const rating = Number(terapeuta.rating) || 0;
  const reviewsCount = Number(terapeuta.reviews_count) || 0;
  const totalSessions = Number(terapeuta.total_sessions) || 0;

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      {/* Foto */}
      <div className="relative w-32 h-32 flex-shrink-0">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-white/20 border-4 border-white">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={nomeCompleto}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.parentElement) {
                  e.currentTarget.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center text-white text-4xl font-bold">${nomeCompleto.charAt(0) || '?'}</div>`;
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
              {nomeCompleto.charAt(0) || '?'}
            </div>
          )}
        </div>

        {/* 🔥 Selo verificado na foto — círculo verde sólido com ícone branco */}
        {terapeuta.verified && (
          <div
            title="Terapeuta Verificado"
            style={{
              position: "absolute",
              bottom: "4px",
              right: "4px",
              backgroundColor: "#16A34A",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "3px solid white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            <ShieldCheck size={18} color="white" strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Informações */}
      <div className="flex-1 text-left">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">
          {nomeCompleto}
        </h1>

        {/* Tipo de profissional */}
        {terapeuta.service_types && terapeuta.service_types.length > 0 && (
          <div className="text-white/90 text-lg mb-2">
            {terapeuta.service_types.map((tipo, i) => (
              <span key={i} className="text-white">
                {tipo === 'psicanalista' ? 'Psicanalista' : tipo}
                {terapeuta.service_types && i < terapeuta.service_types.length - 1 ? ' • ' : ''}
              </span>
            ))}
          </div>
        )}

        {/* Avaliações e sessões */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(star => (
                <Star
                  key={star}
                  size={14}
                  className={star <= Math.floor(rating) ? "fill-[#FBBF24] text-[#FBBF24]" : "text-white/40"}
                />
              ))}
            </div>
            <span className="text-white/80 text-sm">
              {reviewsCount === 1 ? '1 avaliação' : `${reviewsCount} avaliações`}
            </span>
          </div>

          <span className="text-white/60">•</span>

          <span className="text-sm" style={{ color: CORES.ciano }}>
            {totalSessions === 1 ? '1 sessão' : `${totalSessions} sessões`}
          </span>
        </div>

        {/* Preço, botão Agendar e badge verificado */}
        <div className="flex items-center gap-3 flex-wrap mt-2">
          {terapeuta.session_price && (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-full">
              <Coins size={16} className="text-white" />
              <span className="text-white font-semibold">
                R$ {terapeuta.session_price.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}

          <button
            onClick={onAgendar}
            className="flex items-center gap-2 px-5 py-2 rounded-full font-semibold transition-all hover:scale-105"
            style={{ backgroundColor: CORES.rosa, color: CORES.branco }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = CORES.rosaEscuro}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = CORES.rosa}
          >
            <Calendar size={16} />
            Agendar
          </button>

          {/* 🔥 Badge verificado ao lado do botão */}
          {terapeuta.verified && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                backgroundColor: "#16A34A",
                color: "white",
                fontSize: "12px",
                fontWeight: "700",
                padding: "6px 14px",
                borderRadius: "50px",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              }}
            >
              <ShieldCheck size={14} strokeWidth={2.5} />
              Terapeuta Verificado
            </span>
          )}
        </div>
      </div>
    </div>
  );
}