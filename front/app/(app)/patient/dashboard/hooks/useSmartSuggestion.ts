import { useState } from 'react';
import type { Appointment, Therapist, Suggestion } from '../types';
import { api } from "@/lib/api";

export function useSmartSuggestion() {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestion = async (appointments: Appointment[], therapists: Therapist[]) => {
    // 🔥 Se já tem sugestão, não gera novamente
    if (suggestion) return suggestion;
    
    setLoading(true);
    
    try {
      // 1. Pega as últimas 5 sessões agendadas
      const recentSessions = appointments
        .filter(apt => ["scheduled", "confirmed"].includes(apt.status))
        .slice(0, 5);
      
      if (recentSessions.length === 0) {
        setLoading(false);
        return null;
      }
      
      // 2. Conta frequência por terapeuta
      const therapistFrequency: Record<number, { count: number; lastDate: Date }> = {};
      
      recentSessions.forEach(apt => {
        const date = new Date(apt.starts_at);
        
        if (!therapistFrequency[apt.therapist_user_id]) {
          therapistFrequency[apt.therapist_user_id] = {
            count: 0,
            lastDate: date
          };
        }
        therapistFrequency[apt.therapist_user_id].count++;
        
        if (date > therapistFrequency[apt.therapist_user_id].lastDate) {
          therapistFrequency[apt.therapist_user_id].lastDate = date;
        }
      });
      
      // 3. Ordena por frequência
      const sortedTherapists = Object.entries(therapistFrequency)
        .sort(([, a], [, b]) => b.count - a.count);
      
      // 4. Para cada terapeuta frequente, busca disponibilidade
      for (const [therapistId] of sortedTherapists) {
        const therapist = therapists.find(t => t.user_id === Number(therapistId));
        if (!therapist) continue;
        
        // Busca disponibilidade
        try {
          const data = await api(`/api/calendar?therapistId=${therapistId}&days=30`);
          const slots = data.slots || [];
          
          if (slots.length > 0) {
            const today = new Date();
            const futureSlots = slots
              .map((slot: any) => ({ ...slot, date: new Date(slot.starts_at) }))
              .filter((slot: any) => slot.date > today)
              .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
            
            if (futureSlots.length > 0) {
              const nextSlot = futureSlots[0];
              const nextDate = nextSlot.date;
              
              const year = nextDate.getFullYear();
              const month = String(nextDate.getMonth() + 1).padStart(2, '0');
              const day = String(nextDate.getDate()).padStart(2, '0');
              const hours = String(nextDate.getHours()).padStart(2, '0');
              const minutes = nextDate.getMinutes() === 0 ? "00" : "30";
              
              const daysOfWeek = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
              
              const newSuggestion = {
                therapistId,
                therapistName: therapist.user?.full_name || therapist.user?.email || "Terapeuta",
                dayOfWeek: daysOfWeek[nextDate.getDay()],
                time: `${hours}:${minutes}`,
                nextDate: `${year}-${month}-${day}`,
                hasAvailability: true
              };
              
              setSuggestion(newSuggestion);
              setLoading(false);
              return newSuggestion;
            }
          }
        } catch (error) {
          console.error("Erro ao buscar disponibilidade:", error);
          continue;
        }
      }
      
      setSuggestion(null);
      setLoading(false);
      return null;
      
    } catch (error) {
      console.error("Erro ao gerar sugestão:", error);
      setLoading(false);
      return null;
    }
  };

  return {
    suggestion,
    loading,
    generateSuggestion
  };
}