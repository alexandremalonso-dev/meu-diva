"use client";

import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getFotoSrc } from '@/lib/utils';
import Link from "next/link";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Wallet, 
  User, 
  Star,
  ArrowRight,
  X,
  Send,
  Loader2,
  Clock,
  XCircle,
  CheckCircle,
  BarChart2,
  Sparkles,
  Crown,
  TrendingUp,
  Zap,
  Flame,
  Rocket,
  Percent,
  FileText,
  Settings,
  Mail,
  RefreshCw,
  DollarSign
} from "lucide-react";

import type { Appointment, Patient } from './types';
import { useStats } from './hooks/useStats';
import { useFilters } from './hooks/useFilters';

import { StatsCards } from './components/StatsCards';
import { VisibilidadeAviso } from './components/VisibilidadeAviso';
import { InviteForm } from './components/QuickActions/InviteForm';
import { CalendarTherapist } from "@/components/calendar/CalendarTherapist";
import { SessionsList } from './components/SessionsList';

import { AutoFitText } from "@/components/shared/AutoFitText";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.meudivaonline.com";

const timeOptions = Array.from({ length: 24 }, (_, i) => i).flatMap(hour => [
  <option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>
    {`${hour.toString().padStart(2, '0')}:00`}
  </option>,
  <option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>
    {`${hour.toString().padStart(2, '0')}:30`}
  </option>
]);

const PLAN_FEATURES = {
  profissional: [
    "Até 50 pacientes ativos",
    "Relatórios financeiros",
    "Suporte especializado",
    "Comissão de apenas 10%"
  ],
  premium: [
    "Pacientes ilimitados",
    "Relatórios financeiros",
    "Suporte prioritário",
    "Comissão de apenas 3%"
  ]
};

const PLAN_COMMISSIONS = {
  basico: "20%",
  essencial: "20%",
  profissional: "10%",
  premium: "3%"
};

function QuickLinkPill({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  return (
    <Link
      href={href}
      className="h-14 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white text-center transition-all hover:shadow-md hover:scale-[1.02] px-1"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <AutoFitText className="text-fluid-2xs font-medium leading-tight">{label}</AutoFitText>
    </Link>
  );
}

function ColumnLabel({ label, icon: Icon, gradient }: { label: string; icon: React.ElementType; gradient: string }) {
  return (
    <div className={`h-14 flex flex-col items-center justify-center gap-0.5 rounded-lg bg-gradient-to-br ${gradient} text-white text-center px-1`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <AutoFitText className="text-fluid-2xs font-medium leading-tight">{label}</AutoFitText>
    </div>
  );
}

function MiniActionCard({
  href, onClick, icon: Icon, label, subtitle, gradient = "from-[#2F80D3] to-[#2F80D3]/80",
}: {
  href?: string; onClick?: () => void; icon: React.ElementType; label: string; subtitle: string; gradient?: string;
}) {
  const content = (
    <div className={`flex-1 min-h-[3.25rem] flex flex-col justify-center bg-gradient-to-br ${gradient} text-white rounded-lg shadow-sm px-3 py-1.5 transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <AutoFitText className="text-fluid-xs font-semibold leading-tight">{label}</AutoFitText>
      </div>
      <AutoFitText className="text-fluid-2xs text-white/75 mt-0.5">{subtitle}</AutoFitText>
    </div>
  );
  if (href) return <Link href={href} className="contents">{content}</Link>;
  return <div onClick={onClick} className="contents">{content}</div>;
}

// 🔥 Card de ação rotativo — alterna entre 2 ações relacionadas
function RotatingActionCard({
  views, gradient = "from-[#2F80D3] to-[#2F80D3]/80",
}: {
  views: { icon: React.ElementType; label: string; subtitle: string; href?: string; onClick?: () => void }[];
  gradient?: string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (views.length <= 1) return;
    const timer = setInterval(() => setIndex((p) => (p + 1) % views.length), 4000);
    return () => clearInterval(timer);
  }, [views.length]);

  const current = views[index];
  const Icon = current.icon;
  const inner = (
    <div className={`flex-1 min-h-[3.25rem] flex flex-col justify-center bg-gradient-to-br ${gradient} text-white rounded-lg shadow-sm px-3 py-1.5 transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer relative`}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <AutoFitText className="text-fluid-xs font-semibold leading-tight">{current.label}</AutoFitText>
      </div>
      <AutoFitText className="text-fluid-2xs text-white/75 mt-0.5">{current.subtitle}</AutoFitText>
      {views.length > 1 && (
        <div className="flex gap-1 absolute bottom-1 right-2">
          {views.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i === index ? "w-3 bg-white" : "w-1 bg-white/40"}`} />
          ))}
        </div>
      )}
    </div>
  );
  if (current.href) return <Link href={current.href} className="contents">{inner}</Link>;
  return <div onClick={current.onClick} className="contents">{inner}</div>;
}

