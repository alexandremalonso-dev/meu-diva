// ============================================
// PATIENT TYPES
// ============================================

export interface PatientProfile {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string;
  cpf?: string;
  foto_url?: string;
  timezone: string;
  preferred_language: string;
  created_at: string;
  updated_at?: string;
  
  // Relacionamentos
  addresses?: PatientAddress[];
  goals?: PatientGoal[];
}

export interface PatientAddress {
  id: number;
  patient_id: number;
  street: string;
  number?: string;
  complement?: string;
  district?: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  is_default: boolean;
  created_at: string;
}

export interface PatientAddressCreate {
  street: string;
  number?: string;
  complement?: string;
  district?: string;
  city: string;
  state: string;
  zipcode: string;
  country?: string;
  is_default?: boolean;
}

export interface PatientGoal {
  id: number;
  patient_id: number;
  goal_type: string;
  is_active: boolean;
  selected_at: string;
  completed_at?: string;
  notes?: string;
}

export interface PatientGoalCreate {
  goal_type: string;
  is_active?: boolean;
}

export interface GoalType {
  id: number;
  name: string;
  description?: string;
  icon?: string;
}

export interface PatientPhotoResponse {
  foto_url: string;
  message: string;
}

// ============================================
// PATIENT DASHBOARD TYPES (complementando os existentes)
// ============================================

export interface PatientDashboardData {
  profile: PatientProfile;
  metrics: {
    sessions_last_90_days: number;
    last_session_date?: string;
    next_session_date?: string;
  };
  next_session?: {
    id: number;
    date: string;
    time: string;
    therapist_name: string;
    therapist_id: number;
    status: string;
  };
  recent_sessions: Array<{
    id: number;
    date: string;
    time: string;
    therapist_name: string;
    status: string;
  }>;
  frequent_therapists: Array<{
    therapist_id: number;
    therapist_name: string;
    count: number;
  }>;
  active_goal?: string;
}