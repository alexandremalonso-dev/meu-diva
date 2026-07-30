"use client";

import { 
  CalendarCheck, 
  CheckCircle, 
  XCircle, 
  BarChart3 
} from "lucide-react";

interface StatsCardProps {
  icon: string;
  value: number;
  label: string;
  filter: string;
  activeFilter: string;
  onFilterClick: (filter: string) => void;
  onExpand: () => void;
}

const getIcon = (filter: string) => {
  const cls = "w-5 h-5 sm:w-6 sm:h-6";
  switch (filter) {
    case 'upcoming':  return <CalendarCheck className={cls} />;
    case 'completed': return <CheckCircle className={cls} />;
    case 'cancelled': return <XCircle className={cls} />;
    default:          return <BarChart3 className={cls} />;
  }
};

export function StatsCard({ 
  value, label, filter, activeFilter, onFilterClick, onExpand 
}: StatsCardProps) {
  const isActive = activeFilter === filter;
  
  return (
    <button
      onClick={() => { onFilterClick(filter); onExpand(); }}
      className={`bg-gradient-to-br from-[#E03673] to-[#E03673]/80 text-white rounded-xl p-3 sm:p-4 lg:p-5 shadow-sm hover:shadow-md transition-all text-left group w-full overflow-hidden ${
        isActive ? 'ring-2 ring-white/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-white/80">{getIcon(filter)}</span>
      </div>
      <span className="text-2xl sm:text-3xl font-bold text-white group-hover:text-white/90 block leading-none">
        {value}
      </span>
      <p className="text-[11px] sm:text-xs lg:text-sm text-white/80 mt-1 leading-tight truncate">{label}</p>
    </button>
  );
}