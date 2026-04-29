"use client";

import { 
  CalendarCheck, 
  CheckCircle, 
  XCircle, 
  BarChart3 
} from "lucide-react";

interface StatsCardProps {
  icon: string; // Mantido para compatibilidade, mas não será usado
  value: number;
  label: string;
  filter: string;
  activeFilter: string;
  onFilterClick: (filter: string) => void;
  onExpand: () => void;
}

// Mapeamento de ícones baseado no filtro
const getIcon = (filter: string) => {
  switch (filter) {
    case 'upcoming':
      return <CalendarCheck className="w-6 h-6" />;
    case 'completed':
      return <CheckCircle className="w-6 h-6" />;
    case 'cancelled':
      return <XCircle className="w-6 h-6" />;
    default:
      return <BarChart3 className="w-6 h-6" />;
  }
};

export function StatsCard({ 
  value, 
  label, 
  filter, 
  activeFilter, 
  onFilterClick,
  onExpand 
}: StatsCardProps) {
  const isActive = activeFilter === filter;
  
  return (
    <button
      onClick={() => {
        onFilterClick(filter);
        onExpand();
      }}
      className={`bg-gradient-to-br from-[#E03673] to-[#E03673]/80 text-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all text-left group w-full ${
        isActive 
          ? 'ring-2 ring-white/50' 
          : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/80">{getIcon(filter)}</span>
      </div>
      <span className="text-3xl font-bold text-white group-hover:text-white/90">
        {value}
      </span>
      <p className="text-sm text-white/80 mt-1">{label}</p>
    </button>
  );
}