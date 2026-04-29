"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { User, Calendar, Clock, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Therapist = {
  id: number;
  user_id: number;
  bio?: string;
  session_price?: number;
  user?: { full_name?: string; email: string };
  foto_url?: string;
};

type Patient = {
  id: number;
  full_name?: string;
  email?: string;
  foto_url?: string;
};

type Appointment = {
  id: number;
  therapist_user_id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  rescheduled_from_id?: number;
  therapist?: Therapist;
  patient?: Patient;
};

const ACTIVE_STATUSES = ["scheduled", "confirmed", "proposed"];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [selectedTherapist, setSelectedTherapist] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [duration, setDuration] = useState("50");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState<Record<number, string>>({});
  const [rescheduleTime, setRescheduleTime] = useState<Record<number, string>>({});
  const [rescheduleDuration, setRescheduleDuration] = useState<Record<number, string>>({});

  // 🔥 Função para obter URL correta da foto
  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    if (fotoUrl.startsWith('http')) return fotoUrl;
    return getFotoSrc(fotoUrl) ?? "";
  };

  // Carregar appointments com detalhes
  async function loadAppointments() {
    try {
      const data = await api("/api/appointments/me/details");
      setAppointments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar appointments:", error);
    }
  }

  // Carregar terapeutas com fotos
  async function loadTherapists() {
    try {
      const data = await api("/api/therapists");
      setTherapists(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar terapeutas:", error);
    }
  }

  useEffect(() => {
    loadAppointments();
    loadTherapists();
  }, []);

  // Criar nova sessão
  async function createAppointment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!selectedTherapist || !selectedDate || !selectedTime) {
        throw new Error("Preencha todos os campos");
      }

      const dateTimeStr = `${selectedDate}T${selectedTime}:00`;
      const startsAt = new Date(dateTimeStr);
      
      if (isNaN(startsAt.getTime())) {
        throw new Error("Data ou hora inválida");
      }

      if (startsAt < new Date()) {
        throw new Error("A data da sessão deve ser futura");
      }
      
      const endsAt = new Date(startsAt.getTime() + Number(duration) * 60000);

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_user_id: Number(selectedTherapist),
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: Number(duration)
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.detail || `Erro ${response.status}`);
      }

      setSuccess("Sessão criada com sucesso!");
      setSelectedDate("");
      setSelectedTime("");
      setSelectedTherapist("");
      loadAppointments();
    } catch (err: any) {
      console.error("❌ Erro:", err);
      setError(err.message || "Erro ao criar sessão");
    } finally {
      setLoading(false);
    }
  }

  // Cancelar sessão
  async function cancelAppointment(id: number) {
    setError("");
    setSuccess("");

    const cancelStatus = user?.role === "admin" ? "cancelled_by_admin" :
                         user?.role === "therapist" ? "cancelled_by_therapist" :
                         "cancelled_by_patient";

    try {
      const response = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: cancelStatus })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || `Erro ${response.status}`);
      }

      setSuccess("Sessão cancelada com sucesso!");
      loadAppointments();
    } catch (err: any) {
      console.error("Erro ao cancelar:", err);
      setError(err.message || "Erro ao cancelar sessão");
    }
  }

  // Reagendar sessão
  async function rescheduleAppointment(appointment: Appointment) {
    const newDate = rescheduleDate[appointment.id];
    const newTime = rescheduleTime[appointment.id];
    const newDuration = rescheduleDuration[appointment.id] || "50";

    if (!newDate || !newTime) {
      setError("Preencha data e hora para reagendar");
      return;
    }

    try {
      const dateTimeStr = `${newDate}T${newTime}:00`;
      const startsAt = new Date(dateTimeStr);
      const endsAt = new Date(startsAt.getTime() + Number(newDuration) * 60000);

      const response = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_user_id: appointment.therapist_user_id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: Number(newDuration)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error(`Horário já ocupado. Escolha outro horário.`);
        }
        throw new Error(data.detail || data.error || `Erro ${response.status}`);
      }

      setSuccess("Sessão reagendada com sucesso!");
      setRescheduleDate({});
      setRescheduleTime({});
      setRescheduleDuration({});
      loadAppointments();
    } catch (err: any) {
      console.error("❌ Erro no reagendamento:", err);
      setError(err.message || "Erro ao reagendar");
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("pt-BR");
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string; icon: any }> = {
      scheduled: { cls: "bg-green-100 text-green-700", label: "Agendada", icon: <Calendar className="w-3 h-3" /> },
      confirmed: { cls: "bg-blue-100 text-blue-700", label: "Confirmada", icon: <CheckCircle className="w-3 h-3" /> },
      proposed: { cls: "bg-yellow-100 text-yellow-700", label: "Convite", icon: <Clock className="w-3 h-3" /> },
      completed: { cls: "bg-gray-100 text-gray-700", label: "Realizada", icon: <CheckCircle className="w-3 h-3" /> },
      rescheduled: { cls: "bg-orange-100 text-orange-700", label: "Reagendada", icon: <AlertCircle className="w-3 h-3" /> },
      cancelled_by_patient: { cls: "bg-red-100 text-red-700", label: "Cancelada (paciente)", icon: <XCircle className="w-3 h-3" /> },
      cancelled_by_therapist: { cls: "bg-red-100 text-red-700", label: "Cancelada (terapeuta)", icon: <XCircle className="w-3 h-3" /> },
    };
    const s = map[status] || { cls: "bg-gray-100 text-gray-700", label: status, icon: null };
    return <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${s.cls}`}>{s.icon}{s.label}</span>;
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => i).flatMap(hour => [
    <option key={`${hour}:00`} value={`${hour.toString().padStart(2, '0')}:00`}>
      {`${hour.toString().padStart(2, '0')}:00`}
    </option>,
    <option key={`${hour}:30`} value={`${hour.toString().padStart(2, '0')}:30`}>
      {`${hour.toString().padStart(2, '0')}:30`}
    </option>
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Sessões</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {typeof error === 'object' ? JSON.stringify(error) : error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Formulário de criar sessão */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-xl font-semibold mb-4">Criar sessão</h2>
        <form onSubmit={createAppointment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select
              value={selectedTherapist}
              onChange={(e) => setSelectedTherapist(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              required
            >
              <option value="">Selecione o terapeuta</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.user?.full_name || t.user?.email || `Terapeuta ${t.id}`}
                  {t.session_price && ` - R$ ${t.session_price}`}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              required
              min={new Date().toISOString().split('T')[0]}
            />

            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              required
            >
              <option value="">Selecione o horário</option>
              {timeOptions}
            </select>

            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="30">30 minutos</option>
              <option value="50">50 minutos</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-[#E03673] text-white px-6 py-2 rounded-lg hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : "Criar sessão"}
          </button>
        </form>
      </div>

      {/* Lista de sessões */}
      <div className="space-y-4">
        {appointments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhuma sessão encontrada.</p>
        ) : (
          appointments.map((appt) => {
            const therapistFotoUrl = getFotoUrl(appt.therapist?.foto_url);
            const patientFotoUrl = getFotoUrl(appt.patient?.foto_url);
            
            return (
              <div 
                key={appt.id} 
                id={`appointment-${appt.id}`}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-3">
                      {/* 🔥 Foto do terapeuta */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                          {therapistFotoUrl ? (
                            <img 
                              src={therapistFotoUrl} 
                              alt={appt.therapist?.user?.full_name || "Terapeuta"} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.parentElement) {
                                  e.currentTarget.parentElement.innerHTML = appt.therapist?.user?.full_name?.charAt(0).toUpperCase() || "T";
                                  e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                }
                              }}
                            />
                          ) : (
                            <span className="text-white text-xs font-bold">
                              {appt.therapist?.user?.full_name?.charAt(0).toUpperCase() || "T"}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {appt.therapist?.user?.full_name || `Terapeuta ${appt.therapist_user_id}`}
                        </span>
                      </div>
                      
                      <span className="text-gray-400">→</span>
                      
                      {/* 🔥 Foto do paciente */}
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                          {patientFotoUrl ? (
                            <img 
                              src={patientFotoUrl} 
                              alt={appt.patient?.full_name || "Paciente"} 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.parentElement) {
                                  e.currentTarget.parentElement.innerHTML = appt.patient?.full_name?.charAt(0).toUpperCase() || "P";
                                  e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                }
                              }}
                            />
                          ) : (
                            <span className="text-white text-xs font-bold">
                              {appt.patient?.full_name?.charAt(0).toUpperCase() || "P"}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {appt.patient?.full_name || `Paciente ${appt.patient_user_id}`}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                      <p><strong>Início:</strong> {formatDate(appt.starts_at)}</p>
                      <p><strong>Fim:</strong> {formatDate(appt.ends_at)}</p>
                      <p><strong>Status:</strong> {getStatusBadge(appt.status)}</p>
                    </div>
                  </div>

                  {ACTIVE_STATUSES.includes(appt.status) && (
                    <button
                      onClick={() => cancelAppointment(appt.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-red-600 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {/* Informações de reagendamento */}
                {appt.rescheduled_from_id && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      ⚠️ Esta sessão foi criada a partir do reagendamento da sessão #{appt.rescheduled_from_id}
                    </p>
                  </div>
                )}

                {appt.status === "rescheduled" && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-700">
                      🔄 Esta sessão foi reagendada.
                    </p>
                  </div>
                )}

                {/* Formulário de reagendamento - só para sessões ativas */}
                {ACTIVE_STATUSES.includes(appt.status) && (
                  <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="date"
                      value={rescheduleDate[appt.id] || ""}
                      onChange={(e) => setRescheduleDate({ ...rescheduleDate, [appt.id]: e.target.value })}
                      className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none"
                      placeholder="Data"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    
                    <select
                      value={rescheduleTime[appt.id] || ""}
                      onChange={(e) => setRescheduleTime({ ...rescheduleTime, [appt.id]: e.target.value })}
                      className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none"
                      required
                    >
                      <option value="">Hora</option>
                      {timeOptions}
                    </select>
                    
                    <select
                      value={rescheduleDuration[appt.id] || "50"}
                      onChange={(e) => setRescheduleDuration({ ...rescheduleDuration, [appt.id]: e.target.value })}
                      className="p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] outline-none"
                    >
                      <option value="30">30 min</option>
                      <option value="50">50 min</option>
                    </select>
                    
                    <button
                      onClick={() => rescheduleAppointment(appt)}
                      className="bg-[#2F80D3] text-white px-3 py-2 rounded-lg text-sm hover:bg-[#236bb3] transition-colors"
                    >
                      Reagendar
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}