"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBRLocale from "@fullcalendar/core/locales/pt-br";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, X, RefreshCw, CheckCircle, XCircle, Loader2, Clock, DollarSign, Video, Copy, FileText, Plus, Pencil, Trash2, Save, Search } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaClaro: "#FCE4EC",
  rosaEscuro: "#c02c5e",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verde: "#10B981",
  verdeEscuro: "#3A3B21",
  vermelho: "#EF4444",
  amarelo: "#F59E0B",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

interface CalendarTherapistProps {
  events: any[];
  onEventClick: (appointment: any) => void;
  onSlotClick?: (date: Date) => void;
  onCancel?: (id: number) => Promise<void>;
  onJoinMeet?: (appointment: any) => void;
}

type PersonalEventType = 'personal' | 'reminder' | 'task' | 'invite';

const dispatchAppointmentUpdated = () => {
  window.dispatchEvent(new Event("appointmentUpdated"));
};

export function CalendarTherapist({ events, onEventClick, onSlotClick, onCancel, onJoinMeet }: CalendarTherapistProps) {
  const router = useRouter();
  const { openProntuario } = useSidebar();
  const { user } = useAuth();
  const { execute: apiCall } = useApi();

  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [showPersonalEventModal, setShowPersonalEventModal] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState<Date | null>(null);
  const [personalEventType, setPersonalEventType] = useState<PersonalEventType>('personal');
  const [personalEventTitle, setPersonalEventTitle] = useState('');
  const [personalEventPatientId, setPersonalEventPatientId] = useState<number | null>(null);
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [personalEventDuration, setPersonalEventDuration] = useState(50);

  const [editingPersonalEvent, setEditingPersonalEvent] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editingEventLoading, setEditingEventLoading] = useState(false);

  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalConnecting, setGcalConnecting] = useState(false);

  const [isAvailableNow, setIsAvailableNow] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const term = searchTerm.toLowerCase().trim();
    return events.filter(event => {
      const patient = event.extendedProps?.patient;
      if (!patient) return false;
      const patientName = patient.full_name?.toLowerCase() || "";
      const patientEmail = patient.email?.toLowerCase() || "";
      return patientName.includes(term) || patientEmail.includes(term);
    });
  }, [events, searchTerm]);

  useEffect(() => {
    loadGcalStatus();
    loadAvailabilityStatus();
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      showToast("Google Calendar conectado com sucesso! 🎉", "success");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const loadGcalStatus = async () => {
    try {
      const data = await apiCall({ url: "/api/google-calendar/status" });
      setGcalStatus(data);
    } catch { setGcalStatus({ connected: false }); }
  };

  const loadAvailabilityStatus = async () => {
    try {
      const data = await apiCall({ url: "/api/therapists/me/availability-status" });
      setIsAvailableNow(data?.is_available_now || false);
    } catch {
      // Silencioso — endpoint pode não estar disponível
    }
  };

  const toggleAvailabilityNow = async () => {
    setTogglingAvailability(true);
    try {
      const newStatus = !isAvailableNow;
      await apiCall({
        url: "/api/therapists/me/availability-status",
        method: "PATCH",
        body: { is_available_now: newStatus },
      });
      setIsAvailableNow(newStatus);
      showToast(
        newStatus ? "Você agora está disponível para atendimento imediato!" : "Atendimento imediatodesativado",
        "success"
      );
    } catch (error: any) {
      showToast(error.message || "Erro ao alterar status", "error");
    } finally {
      setTogglingAvailability(false);
    }
  };

  const handleGcalConnect = async () => {
    setGcalConnecting(true);
    try {
      const data = await apiCall({ url: "/api/google-calendar/connect" });
      if (data.auth_url) window.location.href = data.auth_url;
    } catch (e: any) {
      showToast("Erro ao iniciar conexão com Google Calendar", "error");
      setGcalConnecting(false);
    }
  };

  const handleGcalDisconnect = async () => {
    setGcalLoading(true);
    try {
      await apiCall({ url: "/api/google-calendar/disconnect", method: "POST" });
      setGcalStatus({ connected: false });
      showToast("Google Calendar desconectado", "success");
    } catch { showToast("Erro ao desconectar", "error"); }
    finally { setGcalLoading(false); }
  };

  const handleGcalSyncAll = async () => {
    setGcalLoading(true);
    try {
      const data = await apiCall({ url: "/api/google-calendar/sync-all", method: "POST" });
      showToast(`${data.synced} sessões sincronizadas ✅`, "success");
    } catch { showToast("Erro ao sincronizar", "error"); }
    finally { setGcalLoading(false); }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const hasEventsOutsideBusinessHours = () => {
    return events.some(event => {
      const startHour = new Date(event.start).getHours();
      return startHour < 7 || startHour >= 19;
    });
  };

  const slotMinTime = "07:00:00";
  const slotMaxTime = "19:00:00";
  const hasOutsideEvents = hasEventsOutsideBusinessHours();

  const loadPatients = async () => {
    setLoadingPatients(true);
    try {
      const data = await apiCall({ url: '/api/patients' });
      setPatientsList(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar pacientes:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleSlotClick = (date: Date) => {
    setSelectedSlotDate(date);
    setPersonalEventTitle('');
    setPersonalEventType('personal');
    setPersonalEventPatientId(null);
    setPersonalEventDuration(50);
    setShowPersonalEventModal(true);
    loadPatients();
  };

  const handleCreatePersonalEvent = async () => {
    if (!selectedSlotDate) return;
    if (personalEventType === 'invite' && !personalEventPatientId) {
      showToast('Selecione um paciente', 'error');
      return;
    }
    if (personalEventType !== 'invite' && !personalEventTitle.trim()) {
      showToast('Informe o título do evento', 'error');
      return;
    }
    setCreatingEvent(true);
    try {
      const startsAt = new Date(selectedSlotDate);
      const endsAt = new Date(startsAt);
      endsAt.setMinutes(endsAt.getMinutes() + personalEventDuration);
      if (personalEventType === 'invite') {
        await apiCall({
          url: '/api/invites', method: 'POST',
          body: { patient_user_id: personalEventPatientId, therapist_user_id: user?.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: personalEventDuration },
        });
        showToast('Convite enviado com sucesso!', 'success');
      } else {
        await apiCall({
          url: '/api/personal-events', method: 'POST',
          body: { type: personalEventType, title: personalEventTitle, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString() },
        });
        showToast(`${getPersonalEventTypeLabel(personalEventType)} agendado!`, 'success');
      }
      setShowPersonalEventModal(false);
      setTimeout(() => dispatchAppointmentUpdated(), 300);
    } catch (error: any) {
      showToast(error.message || 'Erro ao criar evento', 'error');
    } finally {
      setCreatingEvent(false);
    }
  };

  const getPersonalEventTypeLabel = (type: PersonalEventType): string => {
    const labels = { personal: 'Compromisso pessoal', reminder: 'Lembrete', task: 'Tarefa', invite: 'Convite' };
    return labels[type];
  };

  const handleEditPersonalEvent = async () => {
    if (!editingPersonalEvent) return;
    setEditingEventLoading(true);
    try {
      const eventId = editingPersonalEvent.extendedProps?.personalEventId;
      if (!eventId) return;
      const newDateTime = new Date(`${editDate}T${editTime}:00`);
      const newEndDateTime = new Date(`${editDate}T${editEndTime}:00`);
      if (newDateTime >= newEndDateTime) {
        showToast('Início deve ser antes do término', 'error');
        setEditingEventLoading(false);
        return;
      }
      await apiCall({
        url: `/api/personal-events/${eventId}`, method: 'PUT',
        body: { title: editTitle.trim() || "Evento", starts_at: newDateTime.toISOString(), ends_at: newEndDateTime.toISOString() },
      });
      showToast('Evento atualizado!', 'success');
      setEditingPersonalEvent(null);
      setTimeout(() => dispatchAppointmentUpdated(), 300);
    } catch (error: any) {
      showToast(error.message || 'Erro ao editar', 'error');
    } finally {
      setEditingEventLoading(false);
    }
  };

  const handleDeletePersonalEvent = async () => {
    if (!editingPersonalEvent) return;
    if (!confirm('Excluir este evento?')) return;
    setEditingEventLoading(true);
    try {
      const eventId = editingPersonalEvent.extendedProps?.personalEventId;
      if (!eventId) return;
      await apiCall({ url: `/api/personal-events/${eventId}`, method: 'DELETE' });
      showToast('Evento excluído!', 'success');
      setEditingPersonalEvent(null);
      setTimeout(() => dispatchAppointmentUpdated(), 300);
    } catch (error: any) {
      showToast(error.message || 'Erro ao excluir', 'error');
    } finally {
      setEditingEventLoading(false);
    }
  };

  const handleEventClick = (info: any) => {
    const isPersonalEvent = info.event.extendedProps?.isPersonalEvent;
    const appointment = info.event.extendedProps?.appointment;
    if (isPersonalEvent) {
      const event = info.event;
      const eventData = { id: event.id, title: event.title, start: event.start, end: event.end, extendedProps: event.extendedProps };
      setEditTitle(eventData.title || "");
      setEditDate(eventData.start.toISOString().split('T')[0]);
      setEditTime(eventData.start.toISOString().slice(11, 16));
      setEditEndTime(eventData.end.toISOString().slice(11, 16));
      setEditingPersonalEvent(eventData);
      setShowReschedule(false);
    } else {
      setSelectedEvent(info.event);
      setShowReschedule(false);
      onEventClick(appointment);
    }
  };

  const handleRescheduleClick = () => setShowReschedule(true);
  const handleCancelReschedule = () => { setShowReschedule(false); setNewDate(''); setNewTime(''); };

  const handleCancelAppointment = async () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (!appointment) return;
    if (confirm('Cancelar esta sessão?')) {
      try {
        if (onCancel) {
          await onCancel(appointment.id);
        } else {
          await apiCall({ url: `/api/appointments/${appointment.id}/status`, method: 'PATCH', body: { status: 'cancelled_by_therapist' } });
        }
        showToast('Sessão cancelada!', 'success');
        setSelectedEvent(null);
        dispatchAppointmentUpdated();
      } catch (error: any) {
        showToast(error.message || 'Erro ao cancelar', 'error');
      }
    }
  };

  // 🔥 ALTERADO: Redireciona para página embed do Jitsi
  const handleStartSession = () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (appointment?.id) {
      // Fecha o modal
      setSelectedEvent(null);
      // Redireciona para a página de videochamada embed
      router.push(`/therapist/videochamada/${appointment.id}`);
    }
  };

  const handleOpenProntuario = () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (appointment?.id) openProntuario(appointment.id);
  };

  const handleCopyLink = () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (appointment?.video_call_url) {
      navigator.clipboard.writeText(appointment.video_call_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatWithTimezone = (date: Date) => {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`;
  };

  const handleConfirmReschedule = async () => {
    if (!newDate || !newTime) { showToast('Selecione data e hora', 'error'); return; }
    setIsLoading(true);
    const dateTimeStr = `${newDate}T${newTime}:00-03:00`;
    const startsAt = new Date(dateTimeStr);
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (!appointment) { setIsLoading(false); return; }
    const originalDuration = Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000);
    const endsAt = new Date(startsAt.getTime() + originalDuration * 60000);
    try {
      await apiCall({
        url: `/api/appointments/${appointment.id}/reschedule`, method: 'POST',
        body: { therapist_user_id: appointment.therapist_user_id, starts_at: formatWithTimezone(startsAt), ends_at: formatWithTimezone(endsAt), duration_minutes: originalDuration },
      });
      showToast('Sessão reagendada!', 'success');
      setShowReschedule(false);
      setSelectedEvent(null);
      window.dispatchEvent(new Event("appointmentRescheduled"));
    } catch (error: any) {
      showToast(error.message || 'Erro ao reagendar', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = 7 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }).filter(time => { const hour = parseInt(time.split(':')[0]); return hour >= 7 && hour < 19; });

  const cleanTitle = (title: string) => title.replace(/[🔔✅📋📩⚠️❗❌⭐]/g, '').trim();

  const renderEventContent = (eventInfo: any) => {
    const patient = eventInfo.event.extendedProps?.patient;
    const status = eventInfo.event.extendedProps?.status;
    const isPersonalEvent = eventInfo.event.extendedProps?.isPersonalEvent;
    const personalEventTypeValue = eventInfo.event.extendedProps?.type;
    let patientName = cleanTitle(patient?.full_name || eventInfo.event.title);
    const fotoUrl = patient?.foto_url ? getFotoSrc(patient.foto_url) ?? "" : null;

    let bgColor = "#3b82f6";
    let iconHtml = `<span class="text-xs font-bold">${patientName.charAt(0).toUpperCase()}</span>`;

    if (isPersonalEvent) {
      bgColor = "#9ca3af";
      if (personalEventTypeValue === "reminder") {
        iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
      } else if (personalEventTypeValue === "task") {
        iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
      } else {
        iconHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
      }
    } else if (status === "proposed") bgColor = "#eab308";
    else if (status === "confirmed") bgColor = "#22c55e";
    else if (status === "scheduled") bgColor = "#3b82f6";
    else if (status === "completed") bgColor = "#9ca3af";
    else if (status === "rescheduled") bgColor = "#F59E0B";
    else if (status?.includes("cancelled")) bgColor = "#ef4444";

    return {
      html: `
        <div style="background-color: ${bgColor};" class="p-1 text-xs text-white rounded truncate cursor-pointer hover:opacity-90 flex items-center gap-1">
          <div class="w-5 h-5 rounded-full overflow-hidden bg-white/30 flex-shrink-0 flex items-center justify-center">
            ${!isPersonalEvent && fotoUrl ? `<img src="${fotoUrl}" alt="${patientName}" class="w-full h-full object-cover" />` : iconHtml}
          </div>
          <span class="truncate">${patientName}</span>
        </div>
      `
    };
  };

  const calendarStyles = [
    `.fc .fc-button-primary { background-color: ${CORES.cinza} !important; border-color: ${CORES.cinzaBorda} !important; color: ${CORES.cinzaTexto} !important; transition: all 0.2s ease; box-shadow: none !important; }`,
    `.fc .fc-button-primary:hover { background-color: ${CORES.rosa} !important; border-color: ${CORES.rosa} !important; color: ${CORES.branco} !important; }`,
    `.fc .fc-button-primary.fc-button-active,
     .fc .fc-button-primary:not(:disabled).fc-button-active,
     .fc .fc-button-primary:not(:disabled):active { background-color: ${CORES.rosa} !important; border-color: ${CORES.rosaEscuro} !important; color: ${CORES.branco} !important; box-shadow: none !important; }`,
    `.fc .fc-prev-button, .fc .fc-next-button { background-color: ${CORES.cinza} !important; border-color: ${CORES.cinzaBorda} !important; color: ${CORES.cinzaTexto} !important; }`,
    `.fc .fc-prev-button:hover, .fc .fc-next-button:hover { background-color: ${CORES.rosa} !important; border-color: ${CORES.rosa} !important; color: ${CORES.branco} !important; }`,
    `.fc-day-today { background-color: ${CORES.rosaClaro} !important; }`,
    `.fc-day-today .fc-daygrid-day-number { color: ${CORES.rosa}; font-weight: bold; }`,
    `.fc-timegrid-col.fc-day-today { background-color: ${CORES.rosaClaro} !important; }`,
    `.fc .fc-toolbar-title { font-size: 0.95rem; font-weight: 600; }`,
    `.fc .fc-timegrid-slot { height: 2.5rem; }`,
    `.fc .fc-timegrid-slot-label { font-size: 0.7rem; color: #9ca3af; vertical-align: top; }`,
    `.fc .fc-col-header-cell { font-size: 0.72rem; }`,
    `.fc .fc-col-header-cell-cushion { padding: 3px 4px; font-weight: 600; }`,
    `.fc .fc-button { font-size: 0.75rem; padding: 3px 8px; }`,
    `.fc .fc-toolbar { margin-bottom: 6px; }`,
  ].join("\n");

  const appointment = selectedEvent?.extendedProps?.appointment;
  const hasMeetLink = appointment?.video_call_url;
  const isConfirmed = appointment?.status === "confirmed" || appointment?.status === "scheduled" || appointment?.status === "rescheduled";
  const isPersonalEventSelected = selectedEvent?.extendedProps?.isPersonalEvent;

  const searchResultCount = filteredEvents.length;
  const isSearching = searchTerm.trim() !== "";

  return (
    <div className="space-y-4 mb-8">
      {/* Card Google Calendar Integration */}
      <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-all ${
        gcalStatus?.connected
          ? "bg-green-50 border-green-200"
          : "bg-gradient-to-r from-[#2F80D3]/5 to-[#E03673]/5 border-[#2F80D3]/20"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            gcalStatus?.connected ? "bg-green-100" : "bg-white shadow-sm"
          }`}>
            <Calendar className={`w-5 h-5 ${gcalStatus?.connected ? "text-green-600" : "text-[#2F80D3]"}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {gcalStatus?.connected ? "Google Calendar conectado ✓" : "Integrar com Google Calendar"}
            </p>
            <p className="text-xs text-gray-500">
              {gcalStatus?.connected
                ? `Sessões sincronizadas automaticamente${gcalStatus.email ? ` · ${gcalStatus.email}` : ""}`
                : "Receba suas sessões confirmadas diretamente na sua agenda pessoal"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {gcalStatus?.connected ? (
            <>
              <button onClick={handleGcalSyncAll} disabled={gcalLoading}
                className="px-3 py-1.5 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50">
                {gcalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Sincronizar
              </button>
              <button onClick={handleGcalDisconnect} disabled={gcalLoading}
                className="px-3 py-1.5 text-xs bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50">
                Desconectar
              </button>
            </>
          ) : (
            <button onClick={handleGcalConnect} disabled={gcalConnecting}
              className="px-4 py-2 text-sm bg-[#2F80D3] hover:bg-[#236bb3] text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm">
              {gcalConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {gcalConnecting ? "Conectando..." : "Conectar agenda"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {toast.message}
          </div>
        )}

        <div className="flex flex-col gap-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold text-gray-900">Minha Agenda</h2>
            </div>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                isAvailableNow
                  ? "bg-green-100 border border-green-300"
                  : "bg-gray-100 border border-gray-200"
              }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${isAvailableNow ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={`text-sm font-medium ${isAvailableNow ? "text-green-700" : "text-gray-500"}`}>
                  {isAvailableNow ? "Disponível Agora" : "Indisponível"}
                </span>
              </div>

              <button
                onClick={toggleAvailabilityNow}
                disabled={togglingAvailability}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  isAvailableNow ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAvailableNow ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>

              <span className="text-xs text-gray-400 hidden sm:inline">
                {isAvailableNow ? "Aceitando demandas urgentes" : "Ativar plantão"}
              </span>
            </div>

            <button
              onClick={() => { setSelectedSlotDate(new Date()); setPersonalEventType('personal'); setPersonalEventTitle(''); setPersonalEventPatientId(null); setShowPersonalEventModal(true); loadPatients(); }}
              className="bg-[#2F80D3] hover:bg-[#236bb3] text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors">
              <Plus className="w-4 h-4" />
              Novo compromisso
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente por nome ou e-mail..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent text-sm"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <button onClick={() => setSearchTerm("")} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {isSearching && (
            <div className="text-xs text-gray-500">
              {searchResultCount === 0 ? (
                <span className="text-amber-600">⚠️ Nenhum paciente encontrado para "{searchTerm}"</span>
              ) : (
                <span>🔍 {searchResultCount} sessão(s) encontrada(s) para "{searchTerm}"</span>
              )}
            </div>
          )}
        </div>

        <div className="h-auto">
          <FullCalendar
            key={searchTerm}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={{ left: 'prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            buttonText={{ month: 'Mês', week: 'Semana', day: 'Dia' }}
            locale={ptBRLocale}
            initialView="timeGridWeek"
            height="auto"
            events={filteredEvents}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            slotDuration="01:00:00"
            slotLabelInterval="01:00:00"
            allDaySlot={false}
            expandRows={true}
            selectable={true}
            selectMirror={true}
            select={(info) => { if (info.start) handleSlotClick(info.start); }}
            dateClick={(info) => { if (info.date) handleSlotClick(info.date); }}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
          />
        </div>

        {/* MODAL CRIAR EVENTO */}
        {showPersonalEventModal && selectedSlotDate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Plus className="w-5 h-5" /><h3 className="text-lg font-semibold">Novo evento</h3></div>
                  <button onClick={() => setShowPersonalEventModal(false)} className="text-white hover:text-gray-200"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Data e horário</p>
                  <p className="font-medium">{selectedSlotDate.toLocaleDateString('pt-BR')} às {selectedSlotDate.toLocaleTimeString('pt-BR').slice(0,5)}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração</label>
                  <div className="flex gap-3">
                    {[30, 50].map(d => (
                      <button key={d} onClick={() => setPersonalEventDuration(d)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${personalEventDuration === d ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                        {d} min
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
                  <select value={personalEventType} onChange={(e) => { setPersonalEventType(e.target.value as PersonalEventType); if (e.target.value === 'invite') loadPatients(); }}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none">
                    <option value="personal">Compromisso pessoal</option>
                    <option value="reminder">Lembrete</option>
                    <option value="task">Tarefa</option>
                    <option value="invite">Enviar convite</option>
                  </select>
                </div>
                {personalEventType === 'invite' ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selecionar paciente</label>
                    <select value={personalEventPatientId || ''} onChange={(e) => setPersonalEventPatientId(Number(e.target.value))}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none" disabled={loadingPatients}>
                      <option value="">Selecione um paciente...</option>
                      {patientsList.map((patient) => (
                        <option key={patient.id} value={patient.id}>{patient.full_name || patient.email}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <input type="text" value={personalEventTitle} onChange={(e) => setPersonalEventTitle(e.target.value)}
                      placeholder={personalEventType === 'task' ? 'Ex: Revisar prontuários' : 'Ex: Almoço'}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none" />
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleCreatePersonalEvent} disabled={creatingEvent}
                    className="flex-1 bg-[#E03673] hover:bg-[#c02c5e] text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {creatingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {creatingEvent ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setShowPersonalEventModal(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDITAR EVENTO PESSOAL */}
        {editingPersonalEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Pencil className="w-5 h-5" /><h3 className="text-lg font-semibold">Editar evento</h3></div>
                  <button onClick={() => setEditingPersonalEvent(null)} className="text-white hover:text-gray-200"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                    <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                    <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                    <input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg outline-none" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleEditPersonalEvent} disabled={editingEventLoading}
                    className="flex-1 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {editingEventLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingEventLoading ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={handleDeletePersonalEvent} disabled={editingEventLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" />Excluir
                  </button>
                </div>
                <button onClick={() => setEditingPersonalEvent(null)} className="w-full mt-3 text-center text-sm text-gray-400 hover:text-gray-600 py-2">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DETALHES DA SESSÃO */}
        {selectedEvent && !isPersonalEventSelected && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-4 bg-[#FCE4EC] border-b border-[#E03673]/20">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2"><Calendar className="w-5 h-5 text-[#E03673]" /><h3 className="text-lg font-semibold text-gray-900">Detalhes da Sessão</h3></div>
                  <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white font-bold text-lg">
                    {selectedEvent.extendedProps?.patient?.foto_url ? (
                      <img src={getFotoSrc(selectedEvent.extendedProps.patient.foto_url) ?? ""} alt={selectedEvent.title} className="h-full w-full object-cover" />
                    ) : (
                      <span>{selectedEvent.title.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedEvent.title}</h3>
                    <p className="text-sm text-gray-500">Paciente</p>
                  </div>
                </div>

                {isConfirmed && (
                  <div className="mb-4">
                    <button onClick={handleStartSession}
                      className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md">
                      <Video className="w-5 h-5" />
                      Iniciar Sessão
                    </button>
                    {hasMeetLink && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Link da videochamada:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-700 bg-white p-1.5 rounded flex-1 truncate">{appointment?.video_call_url}</code>
                          <button onClick={handleCopyLink} className="p-1.5 text-gray-500 hover:text-[#2F80D3]"><Copy className="w-4 h-4" /></button>
                        </div>
                        {copied && <p className="text-xs text-green-600 mt-1">✅ Link copiado!</p>}
                      </div>
                    )}
                  </div>
                )}

                {isConfirmed && appointment?.id && (
                  <button onClick={handleOpenProntuario}
                    className="w-full bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 mt-2">
                    <FileText className="w-5 h-5" />Registrar Prontuário
                  </button>
                )}

                <div className="space-y-3 mb-5 mt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedEvent.start?.toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{selectedEvent.start?.toLocaleTimeString('pt-BR').slice(0,5)} - {selectedEvent.end?.toLocaleTimeString('pt-BR').slice(0,5)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedEvent.extendedProps?.status === "confirmed" ? "bg-green-100 text-green-800" :
                      selectedEvent.extendedProps?.status === "scheduled" ? "bg-blue-100 text-blue-800" :
                      selectedEvent.extendedProps?.status === "proposed" ? "bg-yellow-100 text-yellow-800" :
                      selectedEvent.extendedProps?.status === "rescheduled" ? "bg-orange-100 text-orange-800" :
                      selectedEvent.extendedProps?.status?.includes("cancelled") ? "bg-red-100 text-red-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {selectedEvent.extendedProps?.status === "confirmed" ? "Confirmada" :
                       selectedEvent.extendedProps?.status === "scheduled" ? "Agendada" :
                       selectedEvent.extendedProps?.status === "proposed" ? "Convite pendente" :
                       selectedEvent.extendedProps?.status === "rescheduled" ? "Reagendada" :
                       selectedEvent.extendedProps?.status?.includes("cancelled") ? "Cancelada" :
                       selectedEvent.extendedProps?.status}
                    </span>
                  </div>
                  {selectedEvent.extendedProps?.price && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">R$ {selectedEvent.extendedProps.price.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                </div>

                {!showReschedule ? (
                  <div className="flex gap-3">
                    <button onClick={handleRescheduleClick}
                      className="flex-1 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4" />Reagendar
                    </button>
                    <button onClick={handleCancelAppointment}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2">
                      <XCircle className="w-4 h-4" />Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-800">Reagendar sessão</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nova data</label>
                      <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Novo horário</label>
                      <select value={newTime} onChange={(e) => setNewTime(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg outline-none">
                        <option value="">Selecione</option>
                        {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={handleConfirmReschedule} disabled={isLoading}
                        className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {isLoading ? 'Processando...' : 'Confirmar'}
                      </button>
                      <button onClick={handleCancelReschedule} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">Cancelar</button>
                    </div>
                  </div>
                )}
                <button onClick={() => setSelectedEvent(null)} className="w-full mt-4 text-center text-sm text-gray-400 hover:text-gray-600 py-2">Fechar</button>
              </div>
            </div>
          </div>
        )}

        <style>{calendarStyles}</style>
      </div>
    </div>
  );
}