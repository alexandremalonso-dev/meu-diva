export interface Appointment {
  id: number;
  patient_id: number;
  therapist_id: number;
  appointment_date: string;
  starts_at?: string;
  ends_at?: string;
  status: string;
  session_price: number;
  meet_link?: string;
  notes?: string;
  patient_name?: string;
  therapist_name?: string;
  patient_user_id?: number;
  therapist_user_id?: number;
  patient_foto_url?: string;
  therapist_foto_url?: string;
  created_at: string;
  updated_at: string;
  duration_minutes?: number;
  video_call_url?: string;
  // 🔥 PROPRIEDADES PARA ESTATÍSTICAS
  completed?: number;
  cancelled?: number;
  upcoming?: number;
  availability?: number;
  totalAvailability?: number;
  // 🔥 PROPRIEDADES PARA RELATÓRIOS
  commission_amount?: number;
  net_amount?: number;
  is_refund?: boolean;
  value?: number;
  all?: number;
  // 🔥 DADOS DO PACIENTE/TERAPEUTA
  patient?: {
    id: number;
    full_name: string;
    email: string;
    foto_url?: string;
    phone?: string;
    cpf?: string;
  };
  therapist?: {
    id: number;
    full_name: string;
    email: string;
    foto_url?: string;
    phone?: string;
    crp?: string;
    video_url?: string;
    idiomas?: string;
    payment_change_deadline_message?: string;
  };
}