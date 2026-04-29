"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import { useMobileNav } from "@/hooks/useMobileNav";
import { Calendar, Home, Loader2 } from "lucide-react";
import { SessionsList } from "../../dashboard/components/SessionsList";
import type { Appointment, Patient } from "../../dashboard/types";

const timeOptions = Array.from({ length: 24 }, (_, i) => i).flatMap(hour => [
  <option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>
    {`${hour.toString().padStart(2, '0')}:00`}
  </option>,
  <option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>
    {`${hour.toString().padStart(2, '0')}:30`}
  </option>
]);

export default function TherapistUpcomingSessionsPage() {
  const { user } = useAuth();
  const { openProntuario } = useSidebar();
  const router = useRouter();
  const { navigateToVideochamada } = useMobileNav();
  const { execute: apiCall } = useApi();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [frequentPatients, setFrequentPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReschedule, setShowReschedule] = useState<Record<number, boolean>>({});
  const [rescheduleDate, setRescheduleDate] = useState<Record<number, string>>({});
  const [rescheduleTime, setRescheduleTime] = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const handleStartSession = useCallback(async (appointment: Appointment) => {
    if (appointment?.id) {
      navigateToVideochamada(appointment.id);
    }
  }, [navigateToVideochamada]);
  
  const handleOpenProntuario = useCallback((appointmentId: number) => {
    openProntuario(appointmentId);
  }, [openProntuario]);
  
  const handleCancel = async (id: number) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiCall({
        url: `/api/appointments/${id}/status`,
        method: "PATCH",
        body: { status: "cancelled_by_therapist" },
        requireAuth: true
      });
      setSuccess("Sessão cancelada com sucesso!");
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };
  
  const handleReschedule = async (appointment: Appointment) => {
    const newDate = rescheduleDate[appointment.id];
    const newTime = rescheduleTime[appointment.id];
    if (!newDate || !newTime) {
      setError("Preencha data e hora para reagendar");
      return;
    }
    setActionLoading(prev => ({ ...prev, [appointment.id]: true }));
    try {
      const dateTimeStr = `${newDate}T${newTime}:00`;
      const startsAt = new Date(dateTimeStr);
      const originalDuration = Math.round(
        (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000
      );
      const endsAt = new Date(startsAt.getTime() + originalDuration * 60000);
      await apiCall({
        url: `/api/appointments/${appointment.id}/reschedule`,
        method: "POST",
        body: JSON.stringify({
          therapist_user_id: appointment.therapist_user_id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: originalDuration
        }),
        requireAuth: true
      });
      setSuccess("Sessão reagendada com sucesso!");
      setShowReschedule({});
      setRescheduleDate({});
      setRescheduleTime({});
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointment.id]: false }));
    }
  };
  
  const toggleReschedule = (id: number) =>
    setShowReschedule(prev => ({ ...prev, [id]: !prev[id] }));
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };
  
  const getStatusColor = (status: string) => {
    if (status === "scheduled") return "bg-green-100 text-green-800";
    if (status === "confirmed") return "bg-blue-100 text-blue-800";
    if (status === "proposed") return "bg-yellow-100 text-yellow-800";
    if (status.includes("cancelled")) return "bg-red-100 text-red-800";
    if (status === "completed") return "bg-gray-100 text-gray-800";
    if (status === "rescheduled") return "bg-orange-100 text-orange-800";
    return "bg-gray-100 text-gray-800";
  };
  
  const getStatusText = (status: string) => {
    if (status === "scheduled") return "Agendada";
    if (status === "confirmed") return "Confirmada";
    if (status === "proposed") return "Convite pendente";
    if (status === "cancelled_by_patient") return "Cancelada (paciente)";
    if (status === "cancelled_by_therapist") return "Cancelada (terapeuta)";
    if (status === "cancelled_by_admin") return "Cancelada (admin)";
    if (status === "completed") return "Realizada";
    if (status === "rescheduled") return "Reagendada";
    return status;
  };
  
  const setSuccess = (msg: string) => {
    console.log("✅", msg);
    setTimeout(() => setError(""), 3000);
  };
  
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const appointmentsData = await apiCall({
        url: "/api/appointments/me/details",
        requireAuth: true
      });
      const therapistAppointments = appointmentsData.filter(
        (apt: Appointment) => apt.therapist_user_id === user.id
      );
      const futureAppointments = therapistAppointments.filter((apt: any) =>
        new Date(apt.starts_at) > new Date()
      );
      setAppointments(futureAppointments);
      const patientCount = new Map<number, { count: number; patient: Patient }>();
      futureAppointments.forEach((apt: Appointment) => {
        if (apt.patient && apt.patient_user_id) {
          const current = patientCount.get(apt.patient_user_id) || { count: 0, patient: apt.patient };
          current.count += 1;
          patientCount.set(apt.patient_user_id, current);
        }
      });
      const frequent = Array.from(patientCount.values())
        .sort((a: any, b: any) => b.count - a.count)
        .map((item: any) => item.patient)
        .slice(0, 5);
      setFrequentPatients(frequent);
    } catch (error) {
      setError("Erro ao carregar sessões");
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }
  
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/therapist/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Voltar ao Dashboard"
            >
              <Home className="w-5 h-5 text-[#E03673]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-6 h-6 text-[#E03673]" />
                <h1 className="text-2xl font-bold text-gray-900">Próximas Sessões</h1>
              </div>
              <p className="text-gray-600 mt-1">
                Acompanhe suas próximas sessões com os pacientes
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            {error}
          </div>
        )}
        
        <SessionsList
          appointments={appointments}
          sessionFilter="upcoming"
          frequentPatients={frequentPatients}
          showReschedule={showReschedule}
          actionLoading={actionLoading}
          timeOptions={timeOptions}
          onToggleReschedule={toggleReschedule}
          onCancel={handleCancel}
          onReschedule={handleReschedule}
          onRescheduleDateChange={(id, value) => setRescheduleDate(prev => ({ ...prev, [id]: value }))}
          onRescheduleTimeChange={(id, value) => setRescheduleTime(prev => ({ ...prev, [id]: value }))}
          onClearFilter={() => {}}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          onJoinMeet={handleStartSession}
          onRegisterProntuario={handleOpenProntuario}
        />
        
        {appointments.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma sessão futura agendada.</p>
            <p className="text-sm text-gray-400 mt-1">
              Agende sessões com seus pacientes ou aguarde convites.
            </p>
            <button
              onClick={() => router.push('/therapist/availability')}
              className="mt-4 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              Gerenciar disponibilidade
            </button>
          </div>
        )}
      </div>
    </>
  );
}