"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { getFotoSrc } from '@/lib/utils';
import {
  Calendar, Loader2, User, Eye, CalendarPlus, Send,
  X, Search, ChevronLeft, ChevronRight, AlertCircle
} from "lucide-react";
import type { Appointment } from "../../dashboard/types";
import { ReagendamentoModal } from "@/components/Modals/ReagendamentoModal";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

type AvailableSlot = { starts_at: string; ends_at: string; duration_minutes: number };

export default function TherapistCompletedSessionsPage() {
  const { user } = useAuth();
  const { openProntuario } = useSidebar();
  const { execute: apiCall } = useApi();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filtered, setFiltered] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal de agendamento
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
  const [duration, setDuration] = useState(50);

  const loadTherapistProfile = useCallback(async () => {
    try {
      const profile = await apiCall({ url: "/api/therapists/me/profile", requireAuth: true });
      setTherapistProfileId(profile.id);
    } catch {}
  }, [apiCall]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await apiCall({ url: "/api/appointments/me/details", requireAuth: true });
      const completed = (data as Appointment[])
        .filter(a => a.therapist_user_id === user.id && a.status === "completed")
        .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      setAppointments(completed);
      setAvailableYears([...new Set<number>(completed.map(a => new Date(a.starts_at).getFullYear()))].sort((a,b) => b-a));
    } catch {
      setError("Erro ao carregar sessões realizadas");
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);

  useEffect(() => { loadTherapistProfile(); loadData(); }, [loadData, loadTherapistProfile]);

  // Filtragem reativa
  useEffect(() => {
    let f = [...appointments];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      f = f.filter(a => a.patient?.full_name?.toLowerCase().includes(t) || a.patient?.email?.toLowerCase().includes(t));
    }
    if (yearFilter) f = f.filter(a => new Date(a.starts_at).getFullYear() === parseInt(yearFilter));
    if (monthFilter) f = f.filter(a => new Date(a.starts_at).getMonth() === parseInt(monthFilter));
    if (startDate) f = f.filter(a => a.starts_at.split("T")[0] >= startDate);
    if (endDate) f = f.filter(a => a.starts_at.split("T")[0] <= endDate);
    setFiltered(f);
    setCurrentPage(1);
  }, [appointments, searchTerm, yearFilter, monthFilter, startDate, endDate]);

  const getFotoUrl = (url?: string) => url ? (url.startsWith("http") ? url : `${BACKEND_URL}${url}`) : null;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  const formatTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const formatDateTime = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const hasFilters = searchTerm || yearFilter || monthFilter || startDate || endDate;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const clearFilters = () => { setSearchTerm(""); setYearFilter(""); setMonthFilter(""); setStartDate(""); setEndDate(""); };

  async function handleQuickBooking(patientId: number, patientName: string, patientFoto?: string) {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setSelectedPatientFoto(patientFoto || "");
    setShowBookingModal(true);
    setSelectedSlot(null);
    setCustomDate(""); setCustomTime(""); setUseCustomSlot(false);
    if (!therapistProfileId) return;
    setLoadingSlots(true);
    try {
      const data = await apiCall({ url: `/public/terapeutas/${therapistProfileId}/slots?days=30`, requireAuth: true });
      setAvailableSlots(data.slots || []);
    } catch { setAvailableSlots([]); }
    finally { setLoadingSlots(false); }
  }

  async function handleSendInvite() {
    setBookingLoading(true);
    setError("");
    let startsAt: Date | null = null;
    if (useCustomSlot) {
      if (!customDate || !customTime) { setError("Preencha data e horário"); setBookingLoading(false); return; }
      startsAt = new Date(`${customDate}T${customTime}:00`);
    } else {
      if (!selectedSlot) { setError("Selecione um horário"); setBookingLoading(false); return; }
      startsAt = new Date(selectedSlot.starts_at);
    }
    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + duration);
    try {
      await apiCall({
        url: "/api/invites", method: "POST",
        body: { patient_user_id: selectedPatientId, therapist_user_id: user?.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: duration },
        requireAuth: true
      });
      setSuccess("Convite enviado com sucesso!");
      setShowBookingModal(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar convite");
    } finally { setBookingLoading(false); }
  }

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-6 h-6 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Sessões Realizadas</h1>
        </div>
        <p className="text-sm text-gray-600 mt-1">Visualize todas as sessões realizadas e seus prontuários</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        {success && <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200">✅ {success}</div>}

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Filtros</h3>
            {hasFilters && (
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar paciente</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Nome ou email..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <select value={yearFilter} onChange={e => { setYearFilter(e.target.value); setMonthFilter(""); setStartDate(""); setEndDate(""); }}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                <option value="">Todos os anos</option>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {yearFilter ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Todos os meses</option>
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">{appointments.length}</p>
            <p className="text-sm text-gray-500">Total realizadas</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            <p className="text-sm text-gray-500">Exibindo (filtro)</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
                .format(filtered.reduce((s, a) => s + (a.session_price || 0), 0))}
            </p>
            <p className="text-sm text-gray-500">Receita filtrada</p>
          </div>
        </div>

        {/* Tabela */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhuma sessão encontrada</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-3 border-b text-sm text-gray-500">
              {filtered.length} sessão{filtered.length !== 1 ? "ões" : ""}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                    <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                    <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                    <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginated.map(apt => {
                    const fotoUrl = getFotoUrl(apt.patient?.foto_url);
                    return (
                      <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-3">
                          <div className="text-sm font-medium text-gray-900">{formatDate(apt.starts_at)}</div>
                          <div className="text-xs text-gray-500">{formatTime(apt.starts_at)}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                              {fotoUrl
                                ? <img src={fotoUrl} alt="" className="w-full h-full object-cover" />
                                : <User className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{apt.patient?.full_name || "Paciente"}</p>
                              <p className="text-xs text-gray-500">{apt.patient?.email || ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-sm font-medium text-green-600">
                            {apt.session_price
                              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(apt.session_price)
                              : "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openProntuario(apt.id, true)}
                              title="Ver prontuário"
                              className="p-1.5 text-gray-400 hover:text-[#E03673] transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleQuickBooking(apt.patient_user_id, apt.patient?.full_name || "Paciente", apt.patient?.foto_url)}
                              title="Agendar nova sessão"
                              className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors">
                              <CalendarPlus className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 text-gray-500 disabled:opacity-50"><ChevronLeft className="w-5 h-5" /></button>
                <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 text-gray-500 disabled:opacity-50"><ChevronRight className="w-5 h-5" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de agendamento */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
              <div className="flex items-center gap-3">
                <CalendarPlus className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Agendar nova sessão</h3>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="p-1.5 text-white hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center">
                  {selectedPatientFoto
                    ? <img src={getFotoSrc(selectedPatientFoto) ?? ""} alt="" className="w-full h-full object-cover" />
                    : <User className="w-6 h-6 text-white" />}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Paciente</p>
                  <p className="font-medium text-gray-900">{selectedPatientName}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Duração</label>
                <div className="flex gap-3">
                  {[30, 50].map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${duration === d ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                      {d} minutos
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input type="radio" checked={!useCustomSlot} onChange={() => setUseCustomSlot(false)} className="h-4 w-4 text-[#E03673]" />
                  <span className="text-sm font-medium text-gray-700">Usar horários sugeridos</span>
                </label>
                {!useCustomSlot && (
                  <div className="ml-6">
                    {loadingSlots ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#E03673] animate-spin" /></div>
                    ) : availableSlots.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum horário disponível. <button onClick={() => setUseCustomSlot(true)} className="text-[#E03673] hover:underline">Agendar manualmente</button></p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                        {availableSlots.slice(0, 30).map((slot, idx) => (
                          <button key={idx} onClick={() => setSelectedSlot(slot)}
                            className={`p-2 rounded-lg text-xs transition-colors text-center ${selectedSlot?.starts_at === slot.starts_at ? "bg-[#E03673] text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                            {formatDateTime(slot.starts_at)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input type="radio" checked={useCustomSlot} onChange={() => setUseCustomSlot(true)} className="h-4 w-4 text-[#E03673]" />
                  <span className="text-sm font-medium text-gray-700">Escolher manualmente</span>
                </label>
                {useCustomSlot && (
                  <div className="ml-6 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Data</label>
                      <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Horário</label>
                      <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowBookingModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={handleSendInvite}
                disabled={bookingLoading || (!useCustomSlot && !selectedSlot) || (useCustomSlot && (!customDate || !customTime))}
                className="px-4 py-2 text-sm bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
                {bookingLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando...</> : <><Send className="w-4 h-4" />Enviar convite</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}