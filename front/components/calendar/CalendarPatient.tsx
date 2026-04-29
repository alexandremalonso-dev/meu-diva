"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBRLocale from "@fullcalendar/core/locales/pt-br";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Calendar, X, RefreshCw, CheckCircle, XCircle, Loader2, Clock, DollarSign, Video, Copy, MessageSquare, AlertTriangle, Phone } from "lucide-react";
import { ComplaintModal } from "@/components/Modals/ComplaintModal";
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaClaro: "#FCE4EC",
  rosaEscuro: "#c02c5e",
  ciano: "#49CCD4",
  laranja: "#F59E0B",
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

interface CalendarPatientProps {
  events: any[];
  onEventClick: (appointment: any) => void;
  onSlotClick?: (date: Date) => void;
  onCancel?: (id: number) => Promise<void>;
  onJoinMeet?: (appointment: any) => void;
}

const dispatchAppointmentUpdated = () => {
  window.dispatchEvent(new Event("appointmentUpdated"));
};

export function CalendarPatient({ events, onEventClick, onSlotClick, onCancel, onJoinMeet }: CalendarPatientProps) {
  const router = useRouter();
  const { openQueixa } = useSidebar();
  const { execute: apiCall } = useApi();

  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<number | null>(null);
  const [selectedTherapistName, setSelectedTherapistName] = useState("");
  const [selectedSessionDate, setSelectedSessionDate] = useState("");

  // ─── Google Calendar ──────────────────────────────────────────────────────
  const [gcalStatus, setGcalStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalConnecting, setGcalConnecting] = useState(false);

  useEffect(() => {
    loadGcalStatus();
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
    } catch {
      setGcalStatus({ connected: false });
    }
  };

  const handleGcalConnect = async () => {
    setGcalConnecting(true);
    try {
      const data = await apiCall({ url: "/api/google-calendar/connect" });
      if (data.auth_url) window.location.href = data.auth_url;
    } catch {
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
    } catch {
      showToast("Erro ao desconectar", "error");
    } finally {
      setGcalLoading(false);
    }
  };

  const handleGcalSyncAll = async () => {
    setGcalLoading(true);
    try {
      const data = await apiCall({ url: "/api/google-calendar/sync-all", method: "POST" });
      showToast(`${data.synced} sessões sincronizadas ✅`, "success");
    } catch {
      showToast("Erro ao sincronizar", "error");
    } finally {
      setGcalLoading(false);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

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

  const handleEventClick = (info: any) => {
    setSelectedEvent(info.event);
    setShowReschedule(false);
    onEventClick(info.event.extendedProps.appointment);
  };

  const handleRescheduleClick = () => setShowReschedule(true);
  const handleCancelReschedule = () => { setShowReschedule(false); setNewDate(''); setNewTime(''); };

  const handleOpenCancelModal = () => setShowCancelConfirmModal(true);
  const handleCloseCancelModal = () => setShowCancelConfirmModal(false);

  const handleConfirmCancel = async () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (!appointment) return;
    setCancelling(true);
    try {
      if (onCancel) {
        await onCancel(appointment.id);
      } else {
        await api(`/api/appointments/${appointment.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'cancelled_by_patient' })
        });
      }
      setSelectedEvent(null);
      setShowCancelConfirmModal(false);
      dispatchAppointmentUpdated();
    } catch (error: any) {
      showToast(error.message || 'Erro ao cancelar sessão', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleStartSession = () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (appointment?.id) {
      setSelectedEvent(null);
      router.push(`/patient/videochamada/${appointment.id}`);
    }
  };

  const handleCopyLink = () => {
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (appointment?.video_call_url) {
      navigator.clipboard.writeText(appointment.video_call_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
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
    if (!newDate || !newTime) { showToast('Selecione data e hora para reagendar', 'error'); return; }
    setIsLoading(true);
    const dateTimeStr = `${newDate}T${newTime}:00-03:00`;
    const startsAt = new Date(dateTimeStr);
    const appointment = selectedEvent?.extendedProps?.appointment;
    if (!appointment) { setIsLoading(false); return; }
    const originalDuration = Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000);
    const endsAt = new Date(startsAt.getTime() + originalDuration * 60000);
    try {
      await api(`/api/appointments/${appointment.id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({
          therapist_user_id: appointment.therapist_user_id,
          starts_at: formatWithTimezone(startsAt),
          ends_at: formatWithTimezone(endsAt),
          duration_minutes: originalDuration
        })
      });
      setShowReschedule(false);
      setSelectedEvent(null);
      window.dispatchEvent(new Event("appointmentRescheduled"));
    } catch (error: any) {
      showToast(error.message || 'Erro ao reagendar sessão', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = 7 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }).filter(time => { const hour = parseInt(time.split(':')[0]); return hour >= 7 && hour < 19; });

  const renderEventContent = (eventInfo: any) => {
    const therapist = eventInfo.event.extendedProps?.therapist;
    const status = eventInfo.event.extendedProps?.status;
    const therapistName = therapist?.full_name || eventInfo.event.title;
    const fotoUrl = therapist?.foto_url ? getFotoSrc(therapist.foto_url) ?? "" : null;

    let bgColor = CORES.azul;
    if (status === "proposed") bgColor = CORES.amarelo;
    else if (status === "confirmed") bgColor = CORES.verde;
    else if (status === "scheduled") bgColor = CORES.azul;
    else if (status === "completed") bgColor = CORES.cinzaTexto;
    else if (status?.includes("cancelled")) bgColor = CORES.cinzaTexto;

    return {
      html: `
        <div style="background-color: ${bgColor};" class="p-1 text-xs text-white rounded truncate cursor-pointer hover:opacity-90 flex items-center gap-1">
          <div class="w-5 h-5 rounded-full overflow-hidden bg-white/30 flex-shrink-0 flex items-center justify-center">
            ${fotoUrl ? `<img src="${fotoUrl}" alt="${therapistName}" class="w-full h-full object-cover" />` : `<span class="text-xs font-bold">${therapistName.charAt(0).toUpperCase()}</span>`}
          </div>
          <span class="truncate">${therapistName}</span>
        </div>
      `
    };
  };

  const appointment = selectedEvent?.extendedProps?.appointment;
  const hasMeetLink = appointment?.video_call_url;
  const isConfirmed = appointment?.status === "confirmed" || appointment?.status === "scheduled";
  const therapistPhone = appointment?.therapist?.phone;
  const shouldShowPhone = isConfirmed && therapistPhone;

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* ─── Card Google Calendar ─────────────────────────────────────────── */}
      <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-all mb-4 ${
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
              <button
                onClick={handleGcalSyncAll}
                disabled={gcalLoading}
                className="px-3 py-1.5 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {gcalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                Sincronizar
              </button>
              <button
                onClick={handleGcalDisconnect}
                disabled={gcalLoading}
                className="px-3 py-1.5 text-xs bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Desconectar
              </button>
            </>
          ) : (
            <button
              onClick={handleGcalConnect}
              disabled={gcalConnecting}
              className="px-4 py-2 text-sm bg-[#2F80D3] hover:bg-[#236bb3] text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {gcalConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {gcalConnecting ? "Conectando..." : "Conectar agenda"}
            </button>
          )}
        </div>
      </div>
      {/* ──────────────────────────────────────────────────────────────────── */}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="h-auto">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            headerToolbar={{ left: 'prev,next', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            buttonText={{ month: 'Mês', week: 'Semana', day: 'Dia' }}
            locale={ptBRLocale}
            initialView="timeGridWeek"
            height="auto"
            events={events}
            slotMinTime={slotMinTime}
            slotMaxTime={slotMaxTime}
            slotDuration="01:00:00"
            slotLabelInterval="01:00:00"
            allDaySlot={false}
            expandRows={true}
            selectable={true}
            selectMirror={true}
            select={(info) => { if (onSlotClick) onSlotClick(info.start); }}
            dateClick={(info) => { if (onSlotClick) onSlotClick(info.date); }}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
          />
        </div>

        {/* Modal detalhes da sessão */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-4 bg-[#FCE4EC] border-b border-[#E03673]/20">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#E03673]" />
                    <h3 className="text-lg font-semibold text-gray-900">Detalhes da Sessão</h3>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white font-bold text-lg">
                    {selectedEvent.extendedProps?.therapist?.foto_url ? (
                      <img src={getFotoSrc(selectedEvent.extendedProps.therapist.foto_url) ?? ""} alt={selectedEvent.title} className="h-full w-full object-cover" />
                    ) : (
                      <span>{selectedEvent.title.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{selectedEvent.title}</h3>
                    <p className="text-sm text-gray-500">Terapeuta</p>
                  </div>
                </div>

                {isConfirmed && (
                  <div className="mb-4">
                    <button
                      onClick={handleStartSession}
                      className="w-full bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 shadow-md"
                    >
                      <Video className="w-5 h-5" />
                      Iniciar Sessão
                    </button>
                    {hasMeetLink && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Link da videochamada:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-700 bg-white p-1.5 rounded flex-1 truncate">{appointment?.video_call_url}</code>
                          <button onClick={handleCopyLink} className="p-1.5 text-gray-500 hover:text-[#2F80D3]">
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        {copied && <p className="text-xs text-green-600 mt-1">✅ Link copiado!</p>}
                      </div>
                    )}
                  </div>
                )}

                {shouldShowPhone && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-medium text-blue-700">Contato do terapeuta</p>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">{therapistPhone}</p>
                    <p className="text-xs text-gray-500 mt-1">Para emergências ou remarcações urgentes</p>
                  </div>
                )}

                {isConfirmed && appointment?.id && (
                  <button
                    onClick={() => {
                      setSelectedAppointmentId(appointment.id);
                      setSelectedTherapistName(appointment.therapist?.full_name || "Terapeuta");
                      setSelectedSessionDate(formatDate(appointment.starts_at));
                      setShowComplaintModal(true);
                    }}
                    className="w-full bg-gradient-to-r from-[#E03673] to-[#E03673]/80 hover:from-[#c02c5e] hover:to-[#E03673] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 mt-2 shadow-md"
                  >
                    <MessageSquare className="w-5 h-5" />Registrar Queixa
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
                      selectedEvent.extendedProps?.status?.includes("cancelled") ? "bg-gray-100 text-gray-500" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {selectedEvent.extendedProps?.status === "confirmed" ? "Confirmada" :
                       selectedEvent.extendedProps?.status === "scheduled" ? "Agendada" :
                       selectedEvent.extendedProps?.status === "proposed" ? "Convite pendente" :
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
                    <button
                      onClick={handleRescheduleClick}
                      className="flex-1 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />Reagendar
                    </button>
                    <button
                      onClick={handleOpenCancelModal}
                      className="flex-1 bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 hover:from-[#d97706] hover:to-[#F59E0B] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-800">Reagendar sessão</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nova data</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Novo horário</label>
                      <select
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                      >
                        <option value="">Selecione</option>
                        {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleConfirmReschedule}
                        disabled={isLoading}
                        className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-2.5 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                        {isLoading ? 'Processando...' : 'Confirmar'}
                      </button>
                      <button onClick={handleCancelReschedule} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                <button onClick={() => setSelectedEvent(null)} className="w-full mt-4 text-center text-sm text-gray-400 hover:text-gray-600 py-2">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal cancelamento */}
        {showCancelConfirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              <div className="p-4 bg-[#FCE4EC] border-b border-[#E03673]/20">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-[#F59E0B]" />
                    <h3 className="text-lg font-semibold text-gray-900">Confirmar cancelamento</h3>
                  </div>
                  <button onClick={handleCloseCancelModal} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-5">
                <p className="text-gray-700 mb-2">
                  Tem certeza que deseja cancelar a sessão com <strong>{selectedEvent?.title}</strong>?
                </p>
                <p className="text-sm text-gray-500 mb-4">Esta ação não poderá ser desfeita.</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmCancel}
                    disabled={cancelling}
                    className="flex-1 bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 hover:from-[#d97706] hover:to-[#F59E0B] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                  </button>
                  <button onClick={handleCloseCancelModal} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium">
                    Não, voltar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>{`
          .fc .fc-button-primary { background-color: ${CORES.cinza} !important; border-color: ${CORES.cinzaBorda} !important; color: ${CORES.cinzaTexto} !important; transition: all 0.2s ease; }
          .fc .fc-button-primary:hover { background-color: ${CORES.rosa} !important; border-color: ${CORES.rosa} !important; color: ${CORES.branco} !important; }
          .fc .fc-button-active { background-color: ${CORES.rosa} !important; border-color: ${CORES.rosa} !important; color: ${CORES.branco} !important; }
          .fc .fc-prev-button, .fc .fc-next-button { background-color: ${CORES.cinza} !important; border-color: ${CORES.cinzaBorda} !important; color: ${CORES.cinzaTexto} !important; }
          .fc .fc-prev-button:hover, .fc .fc-next-button:hover { background-color: ${CORES.rosa} !important; border-color: ${CORES.rosa} !important; color: ${CORES.branco} !important; }
          .fc-day-today { background-color: ${CORES.rosaClaro} !important; }
          .fc-day-today .fc-daygrid-day-number { color: ${CORES.rosa} !important; font-weight: bold !important; }
          .fc-timegrid-col.fc-day-today { background-color: ${CORES.rosaClaro} !important; }
          .fc .fc-toolbar-title { font-size: 0.95rem !important; font-weight: 600 !important; }
          .fc .fc-timegrid-slot { height: 2.5rem !important; }
          .fc .fc-timegrid-slot-label { font-size: 0.7rem !important; color: #9ca3af !important; vertical-align: top !important; }
          .fc .fc-col-header-cell { font-size: 0.72rem !important; }
          .fc .fc-col-header-cell-cushion { padding: 3px 4px !important; font-weight: 600 !important; }
          .fc .fc-button { font-size: 0.75rem !important; padding: 3px 8px !important; }
          .fc .fc-toolbar { margin-bottom: 6px !important; }
        `}</style>
      </div>

      <ComplaintModal
        show={showComplaintModal}
        appointmentId={selectedAppointmentId || 0}
        therapistName={selectedTherapistName}
        sessionDate={selectedSessionDate}
        onClose={() => { setShowComplaintModal(false); setSelectedAppointmentId(null); setSelectedTherapistName(""); setSelectedSessionDate(""); }}
        onSuccess={() => { console.log("✅ Queixa salva com sucesso!"); }}
      />
    </>
  );
}