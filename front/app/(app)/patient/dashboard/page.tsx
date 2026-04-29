"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, Search, Wallet, User, Calendar, CheckCircle, XCircle, BarChart3, ArrowRight, Video, X
} from "lucide-react";

import type { Appointment, Therapist } from './types';
import type { PatientProfile } from '@/types/patient';
import { usePatientFilters } from './hooks/usePatientFilters';
import { usePatientStats } from './hooks/usePatientStats';
import { usePatientActions } from './hooks/usePatientActions';
import { useSmartSuggestion } from './hooks/useSmartSuggestion';

import { QuickBooking } from './components/QuickBooking';
import { CalendarPatient } from "@/components/calendar/CalendarPatient";
import SessionsList from './components/SessionsList';
import { InvitesCard } from './components/InvitesCard';
import { QuickLinks } from './components/QuickLinks';
import { MeetButton } from '@/components/meet/MeetButton';
import { StatsCard } from './components/cards/StatsCard';
import { UpcomingSessionCard } from './components/cards/UpcomingSessionCard';
import { SuccessModal } from "@/components/Modals/SuccessModal";

const timeOptions = Array.from({ length: 24 }, (_, i) => i).flatMap(hour => [
  <option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>{`${hour.toString().padStart(2, '0')}:00`}</option>,
  <option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>{`${hour.toString().padStart(2, '0')}:30`}</option>
]);

// ✅ Helper para construir calendarEvents a partir de appointments
function buildCalendarEventsFromAppointments(patientAppointments: Appointment[]) {
  return patientAppointments
    .filter((apt) => ["scheduled", "confirmed", "proposed", "completed"].includes(apt.status))
    .map((apt) => {
      let bgColor = "#3b82f6";
      if (apt.status === "proposed") bgColor = "#eab308";
      else if (apt.status === "confirmed") bgColor = "#22c55e";
      else if (apt.status === "scheduled") bgColor = "#3b82f6";
      else if (apt.status === "completed") bgColor = "#9ca3af";
      else if (apt.status?.includes("cancelled")) bgColor = "#ef4444";
      return {
        id: apt.id,
        title: apt.therapist?.full_name || `Terapeuta ${apt.therapist_user_id}`,
        start: apt.starts_at,
        end: apt.ends_at,
        backgroundColor: bgColor,
        borderColor: "#2563eb",
        textColor: "white",
        extendedProps: { therapist: apt.therapist, status: apt.status, appointment: apt }
      };
    });
}

