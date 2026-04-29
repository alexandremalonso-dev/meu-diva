// ============================================
// TIPOS PARA O DASHBOARD DO PACIENTE
// ============================================

/**
 * Representa um terapeuta (para listagem e seleção)
 */
export type Therapist = {
  id: number;
  user_id: number;
  full_name?: string;           // 🔥 NOME CORRETO (com underscore)
  email: string;
  bio?: string;
  specialties?: string;
  session_price?: number;
  foto_url?: string;
  experiencia?: string;
  abordagem?: string;
  idiomas?: string;
  user?: {
    full_name?: string;
    email: string;
  };
};

/**
 * Representa uma sessão/agendamento
 */
export type Appointment = {
  id: number;
  therapist_user_id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  rescheduled_from_id?: number;
  video_call_url?: string;
  created_at?: string;
  updated_at?: string;
  
  // 🔥 Dados do terapeuta (opcionais)
  therapist?: {
    id: number;
    email: string;
    full_name?: string;         // 🔥 NOME CORRETO (com underscore)
    specialties?: string;
    bio?: string;
    session_price?: number;
    foto_url?: string;
  };
  
  // 🔥 Dados do paciente (para o terapeuta)
  patient?: {
    id: number;
    email: string;
    full_name?: string;
    phone?: string;
  };
};

/**
 * Representa um slot de disponibilidade no calendário
 */
export type Slot = {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  available?: boolean;
  therapist_id?: number;
};

/**
 * Tipos de filtro para a lista de sessões
 */
export type FilterType = "upcoming" | "completed" | "cancelled" | "all";

/**
 * Estatísticas resumidas do dashboard
 */
export type Stats = {
  upcoming: number;
  completed: number;
  cancelled: number;
  total: number;
};

/**
 * Sugestão inteligente para agendamento rápido
 */
export type Suggestion = {
  therapistId: string;
  therapistName: string;
  dayOfWeek: string;
  time: string;
  nextDate: string;
  hasAvailability: boolean;
  therapistSpecialties?: string;
  therapistBio?: string;
};

/**
 * Tipo para convites
 */
export type Invite = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
  duration_minutes: number;
  therapist?: {
    full_name?: string;
    email: string;
    specialties?: string;
    bio?: string;
    foto_url?: string;
  };
  patient?: {
    full_name?: string;
    email: string;
  };
};

/**
 * Tipo para resposta da API de calendário
 */
export type CalendarResponse = {
  slots: Slot[];
  busy?: {
    start: string;
    end: string;
  }[];
};

/**
 * Tipo para notificações/mensagens
 */
export type Notification = {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
  createdAt: Date;
};