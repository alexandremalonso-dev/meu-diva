import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Appointment } from '../types';

export function usePatientActions(userId: number | undefined) {
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [showReschedule, setShowReschedule] = useState<Record<number, boolean>>({});
  const [rescheduleDate, setRescheduleDate] = useState<Record<number, string>>({});
  const [rescheduleTime, setRescheduleTime] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 🔥 CANCELAR APPOINTMENT USANDO API()
  const cancelAppointment = useCallback(async (id: number, onSuccess?: () => void) => {
    console.log(`📝 Cancelando appointment ${id}...`);
    
    setActionLoading(prev => ({ ...prev, [id]: true }));
    setError("");
    setSuccess("");

    try {
      // 🔥 USAR API() COM URL RELATIVA (PROXY)
      const data = await api(`/api/appointments/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled_by_patient" })
      });

      console.log("✅ Cancelamento realizado com sucesso!", data);
      setSuccess("Sessão cancelada com sucesso!");
      setShowReschedule({});
      if (onSuccess) onSuccess();
      
    } catch (err: any) {
      console.error("❌ Erro ao cancelar:", err);
      setError(err.message || "Erro ao cancelar sessão");
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  }, []);

  // 🔥 REAGENDAR APPOINTMENT - CORRIGIDO COM LOGS
  const rescheduleAppointment = useCallback(async (appointment: Appointment, onSuccess?: () => void) => {
    const newDate = rescheduleDate[appointment.id];
    const newTime = rescheduleTime[appointment.id];

    console.log("🔄 Iniciando reagendamento...");
    console.log("📅 newDate:", newDate);
    console.log("⏰ newTime:", newTime);
    console.log("📋 appointment.id:", appointment.id);
    console.log("👤 therapist_user_id:", appointment.therapist_user_id);
    console.log("📅 starts_at original:", appointment.starts_at);
    console.log("📅 ends_at original:", appointment.ends_at);

    if (!newDate || !newTime) {
      setError("Preencha data e hora para reagendar");
      return;
    }

    setActionLoading(prev => ({ ...prev, [appointment.id]: true }));
    setError("");
    setSuccess("");

    try {
      const dateTimeStr = `${newDate}T${newTime}:00`;
      const startsAt = new Date(dateTimeStr);
      
      // 🔥 VALIDAR SE A DATA É VÁLIDA
      if (isNaN(startsAt.getTime())) {
        throw new Error(`Data inválida: ${dateTimeStr}`);
      }
      
      const originalDuration = Math.round(
        (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000
      );
      const endsAt = new Date(startsAt.getTime() + originalDuration * 60000);

      console.log(`📡 Reagendando appointment ${appointment.id}...`);
      console.log(`📅 Nova data (ISO): ${startsAt.toISOString()}`);
      console.log(`📅 Novo fim (ISO): ${endsAt.toISOString()}`);
      console.log(`⏱️ Duração: ${originalDuration} minutos`);
      console.log(`👤 Terapeuta ID: ${appointment.therapist_user_id}`);
      
      const data = await api(`/api/appointments/${appointment.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({
          therapist_user_id: appointment.therapist_user_id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: originalDuration
        })
      });

      console.log("✅ Reagendamento realizado com sucesso!", data);
      setSuccess("Sessão reagendada com sucesso!");
      setShowReschedule({});
      setRescheduleDate({});
      setRescheduleTime({});
      if (onSuccess) onSuccess();
      
    } catch (err: any) {
      console.error("❌ Erro no reagendamento:", err);
      setError(err.message || "Erro ao reagendar");
    } finally {
      setActionLoading(prev => ({ ...prev, [appointment.id]: false }));
    }
  }, [rescheduleDate, rescheduleTime]);

  const toggleReschedule = (id: number) => {
    setShowReschedule(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return {
    actionLoading,
    showReschedule,
    rescheduleDate,
    rescheduleTime,
    setRescheduleDate,
    setRescheduleTime,
    cancelAppointment,
    rescheduleAppointment,
    toggleReschedule,
    error,
    success,
    setError,
    setSuccess
  };
}