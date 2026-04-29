export type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
export type SessionFilter = 'all' | 'completed' | 'pending' | 'cancelled' | 'no_show';

// 🔥 Estatísticas por período (o que o useStats realmente retorna)
export interface PeriodStats {
  upcoming: number;
  completed: number;
  cancelled: number;
  totalRevenue: number;
  totalAvailability: number;
}

// 🔥 Stats principal (agregado por período)
export interface Stats {
  week: PeriodStats;
  month: PeriodStats;
  year: PeriodStats;
  all: PeriodStats;
  // 🔥 ADICIONADO para compatibilidade com código existente
  availability?: number;
  total?: number;
  completed?: number;
  pending?: number;
  cancelled?: number;
  noShow?: number;
  occupationRate?: number;
  totalRevenue?: number;
  averageTicket?: number;
}

// Para compatibilidade com código antigo que espera Stats direto
export interface LegacyStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  occupationRate: number;
  totalRevenue: number;
  averageTicket: number;
}

export interface Appointment {
  id: number;
  patient_id: number;
  therapist_id: number;
  appointment_date: string;
  starts_at?: string;
  status: string;
  session_price: number;
  meet_link?: string;
  notes?: string;
  patient_name?: string;
  therapist_name?: string;
  created_at: string;
  updated_at: string;
}