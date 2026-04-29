"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useApi } from "@/lib/useApi";
import { CalendarPatient } from "@/components/calendar/CalendarPatient";
import { Calendar, Loader2 } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

type Appointment = {
  id: number;
  therapist_user_id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  video_call_url?: string;
  therapist?: {
    id: number;
    email: string;
    full_name?: string;
    foto_url?: string;
  };
};

export default function PatientSchedulePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { openQueixa } = useSidebar();
  const { execute: apiCall } = useApi();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  useEffect(() => {
    loadAppointments();
  }, [user]);

  const loadAppointments = async () => {
    if (!user?.id) return;
    
    try {
      const data = await apiCall({
        url: "/api/appointments/me/details",
        requireAuth: true
      });
      
      const patientAppointments = data.filter(
        (apt: Appointment) => apt.patient_user_id === user.id
      );
      setAppointments(patientAppointments);

      const events = patientAppointments
        .filter((apt: Appointment) => ["scheduled", "confirmed", "proposed", "completed", "rescheduled"].includes(apt.status))
        .map((apt: Appointment) => {
          let bgColor = "#3b82f6";
          if (apt.status === "proposed") bgColor = "#eab308";
          if (apt.status === "confirmed") bgColor = "#22c55e";
          if (apt.status === "scheduled") bgColor = "#3b82f6";
          if (apt.status === "completed") bgColor = "#9ca3af";
          if (apt.status === "rescheduled") bgColor = "#F59E0B";
          if (apt.status?.includes("cancelled")) bgColor = "#ef4444";
          
          return {
            id: apt.id,
            title: apt.therapist?.full_name || `Terapeuta ${apt.therapist_user_id}`,
            start: apt.starts_at,
            end: apt.ends_at,
            backgroundColor: bgColor,
            borderColor: "#2563eb",
            textColor: "white",
            extendedProps: {
              therapist: apt.therapist,
              status: apt.status,
              price: apt.session_price,
              videoCallUrl: apt.video_call_url,
              appointment: apt
            }
          };
        });
      setCalendarEvents(events);
    } catch (error) {
      console.error("Erro ao carregar agenda:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await apiCall({
        url: `/api/appointments/${id}/status`,
        method: "PATCH",
        body: { status: "cancelled_by_patient" },
        requireAuth: true
      });
      loadAppointments();
    } catch (error) {
      console.error("Erro ao cancelar:", error);
    }
  };

  // 🔥 ALTERADO: Redireciona para página embed do Jitsi
  const handleStartSession = (appointment: Appointment) => {
    // 1. Redireciona para página embed (não abre nova aba)
    if (appointment?.id) {
      router.push(`/patient/videochamada/${appointment.id}`);
    }
    
    // 2. Abrir sidebar com formulário de queixa
    if (appointment?.id) {
      openQueixa(appointment.id);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#E03673]" />
          <h2 className="text-lg font-semibold text-gray-900">Minha Agenda</h2>
        </div>
        <div className="h-auto">
          <CalendarPatient
            events={calendarEvents}
            onEventClick={() => {}}
            onSlotClick={() => {}}
            onCancel={handleCancel}
            onJoinMeet={handleStartSession}
          />
        </div>
      </div>
    </div>
  );
}