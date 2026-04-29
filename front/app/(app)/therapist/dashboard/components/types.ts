// ============================================
// TIPOS PARA O DASHBOARD DO TERAPEUTA
// ============================================

export type FilterType = 'upcoming' | 'completed' | 'cancelled' | 'availability';

export type PeriodType = 'week' | 'month' | 'year' | 'all';

export interface PeriodStats {
  week: number;
  month: number;
  year: number;
  all: number;
}

export interface Stats {
  upcoming: number | PeriodStats;
  completed: number | PeriodStats;
  cancelled: number | PeriodStats;
  availability?: number;
  totalAvailability?: number;
  totalRevenue?: number;
  occupationRate?: number;
}

export interface StatsCardsProps {
  stats: Stats;
  activeFilter: FilterType;
  onFilterClick: (filter: FilterType) => void;
  onPeriodFilter: (period: PeriodType, type: 'completed' | 'cancelled') => void;
}