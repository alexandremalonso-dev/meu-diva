// ===========================================
// HOOK PARA CÁLCULO DE ESTATÍSTICAS
// ===========================================

import { useMemo } from 'react';
import type { Appointment, FilterPeriod, Stats } from '../types';

export function useStats(appointments: Appointment[], totalAvailability: number = 0): Stats {
  return useMemo(() => {
    const now = new Date();
    const periods: FilterPeriod[] = ["week", "month", "year", "all"];
    
    // Função para calcular data de início do período
    const getDateRange = (period: FilterPeriod) => {
      const start = new Date(now);
      switch (period) {
        case "week": start.setDate(now.getDate() - 7); break;
        case "month": start.setMonth(now.getMonth() - 1); break;
        case "year": start.setFullYear(now.getFullYear() - 1); break;
        case "all": return new Date(0);
      }
      return start;
    };

    // Calcular próximas sessões (futuras)
    const upcoming = appointments.filter(
      (apt) => new Date(apt.starts_at) > now && 
               ["scheduled", "confirmed"].includes(apt.status)
    ).length;

    // Inicializar objetos de estatísticas
    const completed: Record<FilterPeriod, number> = { week: 0, month: 0, year: 0, all: 0 };
    const cancelled: Record<FilterPeriod, number> = { week: 0, month: 0, year: 0, all: 0 };
    
    // Calcular para cada período
    periods.forEach(period => {
      const start = getDateRange(period);
      
      completed[period] = appointments.filter(
        (apt) => apt.status === "completed" && new Date(apt.starts_at) >= start
      ).length;
      
      cancelled[period] = appointments.filter(
        (apt) => apt.status?.includes("cancelled") && new Date(apt.starts_at) >= start
      ).length;
    });
    
    // 🔥 Calcular slots ocupados (sessões agendadas/confirmadas/propostas no futuro)
    const occupiedSlots = appointments.filter(
      (apt) => ["scheduled", "confirmed", "proposed"].includes(apt.status) &&
               new Date(apt.starts_at) > now
    ).length;
    
    // 🔥 Calcular slots disponíveis = totalAvailability - occupiedSlots
    const availableSlots = Math.max(0, totalAvailability - occupiedSlots);
    
    console.log("📊 useStats calculado:", {
      totalAvailability,
      occupiedSlots,
      availableSlots,
      upcoming,
      completed,
      cancelled
    });
    
    return {
      upcoming,
      completed,
      cancelled,
      totalAvailability,
      availableSlots,
      occupiedSlots
    };
  }, [appointments, totalAvailability]);
}