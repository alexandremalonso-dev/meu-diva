/**
 * Período de disponibilidade do terapeuta
 */
export type AvailabilityPeriod = {
  id?: number;
  therapist_profile_id?: number;
  start_date: string;  // Formato: YYYY-MM-DD
  end_date: string;    // Formato: YYYY-MM-DD
  slots: AvailabilitySlot[];
  created_at?: string;
}

/**
 * Slot de horário recorrente dentro de um período
 */
export type AvailabilitySlot = {
  id?: number;
  period_id?: number;
  weekday: number;     // 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado
  start_time: string;  // Formato: HH:MM
  end_time: string;    // Formato: HH:MM
  created_at?: string;
}

/**
 * Payload para criar um novo período com seus slots
 */
export type CreateAvailabilityPayload = {
  start_date: string;
  end_date: string;
  slots: Omit<AvailabilitySlot, 'id' | 'period_id' | 'created_at'>[];
}

/**
 * Resposta da API ao criar/consultar períodos
 */
export type AvailabilityPeriodResponse = AvailabilityPeriod & {
  slots: (AvailabilitySlot & { id: number })[];
}

/**
 * Dias da semana em português
 */
export const WEEKDAYS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado"
];

/**
 * Dias da semana abreviados
 */
export const WEEKDAYS_SHORT = [
  "DOM",
  "SEG",
  "TER",
  "QUA",
  "QUI",
  "SEX",
  "SÁB"
];