export default function TherapistDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();


  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [frequentPatients, setFrequentPatients] = useState<Patient[]>([]);
  const [totalAvailability, setTotalAvailability] = useState(0);
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [treatment, setTreatment] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentMonthRevenue, setCurrentMonthRevenue] = useState(0);
  const [currentMonthSessions, setCurrentMonthSessions] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<string>("basico");
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);

  const [quickPatient, setQuickPatient] = useState<string>("");
  const [quickDate, setQuickDate] = useState("");
  const [quickTime, setQuickTime] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [inviteDuration, setInviteDuration] = useState<number>(50);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showReschedule, setShowReschedule] = useState<Record<number, boolean>>({});
  const [rescheduleDate, setRescheduleDate] = useState<Record<number, string>>({});
  const [rescheduleTime, setRescheduleTime] = useState<Record<number, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSessionsModal, setShowSessionsModal] = useState(false);

  const dataLoadedRef = useRef(false);

  const stats = useStats(appointments, totalAvailability);
  const {
    filteredAppointments,
    selectedPeriod,
    sessionFilter,
    applySessionFilter,
    filterByPeriod,
    setFilteredAppointments,
    setSelectedPeriod,
    setSessionFilter
  } = useFilters(appointments);

  const loadTherapistProfile = useCallback(async () => {
    try {
      const profile = await apiCall({ url: "/api/therapists/me/profile", requireAuth: true });
      setTherapistProfileId(profile.id);
      setTreatment(profile.treatment || null);
    } catch (error) {
      console.error("Erro ao carregar perfil do terapeuta:", error);
    }
  }, [apiCall]);

  const loadCurrentPlan = useCallback(async () => {
    try {
      const data = await apiCall({ url: "/api/plans/current", requireAuth: true });
      setCurrentPlan(data.current_plan);
    } catch (error) {
      console.error("Erro ao carregar plano atual:", error);
    }
  }, [apiCall]);

  const handleUpgradeProfissional = () => {
    router.push('/subscription-checkout?plan=profissional');
  };

  const handleUpgradePremium = () => {
    router.push('/subscription-checkout?plan=premium');
  };

  const loadChartData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const appointmentsData = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      const therapistAppointments = appointmentsData.filter((apt: any) => apt.therapist_user_id === user.id);
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        revenue: 0,
        sessions: 0
      }));
      
      let totalRevenue = 0;
      let totalSessions = 0;
      
      therapistAppointments.forEach((apt: any) => {
        if (apt.status === "completed" && apt.session_price) {
          const aptDate = new Date(apt.starts_at);
          if (aptDate.getFullYear() === currentYear && aptDate.getMonth() === currentMonth) {
            const dayIndex = aptDate.getDate() - 1;
            if (dayIndex >= 0 && dayIndex < daysInMonth) {
              dailyData[dayIndex].revenue += apt.session_price;
              dailyData[dayIndex].sessions += 1;
              totalRevenue += apt.session_price;
              totalSessions += 1;
            }
          }
        }
      });
      
      setChartData(dailyData);
      setCurrentMonthRevenue(totalRevenue);
      setCurrentMonthSessions(totalSessions);
    } catch (error) { 
      console.error("Erro ao carregar dados do gráfico:", error); 
    }
  }, [user?.id, apiCall]);

  const buildCalendarEvents = useCallback((therapistAppointments: Appointment[], personalEventsData: any[]) => {
    const appointmentEvents = therapistAppointments
      .filter((apt: Appointment) => ["scheduled", "confirmed", "proposed", "completed"].includes(apt.status))
      .map((apt) => {
        let bgColor = "#3b82f6";
        if (apt.status === "proposed") bgColor = "#eab308";
        if (apt.status === "confirmed") bgColor = "#22c55e";
        if (apt.status === "scheduled") bgColor = "#3b82f6";
        if (apt.status === "completed") bgColor = "#9ca3af";
        if (apt.status?.includes("cancelled")) bgColor = "#ef4444";
        return {
          id: apt.id,
          title: apt.patient?.full_name || apt.patient?.email || `Paciente ${apt.patient_user_id}`,
          start: apt.starts_at, end: apt.ends_at,
          backgroundColor: bgColor, borderColor: "#059669", textColor: "white",
          extendedProps: { patient: apt.patient, status: apt.status, price: apt.session_price, videoCallUrl: apt.video_call_url, appointment: apt }
        };
      });
    const personalEvents = (personalEventsData || []).map((event: any) => {
      let bgColor = "#9ca3af"; let title = event.title || "Evento";
      if (event.type === "reminder") { title = `🔔 ${event.title || "Lembrete"}`; }
      else if (event.type === "task") { title = `✅ ${event.title || "Tarefa"}`; }
      else if (event.type === "invite") { title = `📩 Convite para paciente`; bgColor = "#F59E0B"; }
      else if (event.type === "personal") { title = `📋 ${event.title || "Compromisso"}`; }
      return {
        id: `personal-${event.id}`, title, start: event.starts_at, end: event.ends_at,
        backgroundColor: bgColor, borderColor: bgColor, textColor: "white",
        extendedProps: { isPersonalEvent: true, type: event.type, personalEventId: event.id, title: event.title, patient: event.patient_user_id ? { id: event.patient_user_id } : null }
      };
    });
    return [...appointmentEvents, ...personalEvents];
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    if (dataLoadedRef.current) return;
    try {
      const appointmentsData = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      let totalSlots = 0;
      try {
        const periods = await apiCall({ url: "/api/therapist/availability/periods", requireAuth: true });
        periods.forEach((period: any) => { totalSlots += period.slots?.length || 0; });
      } catch (e) { totalSlots = 0; }
      setTotalAvailability(totalSlots);
      const therapistAppointments = appointmentsData.filter((apt: Appointment) => apt.therapist_user_id === user.id);
      setAppointments(therapistAppointments);
      applySessionFilter("all", therapistAppointments);
      
      const patientMap = new Map<number, Patient>();
      
      therapistAppointments.forEach((apt) => {
        if (!apt.patient) return;
        
        const patientId = apt.patient_user_id;
        const existing = patientMap.get(patientId);
        
        if (existing) {
          existing.session_count++;
          const aptDate = new Date(apt.starts_at);
          if (!existing.last_session || aptDate > existing.last_session) {
            existing.last_session = aptDate;
          }
        } else {
          patientMap.set(patientId, {
            id: patientId,
            user_id: patientId,
            full_name: apt.patient.full_name || apt.patient.email,
            email: apt.patient.email,
            phone: apt.patient.phone || "",
            session_count: 1,
            last_session: new Date(apt.starts_at),
            is_frequent: false,
            is_blocked: false,
            foto_url: apt.patient.foto_url
          });
        }
      });
      
      const patientsList = Array.from(patientMap.values());
      patientsList.forEach(p => p.is_frequent = p.session_count >= 3);
      patientsList.sort((a, b) => b.session_count - a.session_count);
      // 🔒 A lista vem do servidor: só quem agendou sozinho, pagou e realizou sessão (2 ou mais, última em 60 dias)
      apiCall({ url: "/api/invites/eligible-patients", requireAuth: true })
        .then((fp: any) => setFrequentPatients((Array.isArray(fp) ? fp.map((p: any) => ({ ...p, last_session: p.last_session ? new Date(p.last_session) : undefined })) : []) as any))
        .catch(() => setFrequentPatients([]));
      
      let personalEventsData: any[] = [];
      try { personalEventsData = await apiCall({ url: "/api/personal-events", requireAuth: true }); } catch (error) {}
      setCalendarEvents(buildCalendarEvents(therapistAppointments, personalEventsData));
      dataLoadedRef.current = true;
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
      setError("Erro ao carregar dados");
    } finally { setLoading(false); }
  }, [user, applySessionFilter, apiCall, buildCalendarEvents]);

  useEffect(() => { loadChartData(); }, [loadChartData]);
  useEffect(() => { loadCurrentPlan(); }, [loadCurrentPlan]);
  useEffect(() => { if (!user?.id) return; loadTherapistProfile(); loadData(); }, [user?.id, loadData, loadTherapistProfile]);

  useEffect(() => {
    const handleAppointmentUpdated = () => { dataLoadedRef.current = false; loadData(); loadChartData(); };
    window.addEventListener("appointmentUpdated", handleAppointmentUpdated);
    window.addEventListener("appointmentRescheduled", handleAppointmentUpdated);
    window.addEventListener("prontuarioSaved", handleAppointmentUpdated);
    return () => {
      window.removeEventListener("appointmentUpdated", handleAppointmentUpdated);
      window.removeEventListener("appointmentRescheduled", handleAppointmentUpdated);
      window.removeEventListener("prontuarioSaved", handleAppointmentUpdated);
    };
  }, [loadData, loadChartData]);

  const handleSlotClick = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = date.getMinutes() === 0 ? "00" : "30";
    setQuickDate(`${year}-${month}-${day}`); setQuickTime(`${hours}:${minutes}`); setShowInviteForm(true);
    setSuccess(`Slot selecionado: ${day}/${month}/${year} às ${hours}:${minutes}`);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleJoinMeet = useCallback((appointment: Appointment) => {
    if (appointment?.video_call_url) window.open(appointment.video_call_url, '_blank');
  }, []);

  const handleCancel = async (id: number) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await apiCall({ url: `/api/appointments/${id}/status`, method: "PATCH", body: { status: "cancelled_by_therapist" }, requireAuth: true });
      setSuccess("Sessão cancelada com sucesso!"); setSelectedAppointment(null); dataLoadedRef.current = false; loadData(); loadChartData();
    } catch (err: any) { setError(err.message); } finally { setActionLoading(prev => ({ ...prev, [id]: false })); }
  };
  const handleReschedule = async (appointment: Appointment) => {
    const newDate = rescheduleDate[appointment.id]; const newTime = rescheduleTime[appointment.id];
    if (!newDate || !newTime) { setError("Preencha data e hora para reagendar"); return; }
    setActionLoading(prev => ({ ...prev, [appointment.id]: true }));
    try {
      const startsAt = new Date(`${newDate}T${newTime}:00`);
      const originalDuration = Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000);
      const endsAt = new Date(startsAt.getTime() + originalDuration * 60000);
      await apiCall({ url: `/api/appointments/${appointment.id}/reschedule`, method: "POST", body: { therapist_user_id: appointment.therapist_user_id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: originalDuration }, requireAuth: true });
      setSuccess("Sessão reagendada com sucesso!"); setShowReschedule({}); setRescheduleDate({}); setRescheduleTime({}); dataLoadedRef.current = false; loadData(); loadChartData();
    } catch (err: any) { setError(err.message); } finally { setActionLoading(prev => ({ ...prev, [appointment.id]: false })); }
  };
  const handleSendInvite = async () => {
    if (!quickDate || !quickTime) { setError("Selecione data e hora para o convite"); return; }
    if (!quickPatient) { setError("Selecione um paciente"); return; }
    setQuickLoading(true);
    try {
      const startsAt = new Date(`${quickDate}T${quickTime}:00`);
      await apiCall({ url: "/api/invites", method: "POST", body: { patient_user_id: Number(quickPatient), therapist_user_id: user?.id, starts_at: startsAt.toISOString(), duration_minutes: inviteDuration }, requireAuth: true });
      setSuccess("Convite enviado com sucesso!"); setShowInviteForm(false);
      setQuickPatient(""); setQuickDate(""); setQuickTime(""); setInviteDuration(50);
      dataLoadedRef.current = false; loadData(); loadChartData();
    } catch (err: any) { setError(err.message); } finally { setQuickLoading(false); }
  };
  const toggleReschedule = (id: number) => setShowReschedule(prev => ({ ...prev, [id]: !prev[id] }));
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR") + " às " + new Date(dateStr).toLocaleTimeString("pt-BR").slice(0, 5);
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

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-1">
        <h1 className="text-fluid-xl font-bold text-gray-900">Olá, {treatment ? `${treatment} ` : ""}{user?.full_name || user?.email}!</h1>
        <p className="text-fluid-xs text-gray-600">Seu espaço de cuidado, escuta e saúde mental.</p>
      </div>

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pb-3">
        {error && <div className="mb-2 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}
        {success && <div className="mb-2 p-3 bg-green-50 text-green-700 rounded border border-green-200">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-3 lg:h-[calc(100vh-9rem)]">

          <div className="min-h-0 lg:col-start-1">
            <CalendarTherapist
              events={calendarEvents}
              onEventClick={(apt) => setSelectedAppointment(apt)}
              onSlotClick={handleSlotClick}
              onCancel={handleCancel}
              onJoinMeet={handleJoinMeet}
            />
          </div>

          <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 min-h-0 flex flex-col lg:grid lg:grid-rows-[3.5rem_minmax(0,1fr)] gap-2 lg:col-start-2 lg:-mt-16">

            <div className="grid grid-cols-2 gap-2 flex-shrink-0">
              <ColumnLabel label="Sessões" icon={TrendingUp} gradient="from-[#E03673] to-[#E03673]/80" />
              <ColumnLabel label="Ações" icon={Zap} gradient="from-[#2F80D3] to-[#2F80D3]/80" />
            </div>

            <div className="grid grid-cols-2 gap-2 min-h-0 flex-1">
              <div className="min-h-0 overflow-y-auto overflow-x-hidden pb-1">
                <StatsCards
                  stats={stats}
                  activeFilter={sessionFilter}
                  currentMonthRevenue={currentMonthRevenue}
                  currentMonthSessions={currentMonthSessions}
                  onRevenueClick={() => router.push('/therapist/financial-report')}
                  onFilterClick={(filter) => {
                    if (filter === "upcoming") { setFilteredAppointments(appointments.filter((apt: Appointment) => new Date(apt.starts_at) > new Date() && ["scheduled", "confirmed"].includes(apt.status))); setSessionFilter("upcoming"); setSelectedPeriod("all"); }
                    else if (filter === "completed") { setFilteredAppointments(appointments.filter((apt: Appointment) => apt.status === "completed")); setSessionFilter("completed"); setSelectedPeriod("all"); }
                    else if (filter === "cancelled") { setFilteredAppointments(appointments.filter((apt: Appointment) => apt.status?.includes("cancelled"))); setSessionFilter("cancelled"); setSelectedPeriod("all"); }
                    else if (filter === "availability") { router.push('/therapist/availability'); return; }
                    else { setFilteredAppointments(appointments); setSessionFilter("all"); setSelectedPeriod("all"); }
                    setShowSessionsModal(true);
                  }}
                  onPeriodChange={(period, type) => { filterByPeriod(period, type); setShowSessionsModal(true); }}
                />
              </div>

              <div className="min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-1.5 h-full pb-1">
                <MiniActionCard
                  onClick={() => router.push('/therapist/availability')}
                  icon={Settings} label="Disponibilidade" subtitle="Defina seus horários"
                />
                <RotatingActionCard
                  views={[
                    { icon: Mail, label: "Enviar convite", subtitle: "Pacientes frequentes", onClick: () => setShowInviteForm(!showInviteForm) },
                    { icon: Send, label: "Convites enviados", subtitle: "Gerenciar convites", href: "/therapist/invites" },
                  ]}
                />
                <MiniActionCard
                  href="/therapist/sessions/completed"
                  icon={Calendar} label="Sessões Realizadas" subtitle="Histórico completo"
                />
                <MiniActionCard
                  href="/therapist/schedule"
                  icon={RefreshCw} label="Reagendar" subtitle="Sessão para Reposição"
                />
                <MiniActionCard
                  href="/therapist/financial-report"
                  icon={DollarSign} label="Ganhos" subtitle="Relatório financeiro"
                />
              </div>
            </div>
          </div>

        </div>

        <InviteForm show={showInviteForm} patients={frequentPatients} quickPatient={quickPatient} quickDate={quickDate} quickTime={quickTime} quickLoading={quickLoading} duration={inviteDuration} onDurationChange={setInviteDuration} timeOptions={timeOptions} onPatientChange={setQuickPatient} onDateChange={setQuickDate} onTimeChange={setQuickTime} onSendInvite={handleSendInvite} />

        {showSessionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#E03673]" />
                  {sessionFilter === 'upcoming' && 'Próximas sessões'}
                  {sessionFilter === 'completed' && 'Sessões realizadas'}
                  {sessionFilter === 'cancelled' && 'Sessões canceladas'}
                  {sessionFilter === 'all' && 'Todas as sessões'}
                </h3>
                <button onClick={() => setShowSessionsModal(false)} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <SessionsList
                  appointments={filteredAppointments}
                  sessionFilter={sessionFilter}
                  frequentPatients={frequentPatients}
                  showReschedule={showReschedule}
                  actionLoading={actionLoading}
                  timeOptions={timeOptions}
                  onToggleReschedule={toggleReschedule}
                  onCancel={handleCancel}
                  onReschedule={handleReschedule}
                  onRescheduleDateChange={(id, value) => setRescheduleDate(prev => ({ ...prev, [id]: value }))}
                  onRescheduleTimeChange={(id, value) => setRescheduleTime(prev => ({ ...prev, [id]: value }))}
                  onClearFilter={() => { applySessionFilter("all"); setShowSessionsModal(false); }}
                  formatDate={formatDate}
                  getStatusColor={getStatusColor}
                  getStatusText={getStatusText}
                  onJoinMeet={handleJoinMeet}
                />
              </div>
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button onClick={() => setShowSessionsModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Fechar</button>
              </div>
            </div>
          </div>
        )}

        <VisibilidadeAviso />
      </div>
    </>
  );
}
