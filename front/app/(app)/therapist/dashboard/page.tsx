"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  CalendarPlus,
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
  FileText
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

import type { Appointment, Patient } from './types';
import { useStats } from './hooks/useStats';
import { useFilters } from './hooks/useFilters';

import { StatsCards } from './components/StatsCards';
import { QuickActions } from './components/QuickActions';
import { InviteForm } from './components/QuickActions/InviteForm';
import { InvitesCard } from './components/InvitesCard';
import { PendingReschedulesCard } from './components/cards/PendingReschedulesCard';
import { CalendarTherapist } from "@/components/calendar/CalendarTherapist";
import { SessionsList } from './components/SessionsList';

import { MenuCard } from './components/cards/MenuCard';
import { FrequentPatientCard } from './components/cards/FrequentPatientCard';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AvailableSlot = {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
};

const timeOptions = Array.from({ length: 24 }, (_, i) => i).flatMap(hour => [
  <option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>
    {`${hour.toString().padStart(2, '0')}:00`}
  </option>,
  <option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>
    {`${hour.toString().padStart(2, '0')}:30`}
  </option>
]);

// Features dos planos para exibição
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

// Comissões por plano
const PLAN_COMMISSIONS = {
  essencial: "20%",
  profissional: "10%",
  premium: "3%"
};

