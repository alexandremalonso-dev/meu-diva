// ============================================
// TIPOS PARA PERFIL DO PACIENTE
// ============================================

export interface PatientAddress {
  id: number;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip_code?: string;
  zipcode?: string;
  country?: string;
  is_main?: boolean;
  is_default?: boolean;
  address_type?: string;
}

export interface PatientGoal {
  id: number;
  title: string;
  description?: string;
  goal_type_id: number;
  goal_type?: {
    id: number;
    name: string;
    description?: string;
  };
  status: 'active' | 'completed' | 'archived';
  target_date?: string;
  created_at: string;
  updated_at: string;
  is_active?: boolean;
  completed_at?: string | null;
  selected_at?: string;
}

export interface GoalType {
  id: number;
  name: string;
  description?: string;
}

export interface PatientProfile {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  phone?: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  bio?: string;
  foto_url?: string;
  addresses?: PatientAddress[];
  goals?: PatientGoal[];
  created_at?: string;
  updated_at?: string;
  cpf?: string;
  education_level?: string;
  timezone?: string;
  preferred_language?: string;
  occupation?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  how_did_you_find?: string;
  terms_accepted?: boolean;
  terms_accepted_at?: string;
  // ✅ LGPD — mesmo padrão do terapeuta
  lgpd_consent?: boolean;
  lgpd_consent_date?: string | null;
}

export interface PatientProfileUpdate {
  full_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  bio?: string;
  cpf?: string;
  education_level?: string;
  timezone?: string;
  preferred_language?: string;
  occupation?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  // ✅ LGPD
  lgpd_consent?: boolean;
}

export interface PatientPhotoResponse {
  foto_url: string;
  message: string;
}