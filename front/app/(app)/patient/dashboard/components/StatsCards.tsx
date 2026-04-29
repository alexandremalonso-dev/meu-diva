"use client";

interface StatsCardsProps {
  stats: {
    upcoming: number;
    completed: number;
    cancelled: number;
    total: number;
  };
  activeFilter: string;
  onFilterClick: (filter: string) => void;
}

export function StatsCards({ stats, activeFilter, onFilterClick }: StatsCardsProps) {
  const cards = [
    {
      id: 'upcoming',
      title: 'Próximas sessões',
      value: stats.upcoming,
      icon: '📅',
      gradient: 'from-gray-50 to-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-900',
      subtext: 'text-gray-600'
    },
    {
      id: 'completed',
      title: 'Realizadas',
      value: stats.completed,
      icon: '✅',
      gradient: 'from-gray-50 to-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-900',
      subtext: 'text-gray-600'
    },
    {
      id: 'cancelled',
      title: 'Canceladas',
      value: stats.cancelled,
      icon: '❌',
      gradient: 'from-gray-50 to-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-900',
      subtext: 'text-gray-600'
    },
    {
      id: 'all',
      title: 'Total de sessões',
      value: stats.total,
      icon: '📊',
      gradient: 'from-gray-50 to-gray-100',
      border: 'border-gray-200',
      text: 'text-gray-900',
      subtext: 'text-gray-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <button
          key={card.id}
          onClick={() => onFilterClick(card.id)}
          className={`
            relative overflow-hidden rounded-xl p-5
            bg-gradient-to-br ${card.gradient}
            border ${card.border}
            transition-all duration-200
            hover:shadow-md hover:border-gray-300
            ${activeFilter === card.id ? 'ring-2 ring-gray-400 ring-offset-2' : ''}
          `}
        >
          {/* Número grande ao fundo (efeito sutil) */}
          <div className="absolute right-2 bottom-1 text-5xl font-bold text-gray-200 select-none">
            {card.value}
          </div>
          
          {/* Conteúdo */}
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className={`text-3xl font-bold ${card.text}`}>{card.value}</span>
            </div>
            <p className={`text-sm font-medium ${card.subtext}`}>{card.title}</p>
          </div>

          {/* Indicador de filtro ativo */}
          {activeFilter === card.id && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-gray-500 rounded-full animate-pulse" />
          )}
        </button>
      ))}
    </div>
  );
}