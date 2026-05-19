"use client";

import { useState, useEffect } from 'react';
import { X, Calendar, Clock, Loader2, AlertCircle, CalendarPlus, CheckCircle, Clock3 } from 'lucide-react';
import { useApi } from '@/lib/useApi';

interface ReagendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: number;
  therapistUserId: number;
  onSuccess?: () => void;
}

interface AvailableSlot {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
}

export function ReagendamentoModal({
  isOpen,
  onClose,
  appointmentId,
  therapistUserId,
  onSuccess
}: ReagendamentoModalProps) {
  const { execute: apiCall } = useApi();
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [showSlotsPicker, setShowSlotsPicker] = useState(false);
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ date: string; time: string } | null>(null);

  useEffect(() => {
    if (isOpen && therapistUserId) {
      loadTherapistProfile();
    }
  }, [isOpen, therapistUserId]);

  const loadTherapistProfile = async () => {
    try {
      const profile = await apiCall({ url: "/api/therapists/me/profile", requireAuth: true });
      setTherapistProfileId(profile.id);
      return profile.id;
    } catch (error) {
      console.error("Erro ao carregar perfil do terapeuta:", error);
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
    setError(null);
    try {
      const data = await apiCall({
        url: `/public/terapeutas/${profileId}/slots?days=30`,
        requireAuth: true
      });
      setAvailableSlots(data.slots || []);
      setShowSlotsPicker(true);
    } catch (err: any) {
      setError('Não foi possível carregar os horários sugeridos');
    } finally {
      setLoadingSlots(false);
    }
  };

  const formatDateTime = (dateTimeStr: string) => {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleSelectSuggestedSlot = (slot: AvailableSlot) => {
    const date = new Date(slot.starts_at);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    setCustomDate(`${year}-${month}-${day}`);
    setCustomTime(`${hours}:${minutes}`);
    setSelectedSlot(slot.starts_at);
    setShowSlotsPicker(false);
  };

  const handleSubmit = async () => {
    setError(null);

    // 🔥 CORRIGIDO: manual sempre livre — só precisa de data+hora
    if (!customDate || !customTime) {
      setError('Por favor, preencha data e horário');
      setLoading(false);
      return;
    }

    setLoading(true);

    const newDateTime = new Date(`${customDate}T${customTime}:00`);
    const duration = selectedSlot
      ? (availableSlots.find(s => s.starts_at === selectedSlot)?.duration_minutes || 50)
      : 50;

    const endsAt = new Date(newDateTime);
    endsAt.setMinutes(endsAt.getMinutes() + duration);

    try {
      await apiCall({
        url: `/api/appointments/${appointmentId}/reschedule`,
        method: 'POST',
        body: {
          starts_at: newDateTime.toISOString(),
          ends_at: endsAt.toISOString(),
          duration_minutes: duration,
          force: true
        },
        requireAuth: true
      });

      window.dispatchEvent(new Event("appointmentRescheduled"));
      setSuccessInfo({
        date: newDateTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: newDateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      });
      setShowSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao reagendar sessão');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NOVO: reagendar depois — mantém no pendentes sem confirmar horário
  const handleReagendarDepois = () => {
    onClose();
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onSuccess?.();
    onClose();
  };

  const reset = () => {
    setShowSuccess(false);
    setSuccessInfo(null);
    setError(null);
    setCustomDate('');
    setCustomTime('');
    setSelectedSlot('');
    setAvailableSlots([]);
    setShowSlotsPicker(false);
  };

  if (!isOpen) return null;

  if (showSuccess && successInfo) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full shadow-xl overflow-hidden">
          <div className="p-6 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Sessão reagendada!</h3>
            <p className="text-gray-500 mb-1">A sessão foi reagendada para:</p>
            <p className="text-lg font-bold text-[#2F80D3] mb-1">{successInfo.date}</p>
            <p className="text-lg font-bold text-[#2F80D3] mb-6">às {successInfo.time}</p>
            <p className="text-xs text-gray-400 mb-6">
              O paciente e o terapeuta serão notificados por e-mail.
            </p>
            <button onClick={handleSuccessClose} className="w-full bg-[#E03673] hover:bg-[#c02c5e] text-white py-3 rounded-xl font-medium transition-colors">
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-[#E03673] to-[#c02c5e] text-white flex justify-between items-center">
          <h3 className="text-lg font-semibold">Reagendar Sessão</h3>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-gray-600 mb-4">
            Selecione um novo horário para reagendar esta sessão:
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Botão horários sugeridos */}
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

          {/* Slot selecionado da lista */}
          {selectedSlot && (
            <div className="mb-4 p-2 bg-[#FCE4EC] border border-[#E03673]/30 rounded-lg flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Horário sugerido selecionado: <strong>{formatDateTime(selectedSlot)}</strong>
              </p>
              <button onClick={() => { setSelectedSlot(''); setCustomDate(''); setCustomTime(''); }} className="text-xs text-[#E03673] hover:underline ml-2">
                Limpar
              </button>
            </div>
          )}

          {/* Picker de slots */}
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
                    <p className="text-center text-gray-500 py-8">Nenhum horário disponível nas próximas semanas.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {availableSlots.slice(0, 30).map((slot, idx) => (
                        <button key={idx} onClick={() => handleSelectSuggestedSlot(slot)}
                          className="p-3 bg-gray-100 hover:bg-[#FCE4EC] rounded-lg text-center transition-colors border border-gray-200 hover:border-[#E03673]">
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
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">ou digite manualmente</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* 🔥 Campos manuais SEMPRE visíveis e livres */}
          <div className="space-y-3 mb-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data
              </label>
              <input
                type="date"
                value={customDate}
                onChange={(e) => { setCustomDate(e.target.value); setSelectedSlot(''); setError(null); }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Horário
              </label>
              <input
                type="time"
                value={customTime}
                onChange={(e) => { setCustomTime(e.target.value); setSelectedSlot(''); setError(null); }}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              />
            </div>
            <p className="text-xs text-gray-400">* Verifique se o horário está disponível na agenda do terapeuta</p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between gap-3">
          {/* 🔥 NOVO: Reagendar depois — mantém no pendentes */}
          <button
            onClick={handleReagendarDepois}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm transition-colors"
            title="Fechar e reagendar mais tarde"
          >
            <Clock3 className="w-4 h-4" />
            Reagendar depois
          </button>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !customDate || !customTime}
              className="px-4 py-2 bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Reagendando...</>
              ) : (
                'Confirmar Reagendamento'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}