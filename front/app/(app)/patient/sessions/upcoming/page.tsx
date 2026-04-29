"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Calendar, 
  ArrowLeft,
  Loader2
} from "lucide-react";
import SessionsList from "../../dashboard/components/SessionsList";
import { ComplaintModal } from "@/components/Modals/ComplaintModal";
import { usePatientFilters } from "../../dashboard/hooks/usePatientFilters";
import { usePatientActions } from "../../dashboard/hooks/usePatientActions";
import { useMobileNav } from "@/hooks/useMobileNav";
import type { Appointment, Therapist } from "../../dashboard/types";

const timeOptions = Array.from({ length: 24 }, (_, i) => i).flatMap(hour => [
  <option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>
    {`${hour.toString().padStart(2, '0')}:00`}
  </option>,
  <option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>
    {`${hour.toString().padStart(2, '0')}:30`}
  </option>
]);

export default function PatientUpcomingSessionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { navigateToVideochamada } = useMobileNav();
  const { execute: apiCall } = useApi();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [frequentTherapists, setFrequentTherapists] = useState<Therapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  const {
    filteredAppointments,
    activeFilter,
    applyFilter,
    clearFilter
  } = usePatientFilters(appointments);
  
  const {
    actionLoading,
    showReschedule,
    rescheduleDate,
    rescheduleTime,
    setRescheduleDate,
    setRescheduleTime,
    cancelAppointment,
    rescheduleAppointment,
    toggleReschedule,
    setError: setActionError,
    setSuccess
  } = usePatientActions(user?.id);
  
  const handleJoinMeet = useCallback((appointment: Appointment) => {
    if (appointment?.id) {
      navigateToVideochamada(appointment.id);
    }
  }, [navigateToVideochamada]);
  
  const handleOpenComplaintModal = useCallback((appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowComplaintModal(true);
  }, []);
  
  const handleCancel = async (id: number) => {
    await cancelAppointment(id, () => {
      loadData();
      setSuccess("Sessão cancelada com sucesso!");
    });
  };
  
  const handleReschedule = async (apt: Appointment) => {
    const newDate = rescheduleDate[apt.id];
    const newTime = rescheduleTime[apt.id];
    if (!newDate || !newTime) {
      setActionError("Preencha data e hora para reagendar");
      return;
    }
    await rescheduleAppointment(apt, () => {
      loadData();
      setSuccess("Sessão reagendada com sucesso!");
    });
  };
  
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
    if (status === "cancelled_by_patient") return "Cancelada";
    if (status === "cancelled_by_therapist") return "Cancelada (terapeuta)";
    if (status === "cancelled_by_admin") return "Cancelada (admin)";
    if (status === "completed") return "Realizada";
    if (status === "rescheduled") return "Reagendada";
    return status;
  };
  
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const appointmentsData = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      const patientAppointments = appointmentsData.filter(
        (apt: Appointment) => apt.patient_user_id === user?.id
      );
      const futureAppointments = patientAppointments.filter((apt: Appointment) => 
        new Date(apt.starts_at) > new Date()
      );
      const sortedAppointments = [...futureAppointments].sort((a: any, b: any) => 
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
      setAppointments(sortedAppointments);
      const therapistCount = new Map<number, { count: number; therapist: Therapist }>();
      sortedAppointments.forEach((apt: Appointment) => {
        if (apt.therapist && apt.therapist_user_id) {
          const current = therapistCount.get(apt.therapist_user_id) || { count: 0, therapist: apt.therapist };
          current.count += 1;
          therapistCount.set(apt.therapist_user_id, current);
        }
      });
      const frequent = Array.from(therapistCount.values())
        .sort((a: any, b: any) => b.count - a.count)
        .map(item => item.therapist)
        .slice(0, 5);
      setFrequentTherapists(frequent);
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-6 h-6 text-[#E03673]" />
              <h1 className="text-2xl font-bold text-gray-900">Próximas Sessões</h1>
            </div>
            <p className="text-gray-600 mt-1">
              Acompanhe suas próximas sessões e acesse as videochamadas
            </p>
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
          activeFilter="upcoming"
          frequentTherapists={frequentTherapists}
          showReschedule={showReschedule}
          actionLoading={actionLoading}
          timeOptions={timeOptions}
          onToggleReschedule={toggleReschedule}
          onCancel={handleCancel}
          onReschedule={handleReschedule}
          onRescheduleDateChange={(id, value) => setRescheduleDate(prev => ({ ...prev, [id]: value }))}
          onRescheduleTimeChange={(id, value) => setRescheduleTime(prev => ({ ...prev, [id]: value }))}
          onClearFilter={clearFilter}
          formatDate={formatDate}
          getStatusColor={getStatusColor}
          getStatusText={getStatusText}
          onJoinMeet={handleJoinMeet}
          userRole="patient"
          onRegisterComplaint={handleOpenComplaintModal}
        />
        
        {appointments.length === 0 && !loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma sessão futura agendada.</p>
            <p className="text-sm text-gray-400 mt-1">
              Agende uma sessão na página de busca ou aguarde convites de terapeutas.
            </p>
            <button
              onClick={() => router.push('/busca')}
              className="mt-4 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              Buscar terapeutas
            </button>
          </div>
        )}
      </div>

      <ComplaintModal
        show={showComplaintModal}
        appointmentId={selectedAppointment?.id || 0}
        therapistName={selectedAppointment?.therapist?.full_name || "Terapeuta"}
        sessionDate={selectedAppointment ? formatDate(selectedAppointment.starts_at) : ""}
        onClose={() => {
          setShowComplaintModal(false);
          setSelectedAppointment(null);
        }}
        onSuccess={() => {
          setSuccess("Queixa registrada com sucesso!");
          setTimeout(() => setSuccess(""), 3000);
        }}
      />
    </>
  );
}