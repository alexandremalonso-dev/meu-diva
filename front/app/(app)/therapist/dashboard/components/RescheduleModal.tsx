"use client";

import { useState, useEffect } from "react";
import { X, Calendar, Clock, Loader2, AlertCircle, CheckCircle, ChevronRight, ChevronLeft, CalendarPlus } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointmentId: number;
  patientName: string;
  patientFotoUrl?: string;
  currentDate: string;
  currentTime: string;
  therapistUserId: number;
  reason: string;
}

interface AvailableSlot {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
}

export function RescheduleModal({
  isOpen,
  onClose,
  onSuccess,
  appointmentId,
  patientName,
  patientFotoUrl,
  currentDate,
  currentTime,
  therapistUserId,
  reason
}: RescheduleModalProps) {
  const { execute: apiCall } = useApi();
  const [step, setStep] = useState<"confirm" | "select" | "success">("confirm");
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState("");
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [showSlotsPicker, setShowSlotsPicker] = useState(false);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + 
           " às " + date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const loadTherapistProfile = async () => {
    try {
      const profile = await apiCall({
        url: "/api/therapists/me/profile",
        requireAuth: true
      });
      setTherapistProfileId(profile.id);
      return profile.id;
    } catch (error) {
      console.error("Erro ao carregar perfil do terapeuta:", error);
      setError("Não foi possível identificar o perfil do terapeuta");
      return null;
    }
  };

  const loadSuggestedSlots = async () => {
    let profileId = therapistProfileId;
    if (!profileId) {
      profileId = await loadTherapistProfile();
      if (!profileId) return;
    }

    setLoadingSlots(true);
    setError("");
    try {
      const data = await apiCall({
        url: `/public/terapeutas/${profileId}/slots?days=60`,
        requireAuth: true
      });
      setAvailableSlots(data.slots || []);
      setShowSlotsPicker(true);
    } catch (err: any) {
      console.error("Erro ao carregar horários:", err);
      setError("Erro ao carregar horários disponíveis");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    setSelectedSlot(slot);
    setCustomDate("");
    setCustomTime("");
    setShowSlotsPicker(false);
  };

  const handleReschedule = async () => {
    setError("");

    // 🔥 CORRIGIDO: validação independente — slot sugerido OU manual
    const hasSlot = !!selectedSlot;
    const hasManual = customDate.trim() !== "" && customTime.trim() !== "";

    if (!hasSlot && !hasManual) {
      setError("Selecione um horário sugerido ou preencha data e horário manualmente");
      return;
    }

    setLoading(true);

    let startsAt: Date;
    let duration = 50;

    if (hasSlot) {
      startsAt = new Date(selectedSlot!.starts_at);
      duration = selectedSlot!.duration_minutes || 50;
    } else {
      startsAt = new Date(`${customDate}T${customTime}:00`);
    }

    const endsAt = new Date(startsAt);
    endsAt.setMinutes(endsAt.getMinutes() + duration);

    try {
      await apiCall({
        url: `/api/appointments/${appointmentId}/reschedule`,
        method: "POST",
        body: {
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: duration
        },
        requireAuth: true
      });

      setStep("success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Erro ao reagendar sessão");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("confirm");
    setSelectedSlot(null);
    setCustomDate("");
    setCustomTime("");
    setError("");
    setShowSlotsPicker(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  // Etapa 3: Sucesso
  if (step === "success") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Sessão Reagendada!</h3>
            <p className="text-sm text-gray-600 mb-4">
              A sessão foi reagendada com sucesso. O paciente será notificado.
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Etapa 2: Selecionar horário
  if (step === "select") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2F80D3] to-[#E03673]/80 text-white">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <h3 className="text-lg font-semibold">Reagendar Sessão</h3>
            </div>
            <button onClick={handleClose} className="p-1.5 text-white hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-6 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Sessão original</p>
              <p className="text-sm font-medium text-gray-800">{currentDate} às {currentTime}</p>
              <p className="text-xs text-gray-500 mt-2">Paciente: {patientName}</p>
              <p className="text-xs text-gray-500">Motivo: {reason}</p>
            </div>

            {/* Horário sugerido selecionado */}
            {selectedSlot && (
              <div className="mb-4 p-3 bg-[#FCE4EC] border border-[#E03673]/30 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">Horário selecionado</p>
                  <p className="text-sm font-medium text-gray-800">{formatDateTime(selectedSlot.starts_at)}</p>
                </div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="text-xs text-[#E03673] hover:underline"
                >
                  Trocar
                </button>
              </div>
            )}

            {/* Botão ver horários sugeridos */}
            <button
              onClick={loadSuggestedSlots}
              disabled={loadingSlots}
              className="w-full mb-4 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loadingSlots ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Carregando horários...</>
              ) : (
                <><CalendarPlus className="w-4 h-4" />Ver horários sugeridos</>
              )}
            </button>

            {/* Picker de slots sugeridos */}
            {showSlotsPicker && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white">
                    <div className="flex items-center gap-2">
                      <CalendarPlus className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Horários sugeridos</h3>
                    </div>
                    <button onClick={() => setShowSlotsPicker(false)} className="p-1.5 text-white hover:text-gray-200">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5">
                    {availableSlots.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">
                        Nenhum horário disponível nas próximas semanas.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {availableSlots.slice(0, 30).map((slot, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectSlot(slot)}
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

            {/* Divisor */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou escolha manualmente</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* 🔥 Manual — sempre disponível, sem radio, sem dependência de selectedSlot */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Data
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => { setCustomDate(e.target.value); setSelectedSlot(null); setError(""); }}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Horário
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => { setCustomTime(e.target.value); setSelectedSlot(null); setError(""); }}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>
              <p className="text-xs text-gray-400">* Verifique se o horário está disponível na agenda do terapeuta</p>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={() => setStep("confirm")}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
            <button
              onClick={handleReschedule}
              disabled={loading || (!selectedSlot && (!customDate || !customTime))}
              className="px-4 py-2 text-sm bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {loading ? "Processando..." : "Confirmar reagendamento"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Etapa 1: Confirmação inicial
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2F80D3] to-[#E03673]/80 text-white">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Reagendar Sessão</h3>
          </div>
          <button onClick={handleClose} className="p-1.5 text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-8 h-8 text-yellow-600" />
            </div>
            <p className="text-gray-700 mb-2">
              Deseja reagendar a sessão de <strong>{currentDate} às {currentTime}</strong>?
            </p>
            <p className="text-sm text-gray-500">
              Paciente: <strong>{patientName}</strong>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Motivo: {reason}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-blue-700 flex items-start gap-2">
              <Calendar className="w-3 h-3 mt-0.5 flex-shrink-0" />
              O paciente será notificado sobre o novo horário após a confirmação.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => setStep("select")}
              className="flex-1 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors flex items-center justify-center gap-2"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}