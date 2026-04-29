"use client";

import React, { useState, useEffect } from 'react';
import type { Patient } from '../../types';
import { Calendar, Clock, Send, Loader2, User, Star, CalendarPlus, X } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { getFotoSrc } from '@/lib/utils';

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AvailableSlot = {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
};

interface InviteFormProps {
  show: boolean;
  patients: Patient[];
  quickPatient: string;
  quickDate: string;
  quickTime: string;
  quickLoading: boolean;
  duration: number;
  onDurationChange: (value: number) => void;
  timeOptions: React.ReactNode[];
  onPatientChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onSendInvite: () => void;
}

export function InviteForm({
  show,
  patients,
  quickPatient,
  quickDate,
  quickTime,
  quickLoading,
  duration,
  onDurationChange,
  timeOptions,
  onPatientChange,
  onDateChange,
  onTimeChange,
  onSendInvite
}: InviteFormProps) {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const [therapistProfileId, setTherapistProfileId] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showSlotsPicker, setShowSlotsPicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // 🔥 CARREGAR PERFIL DO TERAPEUTA
  useEffect(() => {
    if (show && user?.id) {
      loadTherapistProfile();
    }
  }, [show, user?.id]);

  const loadTherapistProfile = async () => {
    try {
      const profile = await apiCall({
        url: "/api/therapists/me/profile",
        requireAuth: true
      });
      setTherapistProfileId(profile.id);
    } catch (error) {
      console.error("Erro ao carregar perfil do terapeuta:", error);
    }
  };

  // 🔥 CARREGAR HORÁRIOS SUGERIDOS
  const loadSuggestedSlots = async () => {
    if (!therapistProfileId) return;
    
    setLoadingSlots(true);
    try {
      const data = await apiCall({
        url: `/public/terapeutas/${therapistProfileId}/slots?days=30`,
        requireAuth: true
      });
      setAvailableSlots(data.slots || []);
      setShowSlotsPicker(true);
    } catch (error) {
      console.error("Erro ao carregar horários sugeridos:", error);
    } finally {
      setLoadingSlots(false);
    }
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

  const handleSelectSuggestedSlot = (slot: AvailableSlot) => {
    const date = new Date(slot.starts_at);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    onDateChange(`${year}-${month}-${day}`);
    onTimeChange(`${hours}:${minutes}`);
    setSelectedSlot(slot);
    setShowSlotsPicker(false);
  };

  const selectedPatient = patients.find(p => p.id.toString() === quickPatient);
  const fotoUrl = selectedPatient?.foto_url ? `${BACKEND_URL}${selectedPatient.foto_url}` : null;

  if (!show) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-8">
      {/* Cabeçalho */}
      <div className="p-4 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Enviar convite para paciente</h3>
        </div>
        <p className="text-sm text-white/80 mt-1">Selecione paciente, data e horário para agendar uma nova sessão</p>
      </div>
      
      {/* Conteúdo */}
      <div className="p-5">
        {/* Paciente selecionado com foto */}
        {selectedPatient && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center">
              {fotoUrl ? (
                <img 
                  src={fotoUrl} 
                  alt={selectedPatient.full_name || "Paciente"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <p className="text-sm text-gray-500">Paciente selecionado</p>
              <p className="font-medium text-gray-900 flex items-center gap-1">
                {selectedPatient.full_name || selectedPatient.email}
                {selectedPatient.is_frequent && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
              </p>
              {selectedPatient.session_count > 0 && (
                <p className="text-xs text-gray-400">{selectedPatient.session_count} sessão(ões) realizada(s)</p>
              )}
            </div>
          </div>
        )}
        
        {/* 🔥 BOTÃO PARA VER HORÁRIOS SUGERIDOS */}
        {therapistProfileId && (
          <button
            onClick={loadSuggestedSlots}
            disabled={loadingSlots}
            className="w-full mb-4 bg-[#2F80D3] hover:bg-[#236bb3] text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loadingSlots ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando horários...
              </>
            ) : (
              <>
                <CalendarPlus className="w-4 h-4" />
                Ver horários sugeridos
              </>
            )}
          </button>
        )}
        
        {/* 🔥 MODAL DE HORÁRIOS SUGERIDOS */}
        {showSlotsPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white">
                <div className="flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5" />
                  <h3 className="text-lg font-semibold">Horários sugeridos</h3>
                </div>
                <button
                  onClick={() => setShowSlotsPicker(false)}
                  className="p-1.5 text-white hover:text-gray-200 transition-colors"
                >
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
                        onClick={() => handleSelectSuggestedSlot(slot)}
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
                <button
                  onClick={() => setShowSlotsPicker(false)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Formulário */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Seleção de paciente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <User className="w-4 h-4 text-[#E03673]" />
              Paciente
            </label>
            <select
              value={quickPatient}
              onChange={(e) => onPatientChange(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
            >
              <option value="">Selecione o paciente</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || p.email} {p.is_frequent ? "⭐" : ""} ({p.session_count} sessões)
                </option>
              ))}
            </select>
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Calendar className="w-4 h-4 text-[#E03673]" />
              Data
            </label>
            <input
              type="date"
              value={quickDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Horário */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4 text-[#E03673]" />
              Horário
            </label>
            <select
              value={quickTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
            >
              <option value="">Selecione o horário</option>
              {timeOptions}
            </select>
          </div>

          {/* Duração */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Clock className="w-4 h-4 text-[#E03673]" />
              Duração
            </label>
            <select
              value={duration}
              onChange={(e) => onDurationChange(Number(e.target.value))}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
            >
              <option value={30}>30 minutos</option>
              <option value={50}>50 minutos</option>
            </select>
          </div>
        </div>
        
        {/* Botão enviar */}
        <div className="mt-5">
          <button
            onClick={onSendInvite}
            disabled={quickLoading || !quickPatient || !quickDate || !quickTime}
            className="w-full bg-[#E03673] hover:bg-[#c02c5e] text-white py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {quickLoading ? (
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
  );
}