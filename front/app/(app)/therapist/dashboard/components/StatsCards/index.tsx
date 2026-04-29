"use client";

import type { Stats, FilterType } from '../types';
import { Calendar, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface StatsCardsProps {
  stats: Stats;
  activeFilter: FilterType;
  onFilterClick: (filter: FilterType) => void;
  onPeriodFilter: (period: 'week' | 'month' | 'year' | 'all', type: 'completed' | 'cancelled') => void; // 🔥 NOVO
}

export function StatsCards({ 
  stats, 
  activeFilter, 
  onFilterClick,
  onPeriodFilter  // 🔥 Recebe a função do PAI
}: StatsCardsProps) {
  
  // 🔥 Estado local apenas para UI (destaque dos botões)
  const [completedPeriod, setCompletedPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');
  const [cancelledPeriod, setCancelledPeriod] = useState<'week' | 'month' | 'year' | 'all'>('all');

  // 🔥 stats já vem com a estrutura correta do useStats
  // stats.completed.week, stats.completed.month, etc.
  
  const getCompletedValue = (): number => {
    if (typeof stats.completed === 'number') return stats.completed;
    if (stats.completed && typeof stats.completed === 'object') {
      return stats.completed[completedPeriod] || 0;
    }
    return 0;
  };

  const getCancelledValue = (): number => {
    if (typeof stats.cancelled === 'number') return stats.cancelled;
    if (stats.cancelled && typeof stats.cancelled === 'object') {
      return stats.cancelled[cancelledPeriod] || 0;
    }
    return 0;
  };

  const periodLabels = {
    week: '7 dias',
    month: '30 dias',
    year: '12 meses',
    all: 'Todo período'
  };

  // 🔥 Quando clicar no botão de período, chama a função do PAI
  const handlePeriodClick = (period: 'week' | 'month' | 'year' | 'all', type: 'completed' | 'cancelled') => {
    // Atualiza o estado local para destacar o botão
    if (type === 'completed') {
      setCompletedPeriod(period);
    } else {
      setCancelledPeriod(period);
    }
    
    // 🔥 Chama a função do PAI que vai usar o useFilters
    onPeriodFilter(period, type);
  };

  // Dados dos cards
  const cards = [
    {
      id: 'upcoming' as FilterType,
      title: 'Próximas sessões',
      value: typeof stats.upcoming === 'number' ? stats.upcoming : stats.upcoming?.all || 0,
      icon: <Calendar className="w-5 h-5 text-white/80" />,
      description: 'Agendadas para os próximos dias',
      onClick: () => onFilterClick('upcoming'),
      hasPeriodFilter: false
    },
    {
      id: 'completed' as FilterType,
      title: 'Sessões realizadas',
      value: getCompletedValue(),
      icon: <CheckCircle className="w-5 h-5 text-white/80" />,
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
      icon: <XCircle className="w-5 h-5 text-white/80" />,
      description: 'Sessões canceladas',
      onClick: () => onFilterClick('cancelled'),
      hasPeriodFilter: true,
      currentPeriod: cancelledPeriod,
      onPeriodClick: (period: 'week' | 'month' | 'year' | 'all') => handlePeriodClick(period, 'cancelled')
    },
    {
      id: 'availability' as FilterType,
      title: 'Disponibilidade',
      value: stats.totalAvailability || stats.availability || 0,
      icon: <Clock className="w-5 h-5 text-white/80" />,
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
            text-white rounded-lg shadow p-6
            transition-all hover:shadow-md
            ${activeFilter === card.id ? 'ring-2 ring-white/50' : ''}
          `}
        >
          <div 
            onClick={card.onClick}
            className="cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-white/80">{card.title}</h3>
              {card.icon}
            </div>
            <p className="text-3xl font-bold text-white">{card.value}</p>
            <p className="text-xs text-white/70 mt-1">{card.description}</p>
          </div>
          
          {/* 🔥 SELETOR DE PERÍODO - Chama handlePeriodClick */}
          {card.hasPeriodFilter && (
            <div className="flex gap-2 mt-3 pt-2 border-t border-white/20">
              {(['week', 'month', 'year', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={(e) => {
                    e.stopPropagation();
                    card.onPeriodClick(period);
                  }}
                  className={`
                    px-2 py-1 rounded text-xs transition-colors cursor-pointer
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
            <div className="text-xs text-white/70 mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Horários configurados
            </div>
          )}
        </div>
      ))}
    </div>
  );
}