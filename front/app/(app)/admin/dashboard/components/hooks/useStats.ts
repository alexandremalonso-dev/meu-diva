// ===========================================
// HOOK PARA CÁLCULO DE ESTATÍSTICAS - ADMIN
// ===========================================

import { useMemo } from 'react';
import type { Appointment, FilterPeriod, Stats, PeriodStats } from './types';

export function useStats(appointments: Appointment[], totalAvailability: number = 0): Stats {
  return useMemo(() => {
    const now = new Date();
    const periods: FilterPeriod[] = ["week", "month", "year", "all"];
    
    // Função para calcular data de início do período
    const getDateRange = (period: FilterPeriod): Date => {
      const start = new Date(now);
      switch (period) {
        case "week": start.setDate(now.getDate() - 7); break;
        case "month": start.setMonth(now.getMonth() - 1); break;
        case "year": start.setFullYear(now.getFullYear() - 1); break;
        case "all": return new Date(0);
        case "today": start.setHours(0, 0, 0, 0); break;
      }
      return start;
    };

    // Calcular próximas sessões (futuras) - ADMIN: todas as sessões
    const upcoming = appointments.filter(
      (apt) => {
        const aptDate = apt.starts_at ? new Date(apt.starts_at) : new Date(apt.appointment_date);
        return aptDate > now && ["scheduled", "confirmed"].includes(apt.status);
      }
    ).length;

    // Inicializar objetos de estatísticas por período
    const weekStats: PeriodStats = { upcoming, completed: 0, cancelled: 0, totalRevenue: 0, totalAvailability: 0 };
    const monthStats: PeriodStats = { upcoming, completed: 0, cancelled: 0, totalRevenue: 0, totalAvailability: 0 };
    const yearStats: PeriodStats = { upcoming, completed: 0, cancelled: 0, totalRevenue: 0, totalAvailability: 0 };
    const allStats: PeriodStats = { upcoming, completed: 0, cancelled: 0, totalRevenue: 0, totalAvailability: 0 };
    
    // Calcular para cada appointment
    appointments.forEach(apt => {
      const aptDate = apt.starts_at ? new Date(apt.starts_at) : new Date(apt.appointment_date);
      const isCompleted = apt.status === "completed";
      const isCancelled = apt.status?.includes("cancelled") || false;
      const price = apt.session_price || 0;
      
      // Sempre conta para "all"
      if (isCompleted) {
        allStats.completed++;
        allStats.totalRevenue += price;
      }
      if (isCancelled) allStats.cancelled++;
      
      // Verifica se está no período de 7 dias (week)
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      if (aptDate >= weekAgo) {
        if (isCompleted) {
          weekStats.completed++;
          weekStats.totalRevenue += price;
        }
        if (isCancelled) weekStats.cancelled++;
      }
      
      // Verifica se está no período de 30 dias (month)
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      if (aptDate >= monthAgo) {
        if (isCompleted) {
          monthStats.completed++;
          monthStats.totalRevenue += price;
        }
        if (isCancelled) monthStats.cancelled++;
      }
      
      // Verifica se está no período de 365 dias (year)
      const yearAgo = new Date(now);
      yearAgo.setFullYear(now.getFullYear() - 1);
      if (aptDate >= yearAgo) {
        if (isCompleted) {
          yearStats.completed++;
          yearStats.totalRevenue += price;
        }
        if (isCancelled) yearStats.cancelled++;
      }
    });
    
    // Calcular slots ocupados (todas as sessões futuras de todos os terapeutas)
    const occupiedSlots = appointments.filter(
      (apt) => {
        const aptDate = apt.starts_at ? new Date(apt.starts_at) : new Date(apt.appointment_date);
        return ["scheduled", "confirmed", "proposed"].includes(apt.status) && aptDate > now;
      }
    ).length;
    
    // Calcular slots disponíveis = totalAvailability - occupiedSlots
    const availableSlots = Math.max(0, totalAvailability - occupiedSlots);
    
    // Adicionar totalAvailability aos stats
    weekStats.totalAvailability = availableSlots;
    monthStats.totalAvailability = availableSlots;
    yearStats.totalAvailability = availableSlots;
    allStats.totalAvailability = availableSlots;
    
    console.log("📊 [ADMIN] useStats calculado:", {
      totalAvailability,
      occupiedSlots,
      availableSlots,
      upcoming,
      week: weekStats,
      month: monthStats,
      year: yearStats,
      all: allStats
    });
    
    return {
      week: weekStats,
      month: monthStats,
      year: yearStats,
      all: allStats
    };
  }, [appointments, totalAvailability]);
}