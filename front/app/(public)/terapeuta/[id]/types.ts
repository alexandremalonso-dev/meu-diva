export interface TerapeutaPublico {
  id: number;
  user_id: number;
  full_name: string;
  user?: {
    full_name: string;
    email: string;
  };
  bio: string | null;
  specialties: string | null;
  session_price: number | null;
  foto_url?: string | null;
  experiencia?: string | null;
  abordagem?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  lgbtqia_ally?: boolean;
  formation?: string | null;
  approaches?: string[];
  specialties_list?: string[];
  reasons?: string[];
  service_types?: string[];
  languages_list?: string[];
  rating?: number;
  reviews_count?: number;
  total_sessions?: number;
  verified?: boolean;
  featured?: boolean;
  session_duration_30min?: boolean;
  session_duration_50min?: boolean;
  cancellation_policy?: string | null;
  instagram_url?: string | null;
}

export interface AgendaResumida {
  therapist_user_id: number;
  range_start: string;
  range_end: string;
  slots: Array<{
    starts_at: string;
    ends_at: string;
    duration_minutes: number;
  }>;
  count: number;
}