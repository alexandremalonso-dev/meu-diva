export interface User {
  id: number;
  email: string;
  full_name?: string;
  role: 'admin' | 'therapist' | 'patient';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  cpf?: string;
  phone?: string;
  foto_url?: string;
  crp?: string; // Registro do terapeuta
  specialties?: string;
  session_price?: number;
  bio?: string;
}