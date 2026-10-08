"use client";

import type { Stats, FilterType } from '../types';
import { Calendar, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { useState } from 'react';

interface StatsCardsProps {
  stats: Stats;
  activeFilter: FilterType;
  onFilterClick: (filter: FilterType) => void;
  onPeriodChange?: (period: 'week' | 'month' | 'year' | 'all', type: 'completed' | 'cancelled') => void;
  currentMonthRevenue?: number;
  currentMonthSessions?: number;
  onRevenueClick?: () => void;
}

export function StatsCards({
  stats,
  activeFilter,
  onFilterClick,
  onPeriodChange,
  currentMonthRevenue = 0,
  currentMonthSessions = 0,
  onRevenueClick,
}: StatsCardsProps) {

  const [completedPeriod, setCompletedPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [cancelledPeriod, setCancelledPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');

  const getCompletedValue = (): number => {
    if (typeof stats.completed === 'number') return stats.completed;
    if (stats.completed && typeof stats.completed === 'object') {
      const periodKey = completedPeriod as keyof typeof stats.completed;
      return (stats.completed[periodKey] as number) || 0;
    }
    return 0;
  };

  const getCancelledValue = (): number => {
    if (typeof stats.cancelled === 'number') return stats.cancelled;
    if (stats.cancelled && typeof stats.cancelled === 'object') {
      const periodKey = cancelledPeriod as keyof typeof stats.cancelled;
      return (stats.cancelled[periodKey] as number) || 0;
    }
    return 0;
  };

  const periodLabels = { week: 'Sem', month: 'Mês', year: 'Ano', all: 'Todo' };

  const handlePeriodClick = (period: 'week' | 'month' | 'year' | 'all', type: 'completed' | 'cancelled') => {
    if (type === 'completed') setCompletedPeriod(period);
    else setCancelledPeriod(period);
    if (onPeriodChange) onPeriodChange(period, type);
  };

  const getUpcomingValue = (): number => {
    if (typeof stats.upcoming === 'number') return stats.upcoming;
    if (stats.upcoming && typeof stats.upcoming === 'object') return (stats.upcoming as any).all || 0;
    return 0;
  };

  const getAvailabilityValue = (): number => (stats as any).totalAvailability || (stats as any).availability || 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const cards = [
    { id: 'upcoming' as FilterType, title: 'Próximas Sessões', value: getUpcomingValue(), icon: Calendar, onClick: () => onFilterClick('upcoming'), hasPeriodFilter: false },
    { id: 'completed' as FilterType, title: 'Sessões Realizadas', value: getCompletedValue(), icon: CheckCircle, onClick: () => onFilterClick('completed'), hasPeriodFilter: true, currentPeriod: completedPeriod, onPeriodClick: (p: any) => handlePeriodClick(p, 'completed') },
    { id: 'cancelled' as FilterType, title: 'Cancelamentos', value: getCancelledValue(), icon: XCircle, onClick: () => onFilterClick('cancelled'), hasPeriodFilter: true, currentPeriod: cancelledPeriod, onPeriodClick: (p: any) => handlePeriodClick(p, 'cancelled') },
    { id: 'availability' as FilterType, title: 'Disponibilidade', value: getAvailabilityValue(), icon: Clock, onClick: () => onFilterClick('availability'), hasPeriodFilter: false },
  ];

  return (
    // 🔥 Compacto e distribuído uniformemente (mesma estratégia do admin):
    // flex-1 com piso mínimo — estica quando sobra espaço, nunca comprime
    // a ponto de sobrepor os botões de período.
    <div className="flex flex-col gap-1.5 h-full">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            onClick={card.onClick}
            className={`flex-1 ${card.hasPeriodFilter ? "min-h-[5.75rem]" : "min-h-[4.75rem]"} flex flex-col justify-center cursor-pointer bg-gradient-to-br from-[#E03673] to-[#E03673]/80 text-white rounded-lg shadow-sm px-3 py-2 transition-all hover:shadow-md hover:scale-[1.01] ${activeFilter === card.id ? "ring-2 ring-white/50 ring-offset-1" : ""}`}
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-fluid-2xs font-medium text-white/80 truncate">{card.title}</span>
              <Icon className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-bold truncate leading-tight">{card.value}</p>

            {card.hasPeriodFilter && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(['week', 'month', 'year', 'all'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={(e) => { e.stopPropagation(); card.onPeriodClick?.(period); }}
                    className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${card.currentPeriod === period ? "bg-white/30 text-white font-medium" : "bg-white/10 hover:bg-white/20 text-white/80"}`}
                  >
                    {periodLabels[period]}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div
        onClick={onRevenueClick}
        className="flex-1 min-h-[4.75rem] flex flex-col justify-center cursor-pointer bg-gradient-to-br from-[#E03673] to-[#E03673]/80 text-white rounded-lg shadow-sm px-3 py-2 transition-all hover:shadow-md hover:scale-[1.01]"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-fluid-2xs font-medium text-white/80 truncate">Receita Total</span>
          <DollarSign className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
        </div>
        <p className="text-lg sm:text-xl font-bold truncate leading-tight">{formatCurrency(currentMonthRevenue)}</p>
        <p className="text-fluid-2xs text-white/70 truncate">{currentMonthSessions} sessões este mês</p>
      </div>
    </div>
  );
}
