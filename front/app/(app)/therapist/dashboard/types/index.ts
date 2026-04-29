// ===========================================
// TYPES COMPARTILHADOS DO DASHBOARD DO TERAPEUTA
// ===========================================

export type Appointment = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  patient?: {
    id: number;
    email: string;
    full_name?: string;
    phone?: string;
    foto_url?: string;  // 🔥 ADICIONADO CAMPO DA FOTO
  };
  video_call_url?: string;
  rescheduled_from_id?: number;
};

export type Patient = {
  id: number;
  user_id: number;
  full_name?: string;
  email: string;
  phone?: string;
  session_count: number;
  last_session?: Date;
  is_frequent: boolean;
  is_blocked?: boolean;
  foto_url?: string;  // 🔥 ADICIONADO CAMPO DA FOTO
};

export type FilterPeriod = "week" | "month" | "year" | "all";
export type SessionFilter = "upcoming" | "completed" | "cancelled" | "all";

export type Stats = {
  upcoming: number;
  completed: Record<FilterPeriod, number>;
  cancelled: Record<FilterPeriod, number>;
  totalAvailability: number;
};