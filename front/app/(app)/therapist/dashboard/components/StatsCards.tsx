"use client";

import type { Stats, FilterType } from '../types';
import { Calendar, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface StatsCardsProps {
  stats: Stats;
  activeFilter: FilterType;
  onFilterClick: (filter: FilterType) => void;
  onPeriodChange?: (period: 'week' | 'month' | 'year' | 'all', type: 'completed' | 'cancelled') => void;
}

export function StatsCards({ 
  stats, 
  activeFilter, 
  onFilterClick,
  onPeriodChange
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

  const periodLabels = {
    week: '7 dias',
    month: '30 dias',
    year: '12 meses',
    all: 'Todo período'
  };

  const handlePeriodClick = (period: 'week' | 'month' | 'year' | 'all', type: 'completed' | 'cancelled') => {
    if (type === 'completed') {
      setCompletedPeriod(period);
    } else {
      setCancelledPeriod(period);
    }
    
    if (onPeriodChange) {
      onPeriodChange(period, type);
    }
  };

  const getUpcomingValue = (): number => {
    if (typeof stats.upcoming === 'number') return stats.upcoming;
    if (stats.upcoming && typeof stats.upcoming === 'object') {
      return (stats.upcoming as any).all || 0;
    }
    return 0;
  };

  const getAvailabilityValue = (): number => {
    return (stats as any).totalAvailability || (stats as any).availability || 0;
  };

  const cards = [
    {
      id: 'upcoming' as FilterType,
      title: 'Próximas sessões',
      value: getUpcomingValue(),
      icon: <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 flex-shrink-0" />,
      description: 'Agendadas para os próximos dias',
      onClick: () => onFilterClick('upcoming'),
      hasPeriodFilter: false
    },
    {
      id: 'completed' as FilterType,
      title: 'Sessões realizadas',
      value: getCompletedValue(),
      icon: <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 flex-shrink-0" />,
      description: 'Já realizadas',
      onClick: () => onFilterClick('completed'),
      hasPeriodFilter: true,
      currentPeriod: completedPeriod,
      onPeriodClick: (period: 'week' | 'month' | 'year' | 'all') => handlePeriodClick(period, 'completed')
    },
    {
      id: 'cancelled' as FilterType,
      title: 'Cancelamentos',
      value: getCancelledValue(),
      icon: <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 flex-shrink-0" />,
      description: 'Sessões canceladas',
      onClick: () => onFilterClick('cancelled'),
      hasPeriodFilter: true,
      currentPeriod: cancelledPeriod,
      onPeriodClick: (period: 'week' | 'month' | 'year' | 'all') => handlePeriodClick(period, 'cancelled')
    },
    {
      id: 'availability' as FilterType,
      title: 'Disponibilidade',
      value: getAvailabilityValue(),
      icon: <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 flex-shrink-0" />,
      description: 'Horários configurados',
      onClick: () => onFilterClick('availability'),
      hasPeriodFilter: false
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.id}
          className={`
            w-full bg-gradient-to-br from-[#E03673] to-[#E03673]/80 
            text-white rounded-lg shadow p-2.5 sm:p-3 lg:p-4
            overflow-hidden min-w-0
            transition-all hover:shadow-md
            ${activeFilter === card.id ? 'ring-2 ring-white/50' : ''}
          `}
        >
          <div 
            onClick={card.onClick}
            className="cursor-pointer min-w-0"
          >
            <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
              <h3 className="text-[11px] sm:text-xs lg:text-sm font-medium text-white/80 truncate">{card.title}</h3>
              {card.icon}
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-white truncate">{card.value}</p>
            <p className="text-[10px] sm:text-[11px] lg:text-xs text-white/70 mt-1 truncate">{card.description}</p>
          </div>
          
          {card.hasPeriodFilter && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 pt-2 border-t border-white/20">
              {(['week', 'month', 'year', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={(e) => {
                    e.stopPropagation();
                    card.onPeriodClick(period);
                  }}
                  className={`
                    px-1.5 sm:px-2 py-1 rounded text-[10px] sm:text-[11px] lg:text-xs transition-colors cursor-pointer truncate
                    ${card.currentPeriod === period 
                      ? 'bg-white/30 text-white font-medium' 
                      : 'bg-white/10 hover:bg-white/20 text-white/80'
                    }
                  `}
                >
                  {periodLabels[period]}
                </button>
              ))}
            </div>
          )}
          
          {card.id === 'availability' && (
            <div className="text-[10px] sm:text-[11px] lg:text-xs text-white/70 mt-2 flex items-center gap-1 min-w-0">
              <TrendingUp className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Horários configurados</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}