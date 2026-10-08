"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBRLocale from "@fullcalendar/core/locales/pt-br";
import { useState, useMemo } from "react";
import { Calendar, X, Clock, DollarSign, User, Users } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaClaro: "#FCE4EC",
  rosaEscuro: "#c02c5e",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

interface Appointment {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  video_call_url?: string;
  patient?: { id: number; full_name: string; email: string; foto_url?: string };
  therapist?: { id: number; full_name: string; email: string; foto_url?: string };
}

interface SlotGroup {
  start: string;
  end: string;
  count: number;
  appointments: Appointment[];
}

interface CalendarAdminProps {
  appointments: Appointment[];
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  proposed: "Convite pendente",
  completed: "Realizada",
  rescheduled: "Reagendada",
  cancelled_by_patient: "Cancelada (paciente)",
  cancelled_by_therapist: "Cancelada (terapeuta)",
  cancelled_by_admin: "Cancelada (admin)",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  proposed: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-800",
  rescheduled: "bg-orange-100 text-orange-800",
  cancelled_by_patient: "bg-red-100 text-red-800",
  cancelled_by_therapist: "bg-red-100 text-red-800",
  cancelled_by_admin: "bg-red-100 text-red-800",
};

function groupBySlot(appointments: Appointment[]): SlotGroup[] {
  const map = new Map<string, SlotGroup>();
  appointments
    .filter(apt => ["scheduled", "confirmed", "proposed", "completed", "rescheduled"].includes(apt.status))
    .forEach(apt => {
      const key = apt.starts_at;
      if (!map.has(key)) {
        map.set(key, { start: apt.starts_at, end: apt.ends_at, count: 0, appointments: [] });
      }
      const group = map.get(key)!;
      group.count++;
      group.appointments.push(apt);
    });
  return Array.from(map.values());
}

export function CalendarAdmin({ appointments }: CalendarAdminProps) {
  const [modalSlot, setModalSlot] = useState<SlotGroup | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ✅ Eventos agregados por horário — mesmo padrão de cores do CalendarTherapist
  const events = useMemo(() => {
    const groups = groupBySlot(appointments);
    return groups.map(group => {
      // Cor por volume de sessões
      let bgColor = CORES.azul;
      if (group.count >= 5) bgColor = CORES.rosa;
      else if (group.count >= 3) bgColor = "#f59e0b";

      return {
        id: group.start,
        title: `${group.count} sessão${group.count !== 1 ? "ões" : ""}`,
        start: group.start,
        end: group.end,
        backgroundColor: bgColor,
        borderColor: bgColor,
        textColor: CORES.branco,
        extendedProps: { group },
      };
    });
  }, [appointments]);

  const handleEventClick = (info: any) => {
    setModalSlot(info.event.extendedProps.group);
  };

  const hasEventsOutsideBusinessHours = () => {
    return appointments.some(apt => {
      const h = new Date(apt.starts_at).getHours();
      return h < 7 || h >= 19;
    });
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const totalRevenue = modalSlot?.appointments
    .filter(a => a.status === "completed")
    .reduce((s, a) => s + (a.session_price || 0), 0) || 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.message}
        </div>
      )}

      {/* Header — idêntico ao CalendarTherapist */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#E03673]" />
          <h2 className="text-lg font-semibold text-gray-900">Agenda da Plataforma</h2>
        </div>
        {/* Legenda de cores */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: CORES.azul }} />
            1–2
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#f59e0b" }} />
            3–4
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: CORES.rosa }} />
            5+
          </span>
        </div>
      </div>

      {/* FullCalendar — mesma config do CalendarTherapist */}
      <div className="h-auto">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={{ left: "prev,next", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay" }}
          buttonText={{ month: "Mês", week: "Semana", day: "Dia" }}
          locale={ptBRLocale}
          initialView="timeGridWeek"
          height="auto"
          events={events}
          slotMinTime="07:00:00"
          slotMaxTime="19:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          allDaySlot={false}
          expandRows={true}
          eventClick={handleEventClick}
          eventContent={(info) => ({
            html: `
              <div style="background-color:${info.event.backgroundColor};" class="p-1 text-xs text-white rounded truncate cursor-pointer hover:opacity-90 flex items-center gap-1">
                <div class="w-5 h-5 rounded-full overflow-hidden bg-white/30 flex-shrink-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <span class="truncate">${info.event.title}</span>
              </div>
            `
          })}
        />
      </div>

      {/* ✅ Modal com detalhes do slot — mesmo estilo do CalendarTherapist */}
      {modalSlot && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-xl overflow-hidden max-h-[85vh] flex flex-col">

            {/* Header rosa — igual ao CalendarTherapist */}
            <div className="p-4 bg-[#FCE4EC] border-b border-[#E03673]/20 flex-shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#E03673]" />
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 capitalize">{formatDate(modalSlot.start)}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(modalSlot.start)} – {formatTime(modalSlot.end)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalSlot(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Resumo do slot */}
              <div className="flex gap-3 mt-3">
                <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-3 py-1.5">
                  <Users className="w-4 h-4 text-[#E03673]" />
                  <span className="text-sm font-semibold text-gray-800">{modalSlot.count} sessão{modalSlot.count !== 1 ? "ões" : ""}</span>
                </div>
                {totalRevenue > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/70 rounded-lg px-3 py-1.5">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-gray-800">{formatCurrency(totalRevenue)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Lista de sessões */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {modalSlot.appointments.map(apt => (
                <div key={apt.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-3">

                    {/* Avatar terapeuta */}
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                      {apt.therapist?.foto_url
                        ? <img src={getFotoSrc(apt.therapist.foto_url) ?? ""} alt="" className="w-full h-full object-cover" />
                        : <span className="text-white font-bold text-sm">{(apt.therapist?.full_name || "T").charAt(0).toUpperCase()}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Terapeuta */}
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {apt.therapist?.full_name || `Terapeuta #${apt.therapist_user_id}`}
                      </p>
                      {/* Paciente */}
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3" />
                        {apt.patient?.full_name || `Paciente #${apt.patient_user_id}`}
                      </p>

                      {/* Status + valor */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[apt.status] || "bg-gray-100 text-gray-800"}`}>
                          {STATUS_LABELS[apt.status] || apt.status}
                        </span>
                        {apt.session_price && (
                          <span className="text-xs text-gray-500 flex items-center gap-0.5">
                            <DollarSign className="w-3 h-3" />
                            {formatCurrency(apt.session_price)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end flex-shrink-0">
              <button onClick={() => setModalSlot(null)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Estilos idênticos ao CalendarTherapist */}
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
  );
}