export default function PatientDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [frequentTherapists, setFrequentTherapists] = useState<Therapist[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [userIdToProfileIdMap, setUserIdToProfileIdMap] = useState<Map<number, number>>(new Map());
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [quickTherapist, setQuickTherapist] = useState<string>("");
  const [quickDate, setQuickDate] = useState("");
  const [quickTime, setQuickTime] = useState("");
  const [quickLoading, setQuickLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  
  // 🔥 Estados do modal de sucesso
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentSuccessDetails, setPaymentSuccessDetails] = useState<{
    therapistName: string;
    date: string;
    time: string;
    duration: number;
    price: number;
  } | null>(null);

  const suggestionGenerated = useRef(false);
  const initialLoadDone = useRef(false);

  const stats = usePatientStats(appointments);
  const { filteredAppointments, activeFilter, applyFilter, clearFilter } = usePatientFilters(appointments);
  const { actionLoading, showReschedule, rescheduleDate, rescheduleTime, setRescheduleDate, setRescheduleTime, cancelAppointment, rescheduleAppointment, toggleReschedule, error, success, setError, setSuccess } = usePatientActions(user?.id);
  const { suggestion, generateSuggestion } = useSmartSuggestion();

  // 🔥 Detecção de retorno de pagamento (com modal de sucesso)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment_success') === 'true') {
      const appointmentId = params.get('appointment_id');
      const therapistName = params.get('therapist_name');
      const date = params.get('date');
      const time = params.get('time');
      const duration = params.get('duration');
      const price = params.get('price');
      
      // 🔥 Mostrar modal com os dados da sessão
      setPaymentSuccessDetails({
        therapistName: decodeURIComponent(therapistName || "Terapeuta"),
        date: decodeURIComponent(date || ""),
        time: decodeURIComponent(time || ""),
        duration: Number(duration) || 50,
        price: Number(price) || 0
      });
      setShowPaymentSuccess(true);
      
      // Recarregar dados
      initialLoadDone.current = false;
      const reloadData = async () => {
        try {
          const appointmentsData = await apiCall({ url: "/api/appointments/me/details", method: "GET" });
          const patientAppointments = appointmentsData.filter((apt: Appointment) => apt.patient_user_id === user?.id);
          setAppointments(patientAppointments);
          setCalendarEvents(buildCalendarEventsFromAppointments(patientAppointments));
          initialLoadDone.current = true;
        } catch (error) { console.error("Erro ao recarregar após pagamento:", error); }
      };
      reloadData();
      
      // Limpar URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user?.id, apiCall]);

  const loadPatientProfile = async () => {
    try {
      const profile = await apiCall({ url: "/api/patient/profile", method: "GET" });
      setPatientProfile(profile);
    } catch (error) { console.error("Erro ao carregar perfil:", error); }
  };

  const fetchTherapistAvailability = useCallback(async (userId: string, days: number = 30) => {
    try {
      const numericUserId = Number(userId);
      if (isNaN(numericUserId)) return [];
      const profileId = userIdToProfileIdMap.get(numericUserId);
      if (!profileId) return [];
      const data = await apiCall({ url: `/public/terapeutas/${profileId}/slots?days=${days}`, method: "GET" });
      return data.slots || data || [];
    } catch (error) { return []; }
  }, [apiCall, userIdToProfileIdMap]);

  const handleRespond = async (appointmentId: number, action: 'confirm' | 'decline') => {
    try {
      await apiCall({ url: `/api/appointments/${appointmentId}/status`, method: "PATCH", body: { status: action === 'confirm' ? 'confirmed' : 'cancelled_by_patient' } });
      setSuccess(action === 'confirm' ? 'Convite confirmado!' : 'Convite recusado');
      const data = await apiCall({ url: "/api/appointments/me/details", method: "GET" });
      const patientAppointments = data.filter((apt: Appointment) => apt.patient_user_id === user?.id);
      setAppointments(patientAppointments);
    } catch (err: any) { setError(err.message); }
  };

  const handleSlotClick = useCallback((date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = date.getMinutes() === 0 ? "00" : "30";
    router.push(`/busca?date=${year}-${month}-${day}&time=${hours}:${minutes}`);
  }, [router]);

  const handleCancel = async (id: number) => {
    await cancelAppointment(id, () => {
      setSelectedAppointment(null);
      setSuccess("✅ Sessão cancelada com sucesso!");
      setTimeout(() => setSuccess(""), 5000);
    });
  };

  const handleJoinMeet = useCallback((appointment: Appointment) => {
    if (appointment?.video_call_url) window.open(appointment.video_call_url, '_blank');
  }, []);

  const handleQuickSuggestion = async (slot: any) => {
    try {
      setQuickLoading(true);
      const data = await apiCall({ url: "/api/appointments", method: "POST", body: { therapist_user_id: slot.therapist_id, starts_at: slot.starts_at, ends_at: slot.ends_at, duration_minutes: 50 } });
      if (data.needs_payment) {
        const successUrl = `${window.location.origin}/patient/dashboard?payment_success=true&appointment_id=${data.id}`;
        const cancelUrl = `${window.location.origin}/patient/dashboard?payment_cancelled=true`;
        const stripeData = await apiCall({ url: '/api/payments/create-checkout', method: "POST", body: { appointment_id: data.id, amount: data.session_price || 200, success_url: successUrl, cancel_url: cancelUrl } });
        window.location.href = stripeData.checkout_url;
        return;
      }
      setSuccess("✅ Sessão agendada com sucesso!");
      const appointmentsData = await apiCall({ url: "/api/appointments/me/details", method: "GET" });
      const patientAppointments = appointmentsData.filter((apt: Appointment) => apt.patient_user_id === user?.id);
      setAppointments(patientAppointments);
    } catch (err: any) {
      setError(err.message || "Erro ao agendar");
    } finally {
      setQuickLoading(false);
    }
  };

  // Carregamento inicial
  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    if (initialLoadDone.current) { setLoading(false); return; }

    let isMounted = true;

    async function loadData() {
      try {
        const [appointmentsData, therapistsData] = await Promise.all([
          apiCall({ url: "/api/appointments/me/details", method: "GET" }),
          apiCall({ url: "/api/therapists", method: "GET" })
        ]);
        if (!isMounted) return;

        setTherapists(Array.isArray(therapistsData) ? therapistsData : []);

        const map = new Map<number, number>();
        therapistsData.forEach((t: any) => { if (t.user_id && t.id) map.set(t.user_id, t.id); });
        setUserIdToProfileIdMap(map);

        const patientAppointments = appointmentsData
          .filter((apt: Appointment) => apt.patient_user_id === user?.id)
          .sort((a: Appointment, b: Appointment) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

        setAppointments(patientAppointments);
        loadPatientProfile();

        const therapistCount = new Map<number, { count: number; therapist: Therapist }>();
        patientAppointments.forEach((apt: Appointment) => {
          const therapist = therapistsData.find((t: Therapist) => t.user_id === apt.therapist_user_id);
          if (therapist && apt.therapist_user_id) {
            const current = therapistCount.get(apt.therapist_user_id) || { count: 0, therapist };
            current.count += 1;
            therapistCount.set(apt.therapist_user_id, current);
          }
        });

        const frequent = Array.from(therapistCount.values()).sort((a, b) => b.count - a.count).map(item => item.therapist).slice(0, 5);
        setFrequentTherapists(frequent);
        setCalendarEvents(buildCalendarEventsFromAppointments(patientAppointments));

        if (frequent.length > 0) setQuickTherapist(String(frequent[0].user_id));

        initialLoadDone.current = true;
      } catch (error) {
        if (isMounted) setError("Erro ao carregar dados");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [user, apiCall, setError]);

  // ✅ Escuta eventos de reagendamento/atualização — recarrega sem window.location.reload()
  useEffect(() => {
    const handleAppointmentUpdated = async () => {
      console.log("🔄 [PatientDashboard] Evento recebido — recarregando...");
      try {
        const appointmentsData = await apiCall({ url: "/api/appointments/me/details", method: "GET" });
        const patientAppointments = appointmentsData.filter((apt: Appointment) => apt.patient_user_id === user?.id);
        setAppointments(patientAppointments);
        setCalendarEvents(buildCalendarEventsFromAppointments(patientAppointments));
      } catch (error) {
        console.error("Erro ao recarregar após evento:", error);
      }
    };
    window.addEventListener("appointmentUpdated", handleAppointmentUpdated);
    window.addEventListener("appointmentRescheduled", handleAppointmentUpdated);
    return () => {
      window.removeEventListener("appointmentUpdated", handleAppointmentUpdated);
      window.removeEventListener("appointmentRescheduled", handleAppointmentUpdated);
    };
  }, [user?.id, apiCall]);

  // Sugestão inteligente
  useEffect(() => {
    if (!appointments.length || !therapists.length || suggestionGenerated.current) return;
    suggestionGenerated.current = true;
    const timeoutId = setTimeout(async () => { await generateSuggestion(appointments, therapists); }, 500);
    return () => clearTimeout(timeoutId);
  }, [appointments, therapists, generateSuggestion]);

  // Disponibilidade do terapeuta selecionado
  useEffect(() => {
    if (!quickTherapist) return;
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    async function loadAvailability() {
      setLoadingSlots(true);
      const slots = await fetchTherapistAvailability(quickTherapist, 14);
      if (!isMounted) return;
      setAvailableSlots(slots);
      if (slots.length > 0 && !quickDate) {
        const firstSlot = new Date(slots[0].starts_at);
        setQuickDate(`${firstSlot.getFullYear()}-${String(firstSlot.getMonth() + 1).padStart(2, '0')}-${String(firstSlot.getDate()).padStart(2, '0')}`);
        setQuickTime(`${String(firstSlot.getHours()).padStart(2, '0')}:${firstSlot.getMinutes() === 0 ? "00" : "30"}`);
      }
      setLoadingSlots(false);
    }
    timeoutId = setTimeout(loadAvailability, 300);
    return () => { isMounted = false; clearTimeout(timeoutId); };
  }, [quickTherapist, fetchTherapistAvailability]);

  const handleQuickAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTherapist || !quickDate || !quickTime) { setError("Preencha todos os campos"); return; }
    setQuickLoading(true);
    setError("");
    try {
      const startsAt = new Date(`${quickDate}T${quickTime}:00`);
      const endsAt = new Date(startsAt.getTime() + 50 * 60000);
      await apiCall({ url: "/api/appointments", method: "POST", body: { therapist_user_id: Number(quickTherapist), starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: 50 } });
      setSuccess("Sessão agendada com sucesso!");
      const data = await apiCall({ url: "/api/appointments/me/details", method: "GET" });
      const patientAppointments = data.filter((apt: Appointment) => apt.patient_user_id === user?.id);
      setAppointments(patientAppointments);
    } catch (err: any) {
      setError(err.message || "Erro ao agendar");
    } finally {
      setQuickLoading(false);
    }
  };

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
    if (status === "cancelled_by_patient") return "Cancelada";
    if (status === "cancelled_by_therapist") return "Cancelada (terapeuta)";
    if (status === "cancelled_by_admin") return "Cancelada (admin)";
    if (status === "completed") return "Realizada";
    if (status === "rescheduled") return "Reagendada";
    return status;
  };

  const handleCancelSuccess = useCallback(() => {
    apiCall({ url: "/api/appointments/me/details", method: "GET" }).then(data => {
      const patientAppointments = data.filter((apt: Appointment) => apt.patient_user_id === user?.id);
      setAppointments(patientAppointments);
    });
  }, [user, apiCall]);

  const handleRescheduleSuccess = useCallback(() => {
    apiCall({ url: "/api/appointments/me/details", method: "GET" }).then(data => {
      const patientAppointments = data.filter((apt: Appointment) => apt.patient_user_id === user?.id);
      setAppointments(patientAppointments);
    });
  }, [user, apiCall]);

  const upcomingSessions = appointments
    .filter(apt => new Date(apt.starts_at) > new Date() && ["scheduled", "confirmed"].includes(apt.status))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 3);

  const userFirstName = patientProfile?.full_name?.split(' ')[0] || user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Paciente';

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
      <div className="p-6">Carregando...</div>
    </div>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {userFirstName}!</h1>
        <p className="text-sm text-gray-600 mt-1">Seu espaço de cuidado, escuta e saúde mental.</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { href: "/patient/dashboard", icon: <LayoutDashboard className="w-6 h-6 text-white" />, title: "Dashboard", desc: "Visão geral" },
            { href: "/busca", icon: <Search className="w-6 h-6 text-white" />, title: "Buscar", desc: "Encontre terapeutas" },
            { href: "/patient/wallet", icon: <Wallet className="w-6 h-6 text-white" />, title: "Carteira", desc: "Saldo e pagamentos" },
            { href: "/patient/profile", icon: <User className="w-6 h-6 text-white" />, title: "Perfil", desc: "Suas informações" },
          ].map(item => (
            <Link key={item.href} href={item.href} className="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white p-4 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105">
              <div className="flex items-center gap-3">{item.icon}<div><p className="font-semibold">{item.title}</p><p className="text-xs text-white/80">{item.desc}</p></div></div>
            </Link>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded border border-green-200">{success}</div>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: "calendar", value: stats.upcoming, label: "Próximas sessões", filter: "upcoming" },
            { icon: "check", value: stats.completed, label: "Realizadas", filter: "completed" },
            { icon: "x", value: stats.cancelled, label: "Canceladas", filter: "cancelled" },
            { icon: "chart", value: stats.total, label: "Total de sessões", filter: "all" },
          ].map(item => (
            <StatsCard key={item.filter} icon={item.icon as any} value={item.value} label={item.label} filter={item.filter} activeFilter={activeFilter}
              onFilterClick={(filter: string) => { applyFilter(filter as any); setShowSessionsModal(true); }}
              onExpand={() => setShowSessionsModal(true)} />
          ))}
        </div>

        {upcomingSessions.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#E03673]" />
              Próximas sessões
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcomingSessions.map((session) => (
                <UpcomingSessionCard key={session.id} session={session} onClick={setSelectedAppointment} formatDate={formatDate} getStatusText={getStatusText} onJoinMeet={handleJoinMeet} />
              ))}
            </div>
          </div>
        )}

        {showSessionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#E03673]" />
                  {activeFilter === 'upcoming' && 'Próximas sessões'}
                  {activeFilter === 'completed' && 'Sessões realizadas'}
                  {activeFilter === 'cancelled' && 'Sessões canceladas'}
                  {activeFilter === 'all' && 'Todas as sessões'}
                </h3>
                <button onClick={() => setShowSessionsModal(false)} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <SessionsList
                  appointments={filteredAppointments}
                  activeFilter={activeFilter}
                  frequentTherapists={frequentTherapists}
                  showReschedule={showReschedule}
                  actionLoading={actionLoading}
                  timeOptions={timeOptions}
                  onToggleReschedule={toggleReschedule}
                  onCancel={(id) => cancelAppointment(id, handleCancelSuccess)}
                  onReschedule={(apt) => rescheduleAppointment(apt, handleRescheduleSuccess)}
                  onRescheduleDateChange={(id, value) => setRescheduleDate(prev => ({ ...prev, [id]: value }))}
                  onRescheduleTimeChange={(id, value) => setRescheduleTime(prev => ({ ...prev, [id]: value }))}
                  onClearFilter={() => { clearFilter(); setShowSessionsModal(false); }}
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

        {/* 🔥 GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-[#E03673]" />
                <h2 className="text-lg font-semibold">Minha Agenda</h2>
              </div>
              <CalendarPatient 
                events={calendarEvents} 
                onEventClick={(apt) => setSelectedAppointment(apt)} 
                onSlotClick={handleSlotClick} 
                onCancel={handleCancel} 
                onJoinMeet={handleJoinMeet} 
              />
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <InvitesCard />
            <QuickLinks />
            <QuickBooking
              therapists={therapists}
              frequentTherapists={frequentTherapists}
              quickTherapist={quickTherapist}
              quickDate={quickDate}
              quickTime={quickTime}
              quickLoading={quickLoading}
              loadingSlots={loadingSlots}
              suggestion={suggestion}
              timeOptions={timeOptions}
              onTherapistChange={setQuickTherapist}
              onDateChange={setQuickDate}
              onTimeChange={setQuickTime}
              onSubmit={handleQuickAppointment}
              onQuickSuggestion={handleQuickSuggestion}
            />
          </div>
        </div>
      </div>

      {/* 🔥 MODAL DE SUCESSO APÓS PAGAMENTO */}
      <SuccessModal
        isOpen={showPaymentSuccess}
        onClose={() => setShowPaymentSuccess(false)}
        title="Sessão confirmada!"
        message="Sua sessão foi agendada com sucesso."
        details={paymentSuccessDetails || undefined}
        autoClose={true}
        autoCloseDelay={6000}
      />
    </>
  );
}