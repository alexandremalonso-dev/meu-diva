"use client";

import { useEffect, useState } from "react";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { api } from "@/lib/api";

// Configurar localizador para datas
const localizer = momentLocalizer(moment);
moment.locale("pt-BR");

type Therapist = {
  id: number;
  user_id: number;
  bio?: string;
  session_price?: number;
  user?: { full_name?: string; email: string };
};

type Slot = {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
};

export default function CalendarPage() {
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>("");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState(Views.WEEK);

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

  // Carregar slots quando selecionar terapeuta
  useEffect(() => {
    if (!selectedTherapist) return;

    async function loadSlots() {
      setLoading(true);
      setError("");
      
      try {
        console.log(`🔍 Buscando slots para terapeuta ${selectedTherapist}...`);
        
        const response = await fetch(`/api/calendar?therapistId=${selectedTherapist}&days=30`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Erro ${response.status}`);
        }
        
        const data = await response.json();
        console.log("📊 Slots recebidos:", data);

        // Converter slots para eventos do calendário
        const slotEvents = (data.slots || []).map((slot: Slot, index: number) => ({
          id: `slot-${index}-${slot.starts_at}`,
          title: "Disponível",
          start: new Date(slot.starts_at),
          end: new Date(slot.ends_at),
          resource: { type: "available", slot },
        }));

        setEvents(slotEvents);
        
      } catch (err: any) {
        console.error("❌ Erro ao carregar slots:", err);
        setError(err.message || "Erro ao carregar horários");
      } finally {
        setLoading(false);
      }
    }

    loadSlots();
  }, [selectedTherapist]);

  // Estilos customizados para os eventos
  const eventStyleGetter = (event: any) => {
    if (event.resource?.type === "available") {
      return {
        style: {
          backgroundColor: "#10b981",
          color: "white",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
        },
      };
    }
    return {};
  };

  // Agendar sessão
  async function bookAppointment() {
    if (!selectedSlot || !selectedTherapist) return;

    setError("");
    setSuccess("");

    try {
      console.log("📝 Agendando sessão:", {
        therapist: selectedTherapist,
        start: selectedSlot.start.toISOString(),
        end: selectedSlot.end.toISOString()
      });

      const response = await fetch("/api/appointments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          therapist_user_id: Number(selectedTherapist),
          starts_at: selectedSlot.start.toISOString(),
          ends_at: selectedSlot.end.toISOString(),
          duration_minutes: 50
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || `Erro ${response.status}`);
      }

      setSuccess("Sessão agendada com sucesso!");
      setShowModal(false);
      
      // Recarregar slots
      if (selectedTherapist) {
        const res = await fetch(`/api/calendar?therapistId=${selectedTherapist}&days=30`);
        const data = await res.json();
        const slotEvents = (data.slots || []).map((slot: Slot, index: number) => ({
          id: `slot-${index}-${slot.starts_at}`,
          title: "Disponível",
          start: new Date(slot.starts_at),
          end: new Date(slot.ends_at),
          resource: { type: "available", slot },
        }));
        setEvents(slotEvents);
      }
    } catch (err: any) {
      console.error("❌ Erro ao agendar:", err);
      setError(err.message || "Erro ao agendar sessão");
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Agenda do Terapeuta</h1>

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

      {/* Seleção de terapeuta */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione o terapeuta
        </label>
        <select
          value={selectedTherapist}
          onChange={(e) => setSelectedTherapist(e.target.value)}
          className="w-full md:w-96 p-2 border rounded focus:ring-2 focus:ring-black"
        >
          <option value="">Escolha um terapeuta</option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.user?.full_name || t.user?.email || `Terapeuta ${t.id}`}
              {t.session_price && ` - R$ ${t.session_price}`}
            </option>
          ))}
        </select>
      </div>

      {/* Calendário */}
      {selectedTherapist && (
        <div className="bg-white p-4 rounded-lg shadow">
          {loading ? (
            <p className="text-center py-8">Carregando agenda...</p>
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 700 }}
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
              defaultView={Views.WEEK}
              view={currentView}
              onView={setCurrentView}
              date={currentDate}
              onNavigate={setCurrentDate}
              step={30}
              timeslots={2}
              min={new Date(0, 0, 0, 6, 0, 0)}
              max={new Date(0, 0, 0, 22, 0, 0)}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event) => {
                setSelectedSlot(event);
                setShowModal(true);
              }}
              messages={{
                month: "Mês",
                week: "Semana",
                day: "Dia",
                today: "Hoje",
                previous: "Anterior",
                next: "Próximo",
                showMore: (count) => `+${count} mais`,
              }}
            />
          )}
        </div>
      )}

      {/* Modal de confirmação */}
      {showModal && selectedSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmar Agendamento</h3>
            
            <p className="mb-2">
              <strong>Data:</strong> {selectedSlot.start.toLocaleDateString("pt-BR")}
            </p>
            <p className="mb-2">
              <strong>Horário:</strong> {selectedSlot.start.toLocaleTimeString("pt-BR")} - {selectedSlot.end.toLocaleTimeString("pt-BR")}
            </p>
            <p className="mb-4">
              <strong>Duração:</strong> 50 minutos
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={bookAppointment}
                className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}