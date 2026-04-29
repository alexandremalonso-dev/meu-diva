"use client";

import { User, Star, Calendar } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FrequentPatientCardProps {
  patient: {
    id: number;
    full_name?: string;
    email: string;
    session_count: number;
    last_session?: Date;
    is_frequent: boolean;
    foto_url?: string;
  };
  onClick: (patientId: number) => void;
  formatDate?: (date: Date) => string;
}

export function FrequentPatientCard({ patient, onClick, formatDate }: FrequentPatientCardProps) {
  
  const lastSessionText = patient.last_session 
    ? formatDate 
      ? formatDate(patient.last_session)
      : new Date(patient.last_session).toLocaleDateString('pt-BR')
    : 'Nenhuma sessão';

  const fotoUrl = patient.foto_url ? getFotoSrc(patient.foto_url) ?? "" : null;
  const patientName = patient.full_name || patient.email;
  const initial = patientName.charAt(0).toUpperCase();

  return (
    <button
      onClick={() => onClick(patient.id)}
      className="w-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 p-4 rounded-lg shadow-sm hover:shadow-md transition-all hover:scale-105 text-left text-white"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-white font-bold text-xl">
          {fotoUrl ? (
            <img 
              src={fotoUrl} 
              alt={patientName}
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<span>${initial}</span>`;
              }}
            />
          ) : (
            <User className="w-6 h-6" style={{ color: 'white', stroke: 'white', fill: 'none' }} />
          )}
        </div>
        <p className="font-bold text-white text-base break-words flex-1">
          {patientName}
        </p>
      </div>
      
      <div className="mt-2 space-y-1">
        <p className="text-sm text-white">
          <span className="font-semibold">{patient.session_count}</span> sessões
        </p>
        <p className="text-xs text-white/80 flex items-center gap-1">
          <Calendar className="w-3 h-3" style={{ color: 'white', stroke: 'white' }} />
          Última: {lastSessionText}
        </p>
      </div>
      
      {patient.is_frequent && (
        <span className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-white/20 rounded-full text-xs text-white">
          <Star className="w-3 h-3" style={{ color: 'white', stroke: 'white', fill: 'white' }} />
          Frequente
        </span>
      )}
    </button>
  );
}