import { useState, useCallback } from 'react';
import type { Appointment, FilterType } from '../types';

export function usePatientFilters(appointments: Appointment[]) {
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>(appointments);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const applyFilter = useCallback((filter: FilterType, data = appointments) => {
    setActiveFilter(filter);
    
    const now = new Date();
    
    let filtered;
    switch (filter) {
      case "upcoming":
        filtered = data.filter(
          (apt) => new Date(apt.starts_at) > now && 
                   ["scheduled", "confirmed"].includes(apt.status)
        );
        break;
      case "completed":
        filtered = data.filter(
          (apt) => apt.status === "completed"
        );
        break;
      case "cancelled":
        filtered = data.filter(
          (apt) => apt.status.includes("cancelled")
        );
        break;
      case "all":
      default:
        filtered = data;
        break;
    }
    
    setFilteredAppointments(filtered.sort((a, b) => 
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    ));
  }, [appointments]);

  const clearFilter = useCallback(() => {
    applyFilter("all");
  }, [applyFilter]);

  return {
    filteredAppointments,
    activeFilter,
    applyFilter,
    clearFilter,
    setFilteredAppointments
  };
}