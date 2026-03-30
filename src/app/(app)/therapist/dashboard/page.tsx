"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";

type Appointment = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  patient?: { 
    id: number;
    email: string; 
    full_name?: string;
  };
  session_price?: number;
};

type Stats = {
  today: number;
  week: number;
  total: number;
  revenue: number;
  confirmed: number;
  cancelled: number;
};

export default function TherapistDashboardPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({
    today: 0,
    week: 0,
    total: 0,
    revenue: 0,
    confirmed: 0,
    cancelled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api("/api/appointments");
        
        const therapistAppointments = data.filter(
          (apt: Appointment) => apt.therapist_user_id === user?.id
        );
        
        setAppointments(therapistAppointments);
        
        // Criar eventos para o calendário
        const events = therapistAppointments
          .filter((apt: Appointment) => ["scheduled", "confirmed"].includes(apt.status))
          .map((apt: Appointment) => ({
            id: apt.id,
            title: apt.patient?.full_name || `Paciente ${apt.patient_user_id}`,
            start: apt.starts_at,
            end: apt.ends_at,
            backgroundColor: "#10b981",
            borderColor: "#059669",
            textColor: "white",
            extendedProps: {
              patient: apt.patient,
              status: apt.status,
              price: apt.session_price
            }
          }));
        setCalendarEvents(events);
        
        const now = new Date();
        const todayStr = now.toDateString();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const todayCount = therapistAppointments.filter((apt: Appointment) => 
          new Date(apt.starts_at).toDateString() === todayStr
        ).length;
        
        const weekCount = therapistAppointments.filter((apt: Appointment) => {
          const aptDate = new Date(apt.starts_at);
          return aptDate >= now && aptDate <= weekLater;
        }).length;
        
        const confirmedCount = therapistAppointments.filter(
          (apt: Appointment) => apt.status === "confirmed"
        ).length;
        
        const cancelledCount = therapistAppointments.filter(
          (apt: Appointment) => apt.status.includes("cancelled")
        ).length;
        
        const revenue = therapistAppointments
          .filter((apt: Appointment) => ["scheduled", "confirmed"].includes(apt.status))
          .reduce((sum, apt) => sum + (apt.session_price || 150), 0);
        
        setStats({
          today: todayCount,
          week: weekCount,
          total: therapistAppointments.length,
          revenue,
          confirmed: confirmedCount,
          cancelled: cancelledCount,
        });
        
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setError("Erro ao carregar dados");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };

  if (loading) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Olá, {user?.full_name || user?.email}!</h1>
        <p className="text-gray-600">Painel do Terapeuta</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded border border-green-200">
          {success}
        </div>
      )}

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Hoje</p>
          <p className="text-2xl font-bold text-blue-600">{stats.today}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Esta semana</p>
          <p className="text-2xl font-bold text-green-600">{stats.week}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Confirmadas</p>
          <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Canceladas</p>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">Receita</p>
          <p className="text-2xl font-bold text-purple-600">R$ {stats.revenue}</p>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/therapist/availability"
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">⚙️ Gerenciar Disponibilidade</h3>
          <p className="text-blue-100">Defina seus horários de atendimento</p>
        </Link>
        
        <Link
          href="/therapist/profile"
          className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">👤 Perfil Profissional</h3>
          <p className="text-purple-100">Edite bio, preço e especialidades</p>
        </Link>
        
        <Link
          href="/calendar"
          className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">📅 Agendar para paciente</h3>
          <p className="text-green-100">Crie sessões para seus pacientes</p>
        </Link>
      </div>

      {/* Calendário de sessões */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📆 Minha Agenda</h2>
        <div className="h-[500px]">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            locale={ptBrLocale}
            initialView="timeGridWeek"
            height="100%"
            events={calendarEvents}
            slotMinTime="06:00:00"
            slotMaxTime="23:00:00"
            allDaySlot={false}
            eventContent={(eventInfo) => {
              return {
                html: `<div class="p-1 text-xs bg-green-500 text-white rounded truncate">${eventInfo.event.title}</div>`
              };
            }}
            eventClick={(info) => {
              alert(`Sessão com ${info.event.title}\n${new Date(info.event.start!).toLocaleString("pt-BR")}`);
            }}
          />
        </div>
      </div>

      {/* Próximas sessões */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📋 Próximas sessões</h2>
        {appointments.length === 0 ? (
          <p className="text-gray-500">Nenhuma sessão agendada.</p>
        ) : (
          <div className="space-y-3">
            {appointments
              .filter((apt) => new Date(apt.starts_at) > new Date())
              .slice(0, 5)
              .map((apt) => (
                <div key={apt.id} className="border rounded-lg p-4">
                  <p className="font-medium">{formatDate(apt.starts_at)}</p>
                  <p className="text-sm text-gray-600">
                    Paciente: {apt.patient?.full_name || apt.patient?.email || `ID ${apt.patient_user_id}`}
                  </p>
                  <p className="text-sm">
                    Status: <span className="capitalize">{apt.status}</span>
                  </p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}