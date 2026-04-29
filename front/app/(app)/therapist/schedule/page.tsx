"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Calendar, Loader2, AlertCircle, CheckCircle, FileText, ChevronRight, RefreshCw, XCircle, Video, Copy } from "lucide-react";
import { CalendarTherapist } from "@/components/calendar/CalendarTherapist";

type Appointment = {
  id: number;
  therapist_user_id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  session_price?: number;
  video_call_url?: string;
  therapist?: {
    id: number;
    email: string;
    full_name?: string;
    foto_url?: string;
  };
  patient?: {
    id: number;
    email: string;
    full_name?: string;
    foto_url?: string;
    phone?: string;
  };
};

export default function TherapistSchedulePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { openProntuario } = useSidebar();
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [showReschedule, setShowReschedule] = useState<Record<number, boolean>>({});
  const [rescheduleDate, setRescheduleDate] = useState<Record<number, string>>({});
  const [rescheduleTime, setRescheduleTime] = useState<Record<number, string>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  // Estados para o calendário
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Estados para filtros
  const [filterPatient, setFilterPatient] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showMonthFilter, setShowMonthFilter] = useState(false);

  // Opções de mês
  const monthOptions = [
    { value: "01", label: "JAN", full: "Janeiro" },
    { value: "02", label: "FEV", full: "Fevereiro" },
    { value: "03", label: "MAR", full: "Março" },
    { value: "04", label: "ABR", full: "Abril" },
    { value: "05", label: "MAI", full: "Maio" },
    { value: "06", label: "JUN", full: "Junho" },
    { value: "07", label: "JUL", full: "Julho" },
    { value: "08", label: "AGO", full: "Agosto" },
    { value: "09", label: "SET", full: "Setembro" },
    { value: "10", label: "OUT", full: "Outubro" },
    { value: "11", label: "DEZ", full: "Novembro" },
    { value: "12", label: "DEZ", full: "Dezembro" },
  ];

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    loadAllAppointments();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allAppointments, filterPatient, selectedMonths, filterStartDate, filterEndDate]);

  // 🔥 GERAR EVENTOS DO CALENDÁRIO
  useEffect(() => {
    const events = allAppointments
      .filter(apt => ["scheduled", "confirmed", "proposed", "completed", "rescheduled"].includes(apt.status))
      .map(apt => {
        let bgColor = "#3b82f6";
        if (apt.status === "proposed") bgColor = "#eab308";
        if (apt.status === "confirmed") bgColor = "#22c55e";
        if (apt.status === "scheduled") bgColor = "#3b82f6";
        if (apt.status === "completed") bgColor = "#9ca3af";
        if (apt.status === "rescheduled") bgColor = "#F59E0B";
        if (apt.status?.includes("cancelled")) bgColor = "#ef4444";
        
        return {
          id: apt.id,
          title: apt.patient?.full_name || apt.patient?.email || `Paciente ${apt.patient_user_id}`,
          start: apt.starts_at,
          end: apt.ends_at,
          backgroundColor: bgColor,
          borderColor: "#059669",
          textColor: "white",
          extendedProps: { 
            patient: apt.patient, 
            status: apt.status, 
            price: apt.session_price, 
            videoCallUrl: apt.video_call_url, 
            appointment: apt 
          }
        };
      });
    setCalendarEvents(events);
  }, [allAppointments]);

  const loadAllAppointments = async () => {
    try {
      const data = await api("/api/appointments/me/details");
      const therapistAppointments = data.filter(
        (apt: Appointment) => apt.therapist_user_id === user?.id
      );
      setAllAppointments(therapistAppointments);
      setFilteredAppointments(therapistAppointments);
    } catch (err) {
      setError("Erro ao carregar agenda");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allAppointments];

    if (filterPatient.trim()) {
      const searchTerm = filterPatient.toLowerCase().trim();
      filtered = filtered.filter(apt => 
        apt.patient?.full_name?.toLowerCase().includes(searchTerm) ||
        apt.patient?.email?.toLowerCase().includes(searchTerm)
      );
    }

    if (selectedMonths.length > 0) {
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.starts_at);
        const month = (aptDate.getMonth() + 1).toString().padStart(2, '0');
        const year = aptDate.getFullYear().toString();
        return selectedMonths.includes(month) && year === currentYear.toString();
      });
    }

    if (filterStartDate && filterEndDate) {
      const start = new Date(filterStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.starts_at);
        return aptDate >= start && aptDate <= end;
      });
    } else if (filterStartDate) {
      const start = new Date(filterStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filterStartDate);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.starts_at);
        return aptDate >= start && aptDate <= end;
      });
    } else if (filterEndDate) {
      const end = new Date(filterEndDate);
      end.setHours(23, 59, 59, 999);
      
      filtered = filtered.filter(apt => {
        const aptDate = new Date(apt.starts_at);
        return aptDate <= end;
      });
    }

    filtered.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    setFilteredAppointments(filtered);
  };

  const toggleMonth = (monthValue: string) => {
    setSelectedMonths(prev => 
      prev.includes(monthValue)
        ? prev.filter(m => m !== monthValue)
        : [...prev, monthValue]
    );
  };

  const clearFilters = () => {
    setFilterPatient("");
    setSelectedMonths([]);
    setFilterStartDate("");
    setFilterEndDate("");
    setShowDateFilter(false);
    setShowMonthFilter(false);
  };

  const handleCopyLink = (appointmentId: number, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(appointmentId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 🔥 ALTERADO: Redireciona para página embed do Jitsi
  const handleJoinMeet = async (appointment: Appointment) => {
    if (!appointment) return;
    
    let meetUrl = appointment.video_call_url;
    
    if (!meetUrl) {
      try {
        setActionLoading(prev => ({ ...prev, [appointment.id]: true }));
        const response = await fetch(`/api/meet/generate/${appointment.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        
        if (!response.ok) throw new Error("Erro ao gerar link");
        
        const data = await response.json();
        meetUrl = data.meet_link;
        loadAllAppointments();
      } catch (err: any) {
        setError(err.message);
        return;
      } finally {
        setActionLoading(prev => ({ ...prev, [appointment.id]: false }));
      }
    }
    
    // 🔥 ALTERADO: Redireciona para página embed (não abre nova aba)
    if (appointment.id) {
      router.push(`/therapist/videochamada/${appointment.id}`);
    }
    
    // 🔥 ABRIR SIDEBAR COM PRONTUÁRIO
    openProntuario(appointment.id);
  };

  // 🔥 FUNÇÃO PARA CANCELAR
  const handleCancel = async (id: number) => {
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      const response = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled_by_therapist" })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || data.error);
      }
      
      setSuccess("Sessão cancelada com sucesso!");
      setShowModal(false);
      setSelectedAppointment(null);
      loadAllAppointments();
      setTimeout(() => setSuccess(""), 3000);
      
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // 🔥 FUNÇÃO PARA REAGENDAR
  const handleReschedule = async (appointment: Appointment) => {
    const newDate = rescheduleDate[appointment.id];
    const newTime = rescheduleTime[appointment.id];
    
    if (!newDate || !newTime) {
      setError("Preencha data e hora para reagendar");
      return;
    }
    
    setActionLoading(prev => ({ ...prev, [appointment.id]: true }));
    
    try {
      const dateTimeStr = `${newDate}T${newTime}:00`;
      const startsAt = new Date(dateTimeStr);
      const originalDuration = Math.round(
        (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000
      );
      const endsAt = new Date(startsAt.getTime() + originalDuration * 60000);
      
      const response = await fetch(`/api/appointments/${appointment.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          therapist_user_id: appointment.therapist_user_id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: originalDuration
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || data.error);
      }
      
      setSuccess("Sessão reagendada com sucesso!");
      setShowReschedule({});
      setRescheduleDate({});
      setRescheduleTime({});
      setShowModal(false);
      setSelectedAppointment(null);
      loadAllAppointments();
      setTimeout(() => setSuccess(""), 3000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [appointment.id]: false }));
    }
  };

  const toggleReschedule = (id: number) => {
    setShowReschedule(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };

  const getStatusColor = (status: string) => {
    if (status === "scheduled") return "bg-green-100 text-green-800";
    if (status === "confirmed") return "bg-blue-100 text-blue-800";
    if (status === "proposed") return "bg-yellow-100 text-yellow-800";
    if (status === "rescheduled") return "bg-orange-100 text-orange-800";
    if (status.includes("cancelled")) return "bg-red-100 text-red-800";
    if (status === "completed") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  const getStatusText = (status: string) => {
    if (status === "scheduled") return "Agendada";
    if (status === "confirmed") return "Confirmada";
    if (status === "proposed") return "Convite pendente";
    if (status === "rescheduled") return "Reagendada";
    if (status === "cancelled_by_patient") return "Cancelada (paciente)";
    if (status === "cancelled_by_therapist") return "Cancelada (terapeuta)";
    if (status === "completed") return "Realizada";
    return status;
  };

  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* 🔥 CALENDÁRIO COM MODAL EMBUTIDO */}
        <CalendarTherapist 
          events={calendarEvents} 
          onEventClick={(apt) => {
            setSelectedAppointment(apt);
            setShowModal(true);
          }} 
          onSlotClick={undefined}
          onCancel={handleCancel}
          onJoinMeet={handleJoinMeet}
        />

        {/* Seção de Filtros */}
        <div className="bg-white rounded-lg shadow p-4 mb-6 mt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Paciente
              </label>
              <input
                type="text"
                value={filterPatient}
                onChange={(e) => setFilterPatient(e.target.value)}
                placeholder="Nome ou email..."
                className="w-full p-2 text-sm border rounded focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowMonthFilter(!showMonthFilter)}
                className={`px-4 py-2 text-sm border rounded flex items-center gap-2 ${
                  selectedMonths.length > 0 ? 'bg-[#E03673]/10 border-[#E03673]/30 text-[#E03673]' : 'bg-white'
                }`}
              >
                <span>📅</span>
                {selectedMonths.length > 0 ? `${selectedMonths.length} mês(es)` : "Mês"}
              </button>
              
              {showMonthFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMonthFilter(false)} />
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20 p-2">
                    <div className="text-xs font-medium text-gray-500 mb-2 px-2">{currentYear}</div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {monthOptions.map(month => (
                        <label key={month.value} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedMonths.includes(month.value)}
                            onChange={() => toggleMonth(month.value)}
                            className="h-4 w-4 text-[#E03673] rounded"
                          />
                          <span className="text-sm" title={month.full}>{month.label}</span>
                        </label>
                      ))}
                    </div>
                    {selectedMonths.length > 0 && (
                      <button onClick={() => setSelectedMonths([])} className="w-full mt-2 text-xs text-[#E03673] hover:text-[#c02c5e] text-center py-1 border-t">
                        Limpar seleção
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className={`px-4 py-2 text-sm border rounded flex items-center gap-2 ${
                  filterStartDate || filterEndDate ? 'bg-[#E03673]/10 border-[#E03673]/30 text-[#E03673]' : 'bg-white'
                }`}
              >
                <span>📆</span>
                Período
              </button>
              
              {showDateFilter && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateFilter(false)} />
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-20 p-4">
                    <h4 className="text-sm font-medium mb-3">Selecionar período</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Data inicial</label>
                        <input
                          type="date"
                          value={filterStartDate}
                          onChange={(e) => setFilterStartDate(e.target.value)}
                          className="w-full p-2 text-sm border rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Data final</label>
                        <input
                          type="date"
                          value={filterEndDate}
                          onChange={(e) => setFilterEndDate(e.target.value)}
                          min={filterStartDate}
                          className="w-full p-2 text-sm border rounded"
                        />
                      </div>
                      {(filterStartDate || filterEndDate) && (
                        <button onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }} className="w-full text-xs text-[#E03673] hover:text-[#c02c5e] text-center py-1">
                          Limpar período
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {(filterPatient || selectedMonths.length > 0 || filterStartDate || filterEndDate) && (
              <button onClick={clearFilters} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded" title="Limpar todos os filtros">
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Lista de sessões */}
        {filteredAppointments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">Nenhuma sessão encontrada</p>
            <p className="text-gray-400 mt-2">
              {allAppointments.length === 0 ? "Você ainda não tem sessões agendadas" : "Tente ajustar os filtros para ver mais resultados"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filteredAppointments.map((apt) => {
                const isConfirmed = apt.status === "confirmed" || apt.status === "scheduled" || apt.status === "rescheduled";
                const hasMeetLink = !!apt.video_call_url;
                
                return (
                  <div 
                    key={apt.id} 
                    className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedAppointment(apt);
                      setShowModal(true);
                    }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {apt.patient?.full_name || apt.patient?.email || "Paciente"}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span>{formatDate(apt.starts_at)}</span>
                          <span className="text-gray-300">•</span>
                          <span>R$ {apt.session_price?.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(apt.status)}`}>
                        {getStatusText(apt.status)}
                      </span>
                    </div>

                    {/* 🔥 4 BOTÕES LADO A LADO NA HORIZONTAL */}
                    {["scheduled", "confirmed", "rescheduled"].includes(apt.status) && (
                      <div className="flex flex-row gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
                        {/* 1. Prontuário - Abre Sidebar */}
                        <button
                          onClick={() => openProntuario(apt.id)}
                          className="flex-1 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 hover:from-[#c02c5e] hover:to-[#E03673] text-white py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Prontuário</span>
                        </button>

                        {/* 2. Reagendar - Azul */}
                        <button
                          onClick={() => toggleReschedule(apt.id)}
                          className="flex-1 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Reagendar
                        </button>

                        {/* 3. Cancelar - Vermelho */}
                        <button
                          onClick={() => handleCancel(apt.id)}
                          disabled={actionLoading[apt.id]}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {actionLoading[apt.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          Cancelar
                        </button>

                        {/* 4. Iniciar Sessão - Redireciona para página embed */}
                        <button
                          onClick={() => handleJoinMeet(apt)}
                          className="flex-1 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white py-2.5 rounded-lg font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        >
                          <Video className="w-4 h-4" />
                          <span>Iniciar</span>
                        </button>
                      </div>
                    )}

                    {/* 🔥 LINK DA VIDEOCHAMADA COM BOTÃO COPIAR */}
                    {isConfirmed && hasMeetLink && (
                      <div className="mt-3 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                        <div className="p-3 bg-[#F9F5FF] rounded-lg border border-gray-200">
                          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                            <span>🔗</span> Link da videochamada:
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-[#E03673] bg-white p-2 rounded-lg flex-1 truncate font-mono border border-gray-200">
                              {apt.video_call_url}
                            </code>
                            <button
                              onClick={() => handleCopyLink(apt.id, apt.video_call_url!)}
                              className="p-2 text-gray-500 hover:text-[#2F80D3] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                              title="Copiar link"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                          {copiedId === apt.id && (
                            <p className="text-xs text-green-600 mt-2 text-center">✅ Link copiado!</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Área de reagendamento expansível */}
                    {showReschedule[apt.id] && (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h4 className="font-medium">Reagendar sessão</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Nova data</label>
                            <input
                              type="date"
                              value={rescheduleDate[apt.id] || ""}
                              onChange={(e) => setRescheduleDate(prev => ({ ...prev, [apt.id]: e.target.value }))}
                              min={new Date().toISOString().split('T')[0]}
                              className="w-full p-2 border rounded focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium mb-1">Novo horário</label>
                            <select
                              value={rescheduleTime[apt.id] || ""}
                              onChange={(e) => setRescheduleTime(prev => ({ ...prev, [apt.id]: e.target.value }))}
                              className="w-full p-2 border rounded focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                            >
                              <option value="">Selecione</option>
                              {timeOptions.map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReschedule(apt)}
                            disabled={actionLoading[apt.id]}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading[apt.id] ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Confirmar"}
                          </button>
                          <button
                            onClick={() => toggleReschedule(apt.id)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}