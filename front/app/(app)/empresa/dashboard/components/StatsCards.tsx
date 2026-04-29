"use client";

import { Calendar, CheckCircle, XCircle, Clock, TrendingUp, DollarSign } from "lucide-react";

interface StatsCardsProps {
  stats: {
    week: { upcoming: number; completed: number; cancelled: number; totalRevenue: number; totalAvailability: number };
    month: { upcoming: number; completed: number; cancelled: number; totalRevenue: number; totalAvailability: number };
    year: { upcoming: number; completed: number; cancelled: number; totalRevenue: number; totalAvailability: number };
    all: { upcoming: number; completed: number; cancelled: number; totalRevenue: number; totalAvailability: number };
  };
  sessionFilter: string;
  selectedPeriod: string;
  onUpcomingClick: () => void;
  onPeriodFilter: (period: string, type: "completed" | "cancelled" | "availability") => void;
  onAvailabilityClick: () => void;
  onFinancialClick?: () => void;
}

export function StatsCards({
  stats,
  sessionFilter,
  selectedPeriod,
  onUpcomingClick,
  onPeriodFilter,
  onAvailabilityClick,
  onFinancialClick
}: StatsCardsProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const getCurrentStats = () => {
    if (selectedPeriod === "all") {
      return stats.all;
    }
    return stats[selectedPeriod as keyof typeof stats] || stats.all;
  };

  const currentStats = getCurrentStats();

  const getValueByPeriod = (type: "completed" | "cancelled" | "availability") => {
    if (selectedPeriod === "all") {
      if (type === "completed") return stats.all.completed;
      if (type === "cancelled") return stats.all.cancelled;
      if (type === "availability") return stats.all.totalAvailability;
    }
    const periodStats = stats[selectedPeriod as keyof typeof stats];
    if (!periodStats) return 0;
    if (type === "completed") return periodStats.completed;
    if (type === "cancelled") return periodStats.cancelled;
    if (type === "availability") return periodStats.totalAvailability;
    return 0;
  };

  const cards = [
    {
      title: "Próximas Sessões",
      value: currentStats.upcoming,
      icon: Calendar,
      filter: "upcoming",
      onClick: onUpcomingClick,
      hasPeriod: false,
    },
    {
      title: "Sessões Realizadas",
      value: getValueByPeriod("completed"),
      icon: CheckCircle,
      filter: "completed",
      hasPeriod: true,
      onPeriodClick: (period: string) => onPeriodFilter(period, "completed"),
    },
    {
      title: "Cancelamentos",
      value: getValueByPeriod("cancelled"),
      icon: XCircle,
      filter: "cancelled",
      hasPeriod: true,
      onPeriodClick: (period: string) => onPeriodFilter(period, "cancelled"),
    },
    {
      title: "Disponibilidade",
      value: getValueByPeriod("availability"),
      icon: Clock,
      filter: "availability",
      onClick: onAvailabilityClick,
      hasPeriod: true,
      onPeriodClick: (period: string) => onPeriodFilter(period, "availability"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = sessionFilter === card.filter;

        return (
          <div
            key={card.title}
            onClick={() => card.onClick?.()}
            className={`bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] text-white ${
              isActive ? "ring-2 ring-white/50 ring-offset-2" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-white/80">{card.title}</span>
              <Icon className="w-5 h-5 text-white/80" />
            </div>
            <p className="text-2xl font-bold">{card.value}</p>

            {card.hasPeriod && (
              <div className="flex gap-1 mt-2 pt-2 border-t border-white/20">
                {["week", "month", "year", "all"].map((period) => (
                  <button
                    key={period}
                    onClick={(e) => {
                      e.stopPropagation();
                      card.onPeriodClick?.(period);
                    }}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      selectedPeriod === period && sessionFilter === card.filter
                        ? "bg-white/30 text-white font-medium"
                        : "bg-white/10 hover:bg-white/20 text-white/80"
                    }`}
                  >
                    {period === "week" ? "Sem" : period === "month" ? "Mês" : period === "year" ? "Ano" : "Todo"}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Card Financeiro */}
      <div
        onClick={() => onFinancialClick?.()}
        className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-sm p-4 cursor-pointer transition-all hover:shadow-md hover:scale-[1.02] text-white"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-white/80">Receita Total</span>
          <DollarSign className="w-5 h-5 text-white/80" />
        </div>
        <p className="text-2xl font-bold">{formatCurrency(currentStats.totalRevenue)}</p>
        <p className="text-xs text-white/70 mt-1">{getValueByPeriod("completed")} sessões realizadas</p>
        <div className="flex items-center gap-1 mt-2 text-xs text-white/60">
          <TrendingUp className="w-3 h-3" />
          <span>Ver relatório</span>
        </div>
      </div>
    </div>
  );
}