export default function TherapistDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [frequentPatients, setFrequentPatients] = useState<Patient[]>([]);
  const [totalAvailability, setTotalAvailability] = useState(0);
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentMonthRevenue, setCurrentMonthRevenue] = useState(0);
  const [currentMonthSessions, setCurrentMonthSessions] = useState(0);
  const [currentPlan, setCurrentPlan] = useState<string>("essencial");
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

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState("");
  const [selectedPatientFoto, setSelectedPatientFoto] = useState("");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [useCustomSlot, setUseCustomSlot] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingDuration, setBookingDuration] = useState(50);
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

  const handleUpgradeProfissional = async () => {
    setUpgradeLoading("profissional");
    try {
      const response = await apiCall({
        url: "/api/payments/create-subscription-checkout",
        method: "POST",
        body: { plan: "profissional" },
        requireAuth: true
      });
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
      setError("Erro ao processar upgrade");
    } finally {
      setUpgradeLoading(null);
    }
  };

  const handleUpgradePremium = async () => {
    setUpgradeLoading("premium");
    try {
      const response = await apiCall({
        url: "/api/payments/create-subscription-checkout",
        method: "POST",
        body: { plan: "premium" },
        requireAuth: true
      });
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
      setError("Erro ao processar upgrade");
    } finally {
      setUpgradeLoading(null);
    }
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
      let allPatients: Patient[] = [];
      try {
        const patientsData = await apiCall({ url: "/api/patients", requireAuth: true });
        if (Array.isArray(patientsData)) allPatients = patientsData;
      } catch (error) { console.error("❌ Erro ao carregar pacientes:", error); }
      const patientMap = new Map<number, Patient>();
      allPatients.forEach(p => {
        patientMap.set(p.id, { id: p.id, user_id: p.id, full_name: p.full_name || p.email, email: p.email, phone: p.phone, session_count: 0, is_frequent: false, is_blocked: false, foto_url: p.foto_url });
      });
      therapistAppointments.forEach((apt) => {
        if (!apt.patient) return;
        const existing = patientMap.get(apt.patient_user_id);
        if (existing) {
          existing.session_count++;
          existing.full_name = apt.patient.full_name || existing.full_name;
          existing.email = apt.patient.email || existing.email;
          if (apt.patient.foto_url) existing.foto_url = apt.patient.foto_url;
          const aptDate = new Date(apt.starts_at);
          if (!existing.last_session || aptDate > existing.last_session) existing.last_session = aptDate;
        } else {
          patientMap.set(apt.patient_user_id, { id: apt.patient_user_id, user_id: apt.patient_user_id, full_name: apt.patient.full_name, email: apt.patient.email, phone: apt.patient.phone, session_count: 1, last_session: new Date(apt.starts_at), is_frequent: false, is_blocked: false, foto_url: apt.patient.foto_url });
        }
      });
      const patientsList = Array.from(patientMap.values());
      patientsList.forEach(p => p.is_frequent = p.session_count >= 3);
      patientsList.sort((a, b) => b.session_count - a.session_count);
      setFrequentPatients(patientsList);
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('invite') === 'true') {
      const patientId = params.get('patient');
      if (patientId) {
        const patient = frequentPatients.find(p => p.id === Number(patientId));
        if (patient) { handleQuickBooking(patient.id, patient.full_name || patient.email, patient.foto_url); }
        else { setShowInviteForm(true); setQuickPatient(patientId); }
      } else { setShowInviteForm(true); }
    }
  }, [frequentPatients]);

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

  async function handleQuickBooking(patientId: number, patientName: string, patientFoto?: string) {
    setSelectedPatientId(patientId); setSelectedPatientName(patientName); setSelectedPatientFoto(patientFoto || "");
    setShowBookingModal(true); setSelectedSlot(null); setCustomDate(""); setCustomTime(""); setUseCustomSlot(false); setBookingDuration(50);
    if (!therapistProfileId) await loadTherapistProfile();
    setLoadingSlots(true);
    try {
      const data = await apiCall({ url: `/public/terapeutas/${therapistProfileId}/slots?days=30`, requireAuth: true });
      setAvailableSlots(data.slots || []);
    } catch (error) { setAvailableSlots([]); } finally { setLoadingSlots(false); }
  }

  async function handleSendInviteFromModal() {
    setBookingLoading(true); setError("");
    let startsAt: Date | null = null;
    if (useCustomSlot) {
      if (!customDate || !customTime) { setError("Por favor, preencha data e horário"); setBookingLoading(false); return; }
      startsAt = new Date(`${customDate}T${customTime}:00`);
    } else {
      if (!selectedSlot) { setError("Por favor, selecione um horário"); setBookingLoading(false); return; }
      startsAt = new Date(selectedSlot.starts_at);
    }
    const endsAt = new Date(startsAt); endsAt.setMinutes(endsAt.getMinutes() + bookingDuration);
    try {
      await apiCall({ url: "/api/invites", method: "POST", body: { patient_user_id: selectedPatientId, therapist_user_id: user?.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: bookingDuration }, requireAuth: true });
      setSuccess("Convite enviado com sucesso!"); setShowBookingModal(false); setShowInviteForm(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (error: any) { setError(error.message || "Erro ao enviar convite"); } finally { setBookingLoading(false); }
  }

  const formatDateTime = (dateStr: string) => new Date(dateStr).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  const handleBlockPatient = async (patientId: number) => {
    if (!confirm("Tem certeza que deseja bloquear este paciente?")) return;
    try {
      await apiCall({ url: `/api/therapist/patients/${patientId}/block`, method: "POST", requireAuth: true });
      setFrequentPatients(prev => prev.map(p => p.id === patientId ? { ...p, is_blocked: true } : p));
      setSuccess("Paciente bloqueado com sucesso!");
    } catch (err: any) { setError(err.message); }
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.full_name || user?.email}!</h1>
        <p className="text-sm text-gray-600 mt-1">Seu espaço de cuidado, escuta e saúde mental.</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <MenuCard href="/therapist/dashboard" icon="dashboard" title="Dashboard" description="Visão geral" color="blue" />
          <MenuCard href="/therapist/schedule" icon="calendar" title="Agenda" description="Gerenciar sessões" color="blue" />
          <MenuCard href="/therapist/patients" icon="users" title="Pacientes" description="Gerenciar pacientes" color="blue" />
          <MenuCard href="/therapist/wallet" icon="wallet" title="Carteira" description="Recebimentos" color="blue" />
          <MenuCard href="/therapist/profile" icon="profile" title="Perfil" description="Edite suas informações" color="blue" />
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded border border-green-200">{success}</div>}

        <StatsCards
          stats={stats}
          activeFilter={sessionFilter}
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

        <QuickActions onAvailabilityClick={() => router.push('/therapist/availability')} onInviteClick={() => setShowInviteForm(!showInviteForm)} showInviteForm={showInviteForm} />
        <InviteForm show={showInviteForm} patients={frequentPatients} quickPatient={quickPatient} quickDate={quickDate} quickTime={quickTime} quickLoading={quickLoading} duration={inviteDuration} onDurationChange={setInviteDuration} timeOptions={timeOptions} onPatientChange={setQuickPatient} onDateChange={setQuickDate} onTimeChange={setQuickTime} onSendInvite={handleSendInvite} />

        {/* Layout principal — agenda + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">

          {/* Coluna esquerda — agenda + upgrade cards */}
          <div className="lg:col-span-2 space-y-6">
            <CalendarTherapist
              events={calendarEvents}
              onEventClick={(apt) => setSelectedAppointment(apt)}
              onSlotClick={handleSlotClick}
              onCancel={handleCancel}
              onJoinMeet={handleJoinMeet}
            />

            {/* Upgrade Cards - abaixo da agenda (dentro da mesma coluna) */}
            {currentPlan !== "premium" && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Star className="w-5 h-5 text-[#E03673]" />
                    Potencialize sua prática
                  </h3>
                  <p className="text-sm text-gray-500">Planos com comissões reduzidas</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {currentPlan !== "profissional" && (
                    <div className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/90 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300 text-white">
                      <div className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-full bg-white/20">
                              <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Profissional</h3>
                          </div>
                          <div className="bg-[#F59E0B] text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            Recomendado
                          </div>
                        </div>
                        <p className="text-sm text-white/80 mb-4">Para quem quer consistência</p>
                        <div className="mb-4 flex items-baseline gap-2 flex-wrap">
                          <span className="text-3xl font-bold text-white">R$ 79</span>
                          <span className="text-white/70 text-sm">/mês</span>
                          <div className="ml-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-white/20 text-white">
                            <Percent className="w-3 h-3" />
                            Comissão: {PLAN_COMMISSIONS.profissional}
                          </div>
                        </div>
                        <ul className="space-y-2 mb-6">
                          {PLAN_FEATURES.profissional.map((feature, idx) => {
                            const isReportFeature = feature.toLowerCase().includes("relatório");
                            return (
                              <li key={idx} className="flex items-center gap-2 text-sm text-white/90">
                                {isReportFeature ? (
                                  <FileText className="w-4 h-4 text-[#F59E0B]" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 text-[#F59E0B]" />
                                )}
                                {feature}
                              </li>
                            );
                          })}
                        </ul>
                        <button
                          onClick={handleUpgradeProfissional}
                          disabled={upgradeLoading === "profissional"}
                          className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all bg-white text-[#2F80D3] hover:bg-gray-100 disabled:opacity-50"
                        >
                          {upgradeLoading === "profissional" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4" />
                              Upgrade Agora
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-gradient-to-br from-[#E03673] to-[#E03673]/90 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 duration-300 text-white">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-full bg-white/20">
                            <Crown className="w-6 h-6 text-white" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Premium</h3>
                        </div>
                        <div className="bg-[#F59E0B] text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          Mais Vantagens
                        </div>
                      </div>
                      <p className="text-sm text-white/80 mb-4">Para quem quer crescer de verdade</p>
                      <div className="mb-4 flex items-baseline gap-2 flex-wrap">
                        <span className="text-3xl font-bold text-white">R$ 149</span>
                        <span className="text-white/70 text-sm">/mês</span>
                        <div className="ml-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-white/20 text-white">
                          <Percent className="w-3 h-3" />
                          Comissão: {PLAN_COMMISSIONS.premium}
                        </div>
                      </div>
                      <ul className="space-y-2 mb-6">
                        {PLAN_FEATURES.premium.map((feature, idx) => {
                          const isReportFeature = feature.toLowerCase().includes("relatório");
                          return (
                            <li key={idx} className="flex items-center gap-2 text-sm text-white/90">
                              {isReportFeature ? (
                                <FileText className="w-4 h-4 text-[#F59E0B]" />
                              ) : (
                                <CheckCircle className="w-4 h-4 text-[#F59E0B]" />
                              )}
                              {feature}
                            </li>
                          );
                        })}
                      </ul>
                      <button
                        onClick={handleUpgradePremium}
                        disabled={upgradeLoading === "premium"}
                        className="w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all bg-white text-[#E03673] hover:bg-gray-100 disabled:opacity-50"
                      >
                        {upgradeLoading === "premium" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Rocket className="w-4 h-4" />
                            Upgrade Agora
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Coluna direita — card financeiro + convites */}
          <div className="lg:col-span-1 space-y-6">
            {/* Card Financeiro com gráfico do mês atual */}
            <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-lg p-5 text-white">
              <Link href="/therapist/financial-report" className="block">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <BarChart2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70">Receita Total</p>
                      <p className="text-xl font-bold text-white">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(currentMonthRevenue)}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/70" />
                </div>
              </Link>
              <div className="mt-2 pt-3 border-t border-white/20">
                <div className="flex items-center justify-between text-xs text-white/70 mb-3">
                  <span>Receita diária - {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                  <span>{currentMonthSessions} sessões</span>
                </div>
                {chartData.length === 0 || chartData.every(d => d.revenue === 0) ? (
                  <div className="h-24 flex items-center justify-center text-white/50 text-xs">Nenhum dado disponível</div>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.6)' }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} tickLine={false} interval={Math.floor(chartData.length / 10)} />
                      <YAxis tickFormatter={(value) => `R$ ${value}`} tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.6)' }} axisLine={{ stroke: 'rgba(255,255,255,0.2)' }} tickLine={false} width={40} />
                      <Tooltip formatter={(value: number) => [new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value), "Receita"]} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: 'white' }} />
                      <Line type="monotone" dataKey="revenue" stroke="white" strokeWidth={2} dot={{ fill: 'white', r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <Link href="/therapist/financial-report" className="block mt-3 pt-2 border-t border-white/20 flex justify-between text-xs text-white/70 hover:text-white transition-colors">
                  <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Ver relatório completo</span><span>→</span>
                </Link>
              </div>
            </div>

            <InvitesCard />
            <PendingReschedulesCard />
          </div>
        </div>

        {/* Pacientes Frequentes */}
        {frequentPatients.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white rounded-xl shadow-lg p-5">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Star className="w-4 h-4 text-white fill-white" />
              Pacientes Frequentes
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {frequentPatients.slice(0, 5).map((patient) => (
                <FrequentPatientCard
                  key={patient.id}
                  patient={patient}
                  onClick={(id) => handleQuickBooking(id, patient.full_name || patient.email, patient.foto_url)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de agendamento */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
              <div className="flex items-center gap-3"><CalendarPlus className="w-5 h-5" /><h3 className="text-lg font-semibold">Agendar nova sessão</h3></div>
              <button onClick={() => setShowBookingModal(false)} className="p-1.5 text-white hover:text-gray-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center">
                  {selectedPatientFoto ? <img src={getFotoSrc(selectedPatientFoto) ?? ""} alt={selectedPatientName} className="h-full w-full object-cover" /> : <User className="w-6 h-6 text-white" />}
                </div>
                <div><p className="text-sm text-gray-500">Paciente</p><p className="font-medium text-gray-900">{selectedPatientName}</p></div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Duração da sessão</label>
                <div className="flex gap-3">
                  {[30, 50].map(d => (
                    <button key={d} onClick={() => setBookingDuration(d)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bookingDuration === d ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>{d} minutos</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 mb-3">
                  <input type="radio" checked={!useCustomSlot} onChange={() => setUseCustomSlot(false)} className="h-4 w-4 text-[#E03673]" />
                  <span className="text-sm font-medium text-gray-700">Usar horários sugeridos (próximas semanas)</span>
                </label>
                {!useCustomSlot && (
                  <div className="ml-6">
                    {loadingSlots ? <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 text-[#E03673] animate-spin" /></div>
                    : availableSlots.length === 0 ? <p className="text-sm text-gray-500">Nenhum horário disponível. <button onClick={() => setUseCustomSlot(true)} className="ml-2 text-[#E03673] hover:underline">Agendar manualmente</button></p>
                    : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-2">
                        {availableSlots.slice(0, 30).map((slot, idx) => (
                          <button key={idx} onClick={() => setSelectedSlot(slot)} className={`p-2 rounded-lg text-sm transition-colors text-center ${selectedSlot?.starts_at === slot.starts_at ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                            {formatDateTime(slot.starts_at)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 mb-3">
                  <input type="radio" checked={useCustomSlot} onChange={() => setUseCustomSlot(true)} className="h-4 w-4 text-[#E03673]" />
                  <span className="text-sm font-medium text-gray-700">Escolher data e horário manualmente</span>
                </label>
                {useCustomSlot && (
                  <div className="ml-6 grid grid-cols-2 gap-3">
                    <div><label className="block text-xs text-gray-500 mb-1">Data</label><input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full p-2 border border-gray-200 rounded-lg outline-none" /></div>
                    <div><label className="block text-xs text-gray-500 mb-1">Horário</label><input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none" /></div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowBookingModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSendInviteFromModal} disabled={bookingLoading || (!useCustomSlot && !selectedSlot) || (useCustomSlot && (!customDate || !customTime))} className="px-4 py-2 text-sm bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                {bookingLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : <><Send className="w-4 h-4" />Enviar convite</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}