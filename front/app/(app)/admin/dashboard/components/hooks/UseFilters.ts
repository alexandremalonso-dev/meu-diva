// ===========================================
// HOOK PARA GERENCIAMENTO DE FILTROS - ADMIN
// ===========================================

import { useState, useCallback, useEffect } from 'react';
import type { Appointment, FilterPeriod, SessionFilter } from './types';

// ✅ Helper seguro para converter starts_at (pode ser undefined)
const toDate = (value: string | undefined): Date =>
  value ? new Date(value) : new Date(0);

export function useFilters(appointments: Appointment[]) {
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");

  useEffect(() => {
    if (appointments.length > 0) {
      const allSorted = [...appointments].sort((a, b) =>
        toDate(b.starts_at).getTime() - toDate(a.starts_at).getTime()
      );
      setFilteredAppointments(allSorted);
      setSessionFilter("all");
    }
  }, [appointments]);

  const applySessionFilter = useCallback((filter: SessionFilter, data = appointments) => {
    setSessionFilter(filter);
    setSelectedPeriod("all");

    const now = new Date();

    let filtered;
    switch (filter) {
      case "completed":
        filtered = data.filter((apt) => apt.status === "completed");
        break;
      case "pending":
        filtered = data.filter((apt) =>
          ["scheduled", "confirmed"].includes(apt.status)
        );
        break;
      case "cancelled":
        filtered = data.filter((apt) => apt.status?.includes("cancelled"));
        break;
      case "no_show":
        filtered = data.filter((apt) => apt.status === "no_show");
        break;
      case "all":
      default:
        filtered = data;
        break;
    }

    setFilteredAppointments([...filtered].sort((a, b) =>
      toDate(b.starts_at).getTime() - toDate(a.starts_at).getTime()
    ));
  }, [appointments]);

  const filterByPeriod = useCallback((period: FilterPeriod, type: "completed" | "cancelled") => {
    const now = new Date();
    let start = new Date(now);

    now.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case "week":  start.setDate(now.getDate() - 7); break;
      case "month": start.setMonth(now.getMonth() - 1); break;
      case "year":  start.setFullYear(now.getFullYear() - 1); break;
      case "all":   start = new Date(0); break;
    }

    const filtered = appointments.filter(apt => {
      const aptDate = toDate(apt.starts_at);
      const matchesType = type === "completed"
        ? apt.status === "completed"
        : apt.status?.includes("cancelled");
      const matchesPeriod =
        aptDate.getTime() >= start.getTime() &&
        aptDate.getTime() <= now.getTime();
      return matchesType && matchesPeriod;
    });

    setSelectedPeriod(period);
    setSessionFilter(type);
    setFilteredAppointments([...filtered].sort((a, b) =>
      toDate(b.starts_at).getTime() - toDate(a.starts_at).getTime()
    ));

    return filtered.length;
  }, [appointments]);

  const clearFilters = useCallback(() => {
    setSelectedPeriod("all");
    setSessionFilter("all");
    const allSorted = [...appointments].sort((a, b) =>
      toDate(b.starts_at).getTime() - toDate(a.starts_at).getTime()
    );
    setFilteredAppointments(allSorted);
  }, [appointments]);

  const hasActiveFilters = useCallback(() => {
    return selectedPeriod !== "all" || sessionFilter !== "all";
  }, [selectedPeriod, sessionFilter]);

  const getCurrentCount = useCallback((type: "completed" | "cancelled") => {
    return filteredAppointments.filter(apt =>
      type === "completed"
        ? apt.status === "completed"
        : apt.status?.includes("cancelled")
    ).length;
  }, [filteredAppointments]);

  const getCountByPeriod = useCallback((period: FilterPeriod, type: "completed" | "cancelled") => {
    const now = new Date();
    let start = new Date(now);

    now.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case "week":  start.setDate(now.getDate() - 7); break;
      case "month": start.setMonth(now.getMonth() - 1); break;
      case "year":  start.setFullYear(now.getFullYear() - 1); break;
      case "all":   start = new Date(0); break;
    }

    return appointments.filter(apt => {
      const aptDate = toDate(apt.starts_at);
      const matchesType = type === "completed"
        ? apt.status === "completed"
        : apt.status?.includes("cancelled");
      return matchesType &&
        aptDate.getTime() >= start.getTime() &&
        aptDate.getTime() <= now.getTime();
    }).length;
  }, [appointments]);

  return {
    filteredAppointments,
    selectedPeriod,
    sessionFilter,
    applySessionFilter,
    filterByPeriod,
    clearFilters,
    hasActiveFilters,
    getCurrentCount,
    getCountByPeriod,
    setFilteredAppointments,
    setSelectedPeriod,
    setSessionFilter,
  };
}