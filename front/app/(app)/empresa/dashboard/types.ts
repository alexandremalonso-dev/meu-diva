export type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
export type SessionFilter = 'all' | 'completed' | 'pending' | 'cancelled' | 'no_show';

export interface Stats {
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
  patient_user_id?: number;
  therapist_user_id?: number;
  appointment_date: string;
  starts_at?: string;
  status: string;
  session_price: number;
  meet_link?: string;
  notes?: string;
  patient_name?: string;
  therapist_name?: string;
  patient_foto_url?: string | null;
  patient_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: number;
  user_id: number;
  full_name?: string;
  email?: string;
  phone?: string;
  foto_url?: string | null;
  session_count?: number;
  is_frequent?: boolean;
}