import { useMemo } from 'react';
import type { Appointment, Stats } from '../types';

export function usePatientStats(appointments: Appointment[]): Stats {
  return useMemo(() => {
    const now = new Date();
    
    const upcoming = appointments.filter(
      (apt) => new Date(apt.starts_at) > now && 
               ["scheduled", "confirmed"].includes(apt.status)
    ).length;
    
    const completed = appointments.filter(
      (apt) => apt.status === "completed"
    ).length;
    
    const cancelled = appointments.filter(
      (apt) => apt.status.includes("cancelled")
    ).length;
    
    return {
      upcoming,
      completed,
      cancelled,
      total: appointments.length,
    };
  }, [appointments]);
}