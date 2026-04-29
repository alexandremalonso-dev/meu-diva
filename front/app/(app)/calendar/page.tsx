"use client";

import { useEffect, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, X, Clock, DollarSign, CheckCircle, Loader2, User } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

type Therapist = {
  id: number;
  user_id: number;
  bio?: string;
  session_price?: number;
  user?: { full_name?: string; email: string };
  foto_url?: string;
};

type Slot = {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 🔥 CORES
const CORES = {
  rosa: "#E03673",
  rosaClaro: "#FCE4EC",
  rosaEscuro: "#c02c5e",
  cinza: "#F3F4F6",
  cinzaBorda: "#E5E7EB",
  cinzaTexto: "#374151",
  branco: "#FFFFFF",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>("");
  const [selectedTherapistData, setSelectedTherapistData] = useState<Therapist | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // Carregar terapeutas
  useEffect(() => {
    async function loadTherapists() {
      try {
        const data = await api("/api/therapists");
        setTherapists(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao carregar terapeutas:", error);
      }
    }
    loadTherapists();
  }, []);

  // Atualizar dados do terapeuta selecionado
  useEffect(() => {
    if (selectedTherapist) {
      const therapist = therapists.find(t => t.id.toString() === selectedTherapist);
      setSelectedTherapistData(therapist || null);
    } else {
      setSelectedTherapistData(null);
    }
  }, [selectedTherapist, therapists]);

  // Carregar slots quando selecionar terapeuta
  useEffect(() => {
    if (!selectedTherapist) {
      setEvents([]);
      return;
    }

    async function loadSlots() {
      setLoading(true);
      setError("");

      try {
        console.log(`🔍 Buscando slots para terapeuta ${selectedTherapist}...`);

        const data = await api(`/api/calendar?therapistId=${selectedTherapist}&days=60`);

        // Converter slots para eventos do FullCalendar
        const calendarEvents = (data.slots || []).map((slot: Slot, index: number) => ({
          id: `slot-${index}`,
          title: "Disponível",
          start: slot.starts_at,
          end: slot.ends_at,
          backgroundColor: "#10b981",
          borderColor: "#059669",
          textColor: "white",
          extendedProps: {
            isAvailable: true,
            slotData: slot
          }
        }));

        setEvents(calendarEvents);
      } catch (err: any) {
        console.error("❌ Erro ao carregar slots:", err);
        setError(err.message || "Erro ao carregar horários");
      } finally {
        setLoading(false);
      }
    }

    loadSlots();
  }, [selectedTherapist]);

  // Manipulador de clique no evento
  const handleEventClick = (clickInfo: any) => {
    if (clickInfo.event.extendedProps?.isAvailable) {
      setSelectedSlot(clickInfo.event.extendedProps.slotData);
      setShowModal(true);
    }
  };

  // Agendar sessão
  const handleConfirmBooking = async () => {
    if (!selectedSlot || !selectedTherapist) return;

    setIsBooking(true);
    setError("");

    try {
      const response = await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          therapist_user_id: Number(selectedTherapist),
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
          duration_minutes: 50
        })
      });

      setSuccess("✅ Sessão agendada com sucesso!");
      setShowModal(false);
      setSelectedSlot(null);
      
      // Recarregar slots
      const slotsData = await api(`/api/calendar?therapistId=${selectedTherapist}&days=60`);
      const calendarEvents = (slotsData.slots || []).map((slot: Slot, index: number) => ({
        id: `slot-${index}`,
        title: "Disponível",
        start: slot.starts_at,
        end: slot.ends_at,
        backgroundColor: "#10b981",
        borderColor: "#059669",
        textColor: "white",
        extendedProps: {
          isAvailable: true,
          slotData: slot
        }
      }));
      setEvents(calendarEvents);
      
      setTimeout(() => setSuccess(""), 3000);
      
    } catch (err: any) {
      console.error("❌ Erro ao agendar:", err);
      setError(err.message || "Erro ao agendar sessão");
    } finally {
      setIsBooking(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("pt-BR"),
      time: date.toLocaleTimeString("pt-BR").slice(0, 5)
    };
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("pt-BR")} • ${startDate.toLocaleTimeString("pt-BR").slice(0,5)} - ${endDate.toLocaleTimeString("pt-BR").slice(0,5)}`;
  };

  const renderEventContent = (eventInfo: any) => {
    return {
      html: `<div class="w-full h-full flex items-center justify-center bg-green-500 text-white font-bold text-xs uppercase px-1 py-0.5 rounded">Disponível</div>`
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-8 h-8 text-[#E03673]" />
            Agendar Sessão
          </h1>
          <p className="text-gray-600 mt-2">Escolha um terapeuta e um horário disponível para sua sessão</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">
            ✅ {success}
          </div>
        )}

        {/* Seleção de terapeuta */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecione o terapeuta
          </label>
          <select
            value={selectedTherapist}
            onChange={(e) => setSelectedTherapist(e.target.value)}
            className="w-full md:w-96 p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
          >
            <option value="">Escolha um terapeuta</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.user?.full_name || t.user?.email || `Terapeuta ${t.id}`}
                {t.session_price && ` - R$ ${t.session_price.toFixed(2).replace('.', ',')}`}
              </option>
            ))}
          </select>
        </div>

        {/* Calendário FullCalendar */}
        {selectedTherapist && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500 mb-2">😕 Nenhum horário disponível</p>
                <p className="text-sm text-gray-400">
                  Este terapeuta não possui horários disponíveis no momento.
                </p>
              </div>
            ) : (
              <>
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                  }}
                  locale={ptBrLocale}
                  initialView="timeGridWeek"
                  slotMinTime="06:00:00"
                  slotMaxTime="23:00:00"
                  allDaySlot={false}
                  height={700}
                  events={events}
                  eventClick={handleEventClick}
                  eventContent={renderEventContent}
                  slotDuration="00:30:00"
                  snapDuration="00:30:00"
                  nowIndicator={true}
                  editable={false}
                  selectable={false}
                  dayMaxEvents={true}
                  weekends={true}
                  businessHours={{
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                    startTime: '06:00',
                    endTime: '23:00',
                  }}
                />
                
                {/* 🔥 ESTILOS PARA NAVEGAÇÃO ROSA */}
                <style>{`
                  .fc .fc-button-primary { 
                    background-color: ${CORES.cinza} !important; 
                    border-color: ${CORES.cinzaBorda} !important; 
                    color: ${CORES.cinzaTexto} !important; 
                    transition: all 0.2s ease; 
                  }
                  .fc .fc-button-primary:hover { 
                    background-color: ${CORES.rosa} !important; 
                    border-color: ${CORES.rosa} !important; 
                    color: ${CORES.branco} !important; 
                  }
                  .fc .fc-button-active { 
                    background-color: ${CORES.rosa} !important; 
                    border-color: ${CORES.rosa} !important; 
                    color: ${CORES.branco} !important; 
                  }
                  .fc .fc-today-button { 
                    background-color: ${CORES.cinza} !important; 
                    border-color: ${CORES.cinzaBorda} !important; 
                    color: ${CORES.cinzaTexto} !important; 
                  }
                  .fc .fc-today-button:hover { 
                    background-color: ${CORES.rosa} !important; 
                    border-color: ${CORES.rosa} !important; 
                    color: ${CORES.branco} !important; 
                  }
                  .fc .fc-prev-button, .fc .fc-next-button { 
                    background-color: ${CORES.cinza} !important; 
                    border-color: ${CORES.cinzaBorda} !important; 
                    color: ${CORES.cinzaTexto} !important; 
                  }
                  .fc .fc-prev-button:hover, .fc .fc-next-button:hover { 
                    background-color: ${CORES.rosa} !important; 
                    border-color: ${CORES.rosa} !important; 
                    color: ${CORES.branco} !important; 
                  }
                  /* 🔥 DIA ATUAL EM ROSA */
                  .fc-day-today { 
                    background-color: ${CORES.rosaClaro} !important; 
                  }
                  .fc-day-today .fc-daygrid-day-number { 
                    color: ${CORES.rosa} !important; 
                    font-weight: bold !important;
                  }
                  .fc-timegrid-col.fc-day-today { 
                    background-color: ${CORES.rosaClaro} !important; 
                  }
                `}</style>
              </>
            )}
          </div>
        )}

        {/* 🔥 MODAL DE CONFIRMAÇÃO */}
        {showModal && selectedSlot && selectedTherapistData && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
              {/* Header */}
              <div className="p-4 bg-[#FCE4EC] border-b border-[#E03673]/20">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#E03673]" />
                    <h3 className="text-lg font-semibold text-gray-900">Confirmar Agendamento</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedSlot(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-5">
                {/* Informações do terapeuta */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white font-bold text-lg">
                    {selectedTherapistData.foto_url ? (
                      <img 
                        src={getFotoSrc(selectedTherapistData.foto_url) ?? ""} 
                        alt={selectedTherapistData.user?.full_name || "Terapeuta"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {selectedTherapistData.user?.full_name || selectedTherapistData.user?.email || "Terapeuta"}
                    </h3>
                    {selectedTherapistData.session_price && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        R$ {selectedTherapistData.session_price.toFixed(2).replace('.', ',')} por sessão
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Informações da sessão */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {formatDateTime(selectedSlot.starts_at).date}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">
                      {formatDateTime(selectedSlot.starts_at).time} - {formatDateTime(selectedSlot.ends_at).time}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">
                      Duração: 50 minutos
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isBooking}
                    className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isBooking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {isBooking ? "Agendando..." : "Confirmar Agendamento"}
                  </button>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setSelectedSlot(null);
                    }}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}