"use client";

import { Calendar, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";

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
    if (selectedPeriod === "all") return stats.all;
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
    { title: "Próximas Sessões", value: currentStats.upcoming, icon: Calendar, filter: "upcoming", onClick: onUpcomingClick, hasPeriod: false },
    { title: "Sessões Realizadas", value: getValueByPeriod("completed"), icon: CheckCircle, filter: "completed", hasPeriod: true, onPeriodClick: (p: string) => onPeriodFilter(p, "completed") },
    { title: "Cancelamentos", value: getValueByPeriod("cancelled"), icon: XCircle, filter: "cancelled", hasPeriod: true, onPeriodClick: (p: string) => onPeriodFilter(p, "cancelled") },
    { title: "Disponibilidade", value: getValueByPeriod("availability"), icon: Clock, filter: "availability", onClick: onAvailabilityClick, hasPeriod: true, onPeriodClick: (p: string) => onPeriodFilter(p, "availability") },
  ];

  return (
    // 🔥 Distribuído uniformemente para preencher a linha do grid (agora
    // seguro: a altura da linha é limitada pelo grid-rows do page.tsx,
    // não cresce indefinidamente em monitores grandes).
    <div className="flex flex-col gap-1.5 h-full">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = sessionFilter === card.filter;
        return (
          <div
            key={card.title}
            onClick={() => card.onClick?.()}
            className={`flex-1 ${card.hasPeriod ? "min-h-[5.75rem]" : "min-h-[4.75rem]"} flex flex-col justify-center bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-lg shadow-sm px-3 py-2 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] text-white ${isActive ? "ring-2 ring-white/50 ring-offset-1" : ""}`}
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-fluid-2xs font-medium text-white/80 truncate">{card.title}</span>
              <Icon className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
            </div>
            <p className="text-lg sm:text-xl font-bold truncate leading-tight">{card.value}</p>

            {card.hasPeriod && (
              <div className="flex flex-wrap gap-1 mt-1">
                {["week", "month", "year", "all"].map((period) => (
                  <button
                    key={period}
                    onClick={(e) => { e.stopPropagation(); card.onPeriodClick?.(period); }}
                    className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
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

      <div
        onClick={() => onFinancialClick?.()}
        className="flex-1 min-h-[4.75rem] flex flex-col justify-center bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-lg shadow-sm px-3 py-2 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] text-white"
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-fluid-2xs font-medium text-white/80 truncate">Receita Total</span>
          <DollarSign className="w-3.5 h-3.5 text-white/80 flex-shrink-0" />
        </div>
        <p className="text-lg sm:text-xl font-bold truncate leading-tight">{formatCurrency(currentStats.totalRevenue)}</p>
        <p className="text-fluid-2xs text-white/70 truncate">{getValueByPeriod("completed")} sessões realizadas</p>
      </div>
    </div>
  );
}
