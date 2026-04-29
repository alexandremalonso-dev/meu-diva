// ============================================
// TIPOS COMUNS PARA PARÂMETROS DE FUNÇÕES
// ============================================

// Tipo para objeto genérico
export type AnyObject = Record<string, any>;

// Tipo para função de callback
export type Callback<T = void> = () => T;

// Tipo para parâmetros de sorting
export type SortComparator<T> = (a: T, b: T) => number;

// Tipo para appointment simplificado
export interface SimpleAppointment {
  id: number;
  starts_at: string;
  ends_at?: string;
  status: string;
  session_price?: number;
  patient_name?: string;
  therapist_name?: string;
  patient_id?: number;
  therapist_id?: number;
  patient_foto_url?: string;
  therapist_foto_url?: string;
  meet_link?: string;
}

// Tipo para opções de formatação
export interface FormatOptions {
  locale?: string;
  timezone?: string;
}