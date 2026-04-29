// HOOK PARA GERENCIAMENTO DE FILTROS
// ===========================================

import { useState, useCallback, useEffect } from 'react';
import type { Appointment, FilterPeriod, SessionFilter } from '../types';

export function useFilters(appointments: Appointment[]) {
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>("all");
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");

  // 🔥 EFEITO INICIAL: Filtrar para mostrar apenas canceladas (ou o que fizer sentido)
  useEffect(() => {
    if (appointments.length > 0) {
      // Mostrar apenas canceladas inicialmente
      const initialCancelled = appointments.filter(apt => apt.status.includes("cancelled"));
      setFilteredAppointments([...initialCancelled].sort((a, b) => 
        new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
      ));
      setSessionFilter("cancelled");
    }
  }, [appointments]);

  // Aplicar filtro de sessão (upcoming/completed/cancelled/all)
  const applySessionFilter = useCallback((filter: SessionFilter, data = appointments) => {
    setSessionFilter(filter);
    setSelectedPeriod("all");
    
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
        filtered = data.filter((apt) => apt.status === "completed");
        break;
      case "cancelled":
        filtered = data.filter((apt) => apt.status.includes("cancelled"));
        break;
      case "all":
      default:
        filtered = data;
        break;
    }
    
    setFilteredAppointments([...filtered].sort((a, b) => 
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
    ));
  }, [appointments]);

  // 🔥 CORREÇÃO PRINCIPAL: Filtrar por período com datas COMPARANDO CORRETAMENTE
  const filterByPeriod = useCallback((period: FilterPeriod, type: "completed" | "cancelled") => {
    console.log("========== FILTER BY PERIOD CHAMADO ==========");
    console.log("Período:", period);
    console.log("Tipo:", type);
    console.log("Total de appointments disponíveis:", appointments.length);
    
    const now = new Date();
    let start = new Date(now);
    
    // 🔥 IMPORTANTE: Zerar horas para comparar apenas datas
    now.setHours(23, 59, 59, 999); // Fim do dia
    start.setHours(0, 0, 0, 0);     // Início do dia
    
    switch (period) {
      case "week": 
        start.setDate(now.getDate() - 7); 
        break;
      case "month": 
        start.setMonth(now.getMonth() - 1); 
        break;
      case "year": 
        start.setFullYear(now.getFullYear() - 1); 
        break;
      case "all": 
        start = new Date(0); // 1970
        break;
    }
    
    console.log("📅 Período real:", start.toLocaleDateString('pt-BR'), "até", now.toLocaleDateString('pt-BR'));
    
    // Filtrar appointments do tipo correto e dentro do período
    const filtered = appointments.filter(apt => {
      const aptDate = new Date(apt.starts_at);
      
      const matchesType = type === "completed" 
        ? apt.status === "completed"
        : apt.status.includes("cancelled");
      
      // 🔥 CORREÇÃO: Comparar timestamps numéricos para evitar problemas de timezone
      const matchesPeriod = aptDate.getTime() >= start.getTime() && 
                            aptDate.getTime() <= now.getTime();
      
      return matchesType && matchesPeriod;
    });
    
    console.log(`✅ Encontradas: ${filtered.length} ${type}`);
    
    // Mostrar amostra das datas para debug
    if (filtered.length > 0) {
      console.log("📊 Amostra das datas:", filtered.slice(0, 3).map(a => ({
        data: new Date(a.starts_at).toLocaleDateString('pt-BR'),
        status: a.status
      })));
    }
    
    setSelectedPeriod(period);
    setSessionFilter(type);
    setFilteredAppointments([...filtered].sort((a, b) => 
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
    ));
    
    console.log("===========================================");
    
    return filtered.length;
  }, [appointments]);

  // 🔥 Limpar todos os filtros (voltar para canceladas)
  const clearFilters = useCallback(() => {
    setSelectedPeriod("all");
    setSessionFilter("cancelled");
    const cancelled = appointments.filter(apt => apt.status.includes("cancelled"));
    setFilteredAppointments([...cancelled].sort((a, b) => 
      new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
    ));
  }, [appointments]);

  // 🔥 Verificar se há filtros ativos
  const hasActiveFilters = useCallback(() => {
    return selectedPeriod !== "all" || sessionFilter !== "cancelled";
  }, [selectedPeriod, sessionFilter]);

  // 🔥 Obter contagem atual baseada nos filtros
  const getCurrentCount = useCallback((type: "completed" | "cancelled") => {
    return filteredAppointments.filter(apt => 
      type === "completed" 
        ? apt.status === "completed"
        : apt.status.includes("cancelled")
    ).length;
  }, [filteredAppointments]);

  // 🔥 Obter contagem por período específico (para os cards)
  const getCountByPeriod = useCallback((period: FilterPeriod, type: "completed" | "cancelled") => {
    const now = new Date();
    let start = new Date(now);
    
    now.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);
    
    switch (period) {
      case "week": start.setDate(now.getDate() - 7); break;
      case "month": start.setMonth(now.getMonth() - 1); break;
      case "year": start.setFullYear(now.getFullYear() - 1); break;
      case "all": start = new Date(0); break;
    }
    
    return appointments.filter(apt => {
      const aptDate = new Date(apt.starts_at);
      const matchesType = type === "completed" 
        ? apt.status === "completed"
        : apt.status.includes("cancelled");
      return matchesType && aptDate.getTime() >= start.getTime() && aptDate.getTime() <= now.getTime();
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
    setSessionFilter
  };
}
