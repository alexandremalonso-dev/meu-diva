"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getFotoSrc } from '@/lib/utils';
import Link from "next/link";
import { 
  Mail, 
  User, 
  Calendar, 
  Clock, 
  Send, 
  XCircle, 
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronRight,
  Star,
  CheckCircle,
  CalendarPlus,
  X,
  Users
} from "lucide-react";

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Invite = {
  id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  patient_name?: string;
  patient_email?: string;
  patient_foto_url?: string;
};

type Patient = {
  id: number;
  full_name: string;
  email: string;
  foto_url?: string;
};

type AvailableSlot = {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
};

export default function TherapistInvitesPage() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  
  // 🔥 ESTADOS DO MODAL DE AGENDAMENTO RÁPIDO
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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ patientName: string; date: string; time: string } | null>(null);
  const [showSlotsPicker, setShowSlotsPicker] = useState(false);

  useEffect(() => {
    loadInvites();
    loadPatients();
    loadTherapistProfile();
  }, []);

  async function loadInvites() {
    try {
      const data = await api("/api/invites/me");
      console.log("📨 Convites carregados:", data);
      setInvites(Array.isArray(data) ? data : []);
      setError(null);
    } catch (error) {
      console.error("Erro ao carregar convites:", error);
      setError("Erro ao carregar convites");
    } finally {
      setLoading(false);
    }
  }

  async function loadPatients() {
    setLoadingPatients(true);
    try {
      const data = await api("/api/patients");
      setPatients(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar pacientes:", error);
    } finally {
      setLoadingPatients(false);
    }
  }

  async function loadTherapistProfile() {
    try {
      const profile = await api("/api/therapists/me/profile");
      setTherapistProfileId(profile.id);
    } catch (error) {
      console.error("Erro ao carregar perfil do terapeuta:", error);
    }
  }

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  // 🔥 Função para verificar se o convite está pendente (proposed ou pending)
  const isPending = (status: string) => {
    return status === "pending" || status === "proposed";
  };

  async function handleCancelInvite(inviteId: number) {
    setActionLoading(prev => ({ ...prev, [inviteId]: true }));
    setError(null);
    setSuccess(null);
    
    try {
      await api(`/api/appointments/${inviteId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled_by_therapist" })
      });
      
      setSuccess("Convite cancelado com sucesso!");
      await loadInvites();
      
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (error) {
      console.error("Erro:", error);
      setError("Erro ao cancelar convite");
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionLoading(prev => ({ ...prev, [inviteId]: false }));
    }
  }

  // 🔥 ABRIR MODAL DE AGENDAMENTO RÁPIDO
  async function handleQuickBooking(patientId: number, patientName: string, patientFoto?: string) {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setSelectedPatientFoto(patientFoto || "");
    setShowBookingModal(true);
    setSelectedSlot(null);
    setCustomDate("");
    setCustomTime("");
    setUseCustomSlot(false);
    setShowSlotsPicker(false);
    
    if (!therapistProfileId) {
      await loadTherapistProfile();
    }
    
    setLoadingSlots(true);
    try {
      const data = await api(`/public/terapeutas/${therapistProfileId}/slots?days=30`);
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error("Erro ao carregar horários:", error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  // 🔥 ABRIR MODAL PARA NOVO PACIENTE
  async function handleNewInvite() {
    setSelectedPatientId(null);
    setSelectedPatientName("");
    setSelectedPatientFoto("");
    setShowBookingModal(true);
    setSelectedSlot(null);
    setCustomDate("");
    setCustomTime("");
    setUseCustomSlot(false);
    setShowSlotsPicker(false);
    setDuration(50);
    
    if (!therapistProfileId) {
      await loadTherapistProfile();
    }
    
    setLoadingSlots(true);
    try {
      const data = await api(`/public/terapeutas/${therapistProfileId}/slots?days=30`);
      setAvailableSlots(data.slots || []);
    } catch (error) {
      console.error("Erro ao carregar horários:", error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  // 🔥 ENVIAR CONVITE
  async function handleSendInvite() {
    setBookingLoading(true);
    setError(null);
    
    if (!selectedPatientId) {
      setError("Por favor, selecione um paciente");
      setBookingLoading(false);
      return;
    }
    
    let startsAt: Date | null = null;
    
    if (useCustomSlot) {
      if (!customDate || !customTime) {
        setError("Por favor, preencha data e horário");
        setBookingLoading(false);
        return;
      }
      startsAt = new Date(`${customDate}T${customTime}:00`);
    } else {
      if (!selectedSlot) {
        setError("Por favor, selecione um horário");
        setBookingLoading(false);
        return;
      }
      startsAt = new Date(selectedSlot.starts_at);
    }
    
    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + duration);
    
    try {
      await api("/api/invites", {
        method: "POST",
        body: JSON.stringify({
          patient_user_id: selectedPatientId,
          therapist_user_id: user?.id,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: duration
        })
      });
      
      setSuccessInfo({
        patientName: selectedPatientName,
        date: startsAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      });
      setShowSuccessModal(true);
      setShowBookingModal(false);
      await loadInvites();
      
    } catch (error: any) {
      console.error("Erro ao enviar convite:", error);
      setError(error.message || "Erro ao enviar convite");
    } finally {
      setBookingLoading(false);
    }
  }

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSuccessInfo(null);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // 🔥 Estatísticas considerando proposed como pendente
  const pendingCount = invites.filter(i => i.status === "pending" || i.status === "proposed").length;
  const acceptedCount = invites.filter(i => i.status === "accepted").length;
  const declinedCount = invites.filter(i => i.status === "declined").length;

  if (loading) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      {/* POPUP DE SUCESSO */}
      {showSuccessModal && successInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Convite enviado!</h3>
              <p className="text-gray-500 mb-1">Convite enviado para:</p>
              <p className="text-lg font-bold text-[#2F80D3] mb-1">{successInfo.patientName}</p>
              <p className="text-sm text-gray-600 mb-1">{successInfo.date}</p>
              <p className="text-sm text-gray-600 mb-6">às {successInfo.time}</p>
              <p className="text-xs text-gray-400 mb-6">
                O paciente receberá uma notificação por e-mail.
              </p>
              <button
                onClick={handleSuccessClose}
                className="w-full bg-[#E03673] hover:bg-[#c02c5e] text-white py-3 rounded-xl font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Convites Enviados</h1>
          </div>
          <button
            onClick={handleNewInvite}
            className="flex items-center gap-2 bg-[#E03673] hover:bg-[#c02c5e] text-white px-5 py-2.5 rounded-lg transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Novo Convite
          </button>
        </div>
        <p className="text-gray-600 mt-1">
          Gerencie os convites enviados para seus pacientes
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* 🔥 CARDS NA PALETA DO PROJETO */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{invites.length}</p>
            <p className="text-sm text-white/80">Total de convites</p>
          </div>
          <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{pendingCount}</p>
            <p className="text-sm text-white/80">Pendentes</p>
          </div>
          <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{acceptedCount}</p>
            <p className="text-sm text-white/80">Aceitos</p>
          </div>
          <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl p-4 text-white">
            <p className="text-2xl font-bold">{declinedCount}</p>
            <p className="text-sm text-white/80">Recusados</p>
          </div>
        </div>

        {invites.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <Send className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">Nenhum convite enviado ainda.</p>
            <button
              onClick={handleNewInvite}
              className="inline-flex items-center gap-2 bg-[#E03673] text-white px-6 py-2.5 rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              <CalendarPlus className="w-4 h-4" />
              Enviar primeiro convite
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => {
              const date = new Date(invite.starts_at);
              const formattedDate = date.toLocaleDateString('pt-BR');
              const formattedTime = date.toLocaleTimeString('pt-BR').slice(0,5);
              const patientName = invite.patient_name || invite.patient_email || `Paciente ${invite.patient_user_id}`;
              const fotoUrl = getFotoUrl(invite.patient_foto_url);
              
              // 🔥 Badge de status com suporte para proposed
              const getStatusBadge = () => {
                if (isPending(invite.status)) {
                  return <span className="inline-flex items-center gap-1 bg-[#E03673]/10 text-[#E03673] text-xs px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Aguardando</span>;
                }
                if (invite.status === "accepted") {
                  return <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Aceito</span>;
                }
                if (invite.status === "declined") {
                  return <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Recusado</span>;
                }
                return null;
              };
              
              return (
                <div key={invite.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center">
                          {fotoUrl ? (
                            <img 
                              src={fotoUrl} 
                              alt={patientName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {patientName}
                          </h3>
                          {getStatusBadge()}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-3 ml-14">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Data</p>
                            <p className="text-sm font-medium">{formattedDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Horário</p>
                            <p className="text-sm font-medium">{formattedTime} ({invite.duration_minutes} min)</p>
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-3 ml-14 flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        Enviado em {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      {/* 🔥 Botão Cancelar - apenas para pendentes (proposed ou pending) */}
                      {isPending(invite.status) && (
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          disabled={actionLoading[invite.id]}
                          className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          {actionLoading[invite.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {actionLoading[invite.id] ? "Cancelando..." : "Cancelar"}
                        </button>
                      )}
                      <button
                        onClick={() => handleQuickBooking(invite.patient_user_id, patientName, invite.patient_foto_url)}
                        className="px-4 py-2 text-sm bg-[#10B981] hover:bg-[#059669] text-white rounded-lg transition-colors flex items-center gap-1"
                      >
                        <CalendarPlus className="w-3 h-3" />
                        Nova sessão
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🔥 MODAL DE AGENDAMENTO RÁPIDO - ESTILO REAGENDAMENTO */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Enviar Novo Convite</h3>
                </div>
                <button
                  onClick={() => setShowBookingModal(false)}
                  className="p-1.5 text-white hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Selecionar paciente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paciente</label>
                {selectedPatientId ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center">
                      {selectedPatientFoto ? (
                        <img 
                          src={getFotoSrc(selectedPatientFoto) ?? ""}
                          alt={selectedPatientName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{selectedPatientName}</p>
                      <button
                        onClick={() => setSelectedPatientId(null)}
                        className="text-xs text-[#E03673] hover:underline"
                      >
                        Trocar paciente
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {loadingPatients ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 text-[#E03673] animate-spin" />
                      </div>
                    ) : patients.length === 0 ? (
                      <p className="p-4 text-center text-gray-500">Nenhum paciente encontrado</p>
                    ) : (
                      patients.map(patient => {
                        const fotoUrl = getFotoUrl(patient.foto_url);
                        return (
                          <button
                            key={patient.id}
                            onClick={() => {
                              setSelectedPatientId(patient.id);
                              setSelectedPatientName(patient.full_name);
                              setSelectedPatientFoto(patient.foto_url || "");
                            }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center">
                              {fotoUrl ? (
                                <img src={fotoUrl} alt={patient.full_name} className="h-full w-full object-cover" />
                              ) : (
                                <User className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{patient.full_name}</p>
                              <p className="text-xs text-gray-500">{patient.email}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              
              {/* Duração */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duração da sessão</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDuration(30)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      duration === 30
                        ? "bg-[#E03673] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    30 minutos
                  </button>
                  <button
                    onClick={() => setDuration(50)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      duration === 50
                        ? "bg-[#E03673] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    50 minutos
                  </button>
                </div>
              </div>
              
              {/* 🔥 HORÁRIOS SUGERIDOS - com botão para abrir picker */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="radio"
                    checked={!useCustomSlot}
                    onChange={() => setUseCustomSlot(false)}
                    className="h-4 w-4 text-[#E03673]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Usar horários sugeridos (próximas semanas)
                  </span>
                </label>
                
                {!useCustomSlot && (
                  <div className="ml-6">
                    <button
                      onClick={() => setShowSlotsPicker(true)}
                      className="w-full mb-2 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <CalendarPlus className="w-4 h-4" />
                      Ver horários disponíveis
                    </button>
                    
                    {selectedSlot && (
                      <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700 flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Horário selecionado: {formatDateTime(selectedSlot.starts_at)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Opção manual */}
              <div>
                <label className="flex items-center gap-2 mb-3">
                  <input
                    type="radio"
                    checked={useCustomSlot}
                    onChange={() => setUseCustomSlot(true)}
                    className="h-4 w-4 text-[#E03673]"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Escolher data e horário manualmente
                  </span>
                </label>
                
                {useCustomSlot && (
                  <div className="ml-6 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Data</label>
                      <input
                        type="date"
                        value={customDate}
                        onChange={(e) => setCustomDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Horário</label>
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Rodapé */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowBookingModal(false)}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendInvite}
                disabled={bookingLoading || !selectedPatientId || (!useCustomSlot && !selectedSlot) || (useCustomSlot && (!customDate || !customTime))}
                className="px-4 py-2 text-sm bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {bookingLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar convite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 MODAL DE SELEÇÃO DE HORÁRIOS */}
      {showSlotsPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Horários disponíveis</h3>
              </div>
              <button onClick={() => setShowSlotsPicker(false)} className="p-1.5 text-white hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {loadingSlots ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Nenhum horário disponível nas próximas semanas.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {availableSlots.slice(0, 30).map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setShowSlotsPicker(false);
                      }}
                      className="p-3 bg-gray-100 hover:bg-[#FCE4EC] rounded-lg text-center transition-colors border border-gray-200 hover:border-[#E03673]"
                    >
                      <p className="text-sm font-medium">{formatDateTime(slot.starts_at)}</p>
                      <p className="text-xs text-gray-500">{slot.duration_minutes} minutos</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button onClick={() => setShowSlotsPicker(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}