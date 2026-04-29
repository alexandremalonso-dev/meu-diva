"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/contexts/SidebarContext';
import type { Appointment, Patient, SessionFilter } from '../../types';
import { getFotoSrc } from '@/lib/utils';
import {
  User, Star, Calendar, Video, RefreshCw, XCircle, Clock,
  AlertCircle, CheckCircle, Copy, ArrowUp, ArrowDown,
  FileText, ChevronDown, ChevronUp, Zap
} from 'lucide-react';

interface SessionsListProps {
  appointments: Appointment[];
  sessionFilter: SessionFilter;
  frequentPatients: Patient[];
  showReschedule: Record<number, boolean>;
  actionLoading: Record<number, boolean>;
  timeOptions: React.ReactNode[];
  onToggleReschedule: (id: number) => void;
  onCancel: (id: number) => void;
  onReschedule: (apt: Appointment) => void;
  onRescheduleDateChange: (id: number, value: string) => void;
  onRescheduleTimeChange: (id: number, value: string) => void;
  onClearFilter: () => void;
  formatDate: (date: string) => string;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
  onJoinMeet?: (appointment: Appointment) => void;
  onRegisterProntuario?: (appointmentId: number) => void;
  userRole?: 'therapist' | 'patient';
}

export function SessionsList({
  appointments,
  sessionFilter,
  frequentPatients,
  showReschedule,
  actionLoading,
  timeOptions,
  onToggleReschedule,
  onCancel,
  onReschedule,
  onRescheduleDateChange,
  onRescheduleTimeChange,
  onClearFilter,
  formatDate,
  getStatusColor,
  getStatusText,
  onJoinMeet,
  onRegisterProntuario,
  userRole = 'therapist'
}: SessionsListProps) {

  const router = useRouter();
  const { openProntuario, openQueixa } = useSidebar();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const getFotoUrl = (fotoUrl?: string) => getFotoSrc(fotoUrl) ?? null;

  const handleCopyLink = (apt: Appointment) => {
    if (apt.video_call_url) {
      navigator.clipboard.writeText(apt.video_call_url);
      setCopiedId(apt.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleStartSession = (apt: Appointment) => {
    const role = userRole === 'therapist' ? 'therapist' : 'patient';
    if (apt.id) router.push(`/${role}/videochamada/${apt.id}`);
    if (userRole === 'therapist') openProntuario(apt.id);
    else openQueixa(apt.id);
  };

  const filterUpcomingOnly = (apts: Appointment[]) => {
    const now = new Date();
    return apts.filter(apt => {
      const aptDate = new Date(apt.starts_at);
      return ['confirmed', 'scheduled', 'rescheduled'].includes(apt.status) && aptDate >= now;
    });
  };

  const sortByDate = (apts: Appointment[]) =>
    [...apts].sort((a, b) => {
      const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      return sortOrder === 'asc' ? diff : -diff;
    });

  const sorted = sortByDate(filterUpcomingOnly(appointments));

  const grouped: Record<string, Appointment[]> = {};
  sorted.forEach(apt => {
    const dateKey = new Date(apt.starts_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(apt);
  });

  const isToday = (dateStr: string) => {
    const today = new Date();
    const d = new Date(dateStr);
    return d.toDateString() === today.toDateString();
  };

  const isTomorrow = (dateStr: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return new Date(dateStr).toDateString() === tomorrow.toDateString();
  };

  const getDateLabel = (dateStr: string) => {
    if (isToday(dateStr)) return "Hoje";
    if (isTomorrow(dateStr)) return "Amanhã";
    return dateStr;
  };

  const getDaysUntil = (dateStr: string) => {
    const now = new Date();
    const d = new Date(dateStr);
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return null;
    if (diff === 1) return "amanhã";
    return `em ${diff} dias`;
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">Nenhuma sessão futura</p>
        <p className="text-sm text-gray-400 mt-1">Aguarde agendamentos dos seus pacientes</p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{sorted.length}</span> {sorted.length === 1 ? 'sessão agendada' : 'sessões agendadas'}
        </p>
        <button
          onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {sortOrder === 'asc' ? 'Mais próximas' : 'Mais distantes'}
        </button>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([dateLabel, apts]) => (
          <div key={dateLabel}>
            {/* Separador de data */}
            <div className="flex items-center gap-3 mb-3">
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isToday(apts[0].starts_at)
                  ? 'bg-[#E03673] text-white'
                  : isTomorrow(apts[0].starts_at)
                  ? 'bg-[#2F80D3] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {getDateLabel(dateLabel)}
              </div>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">{apts.length === 1 ? '1 sessão' : `${apts.length} sessões`}</span>
            </div>

            {/* Grid de cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {apts.map(apt => {
                const patient = apt.patient;
                const patientName = patient?.full_name || patient?.email || `Paciente ${apt.patient_user_id}`;
                const fotoUrl = getFotoUrl(patient?.foto_url);
                const isConfirmed = ['confirmed', 'scheduled'].includes(apt.status);
                const hasBeenRescheduled = !!apt.rescheduled_from_id;
                const hasMeetLink = !!apt.video_call_url;
                const isExpanded = expandedId === apt.id;
                const time = new Date(apt.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const daysUntil = getDaysUntil(apt.starts_at);
                const isFrequent = frequentPatients.some(p => p.id === apt.patient_user_id);

                return (
                  <div key={apt.id}
                    className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                      isToday(apt.starts_at)
                        ? 'border-[#E03673]/30 shadow-md shadow-[#E03673]/10'
                        : 'border-gray-100 shadow-sm hover:shadow-md'
                    }`}>

                    <div className={`h-1.5 w-full ${
                      isToday(apt.starts_at) ? 'bg-gradient-to-r from-[#E03673] to-[#fb8811]' :
                      isTomorrow(apt.starts_at) ? 'bg-gradient-to-r from-[#2F80D3] to-[#49CCD4]' :
                      'bg-gradient-to-r from-gray-200 to-gray-100'
                    }`} />

                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-br from-[#2F80D3]/20 to-[#E03673]/20 flex-shrink-0 flex items-center justify-center">
                          {fotoUrl
                            ? <img src={fotoUrl} alt={patientName} className="w-full h-full object-cover" />
                            : <User className="w-5 h-5 text-[#2F80D3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{patientName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500 font-medium">{time}</span>
                            {daysUntil && <span className="text-xs text-gray-400">· {daysUntil}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(apt.status)}`}>
                            {getStatusText(apt.status)}
                          </span>
                          {isFrequent && (
                            <div className="flex items-center gap-0.5">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs text-yellow-600">frequente</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botões principais */}
                      {isConfirmed && (
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => {
                              openProntuario(apt.id);
                              onRegisterProntuario?.(apt.id);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#E03673] hover:bg-[#c02c5e] text-white text-xs font-semibold rounded-xl transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Prontuário
                          </button>
                          <button
                            onClick={() => handleStartSession(apt)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-semibold rounded-xl transition-colors"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Iniciar
                          </button>
                        </div>
                      )}

                      {/* Link da videochamada */}
                      {isConfirmed && hasMeetLink && (
                        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl mb-2">
                          <p className="text-xs text-gray-400 truncate flex-1 font-mono">
                            {apt.video_call_url?.substring(0, 40)}...
                          </p>
                          <button onClick={() => handleCopyLink(apt)}
                            className="text-gray-400 hover:text-[#2F80D3] transition-colors flex-shrink-0">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      {copiedId === apt.id && (
                        <p className="text-xs text-green-600 text-center mb-2">✅ Link copiado!</p>
                      )}

                      {/* Expandir cancelar/reagendar */}
                      {isConfirmed && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                          className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isExpanded ? 'Menos opções' : 'Cancelar ou reagendar'}
                        </button>
                      )}

                      {isExpanded && isConfirmed && (
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => onCancel(apt.id)}
                              disabled={actionLoading[apt.id]}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 text-xs rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3 h-3" />
                              Cancelar
                            </button>
                            <button
                              onClick={() => onToggleReschedule(apt.id)}
                              disabled={hasBeenRescheduled}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-[#2F80D3]/30 text-[#2F80D3] hover:bg-blue-50 text-xs rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Reagendar
                            </button>
                          </div>

                          {showReschedule[apt.id] && !hasBeenRescheduled && (
                            <div className="space-y-2 pt-1">
                              <input
                                type="date"
                                onChange={e => onRescheduleDateChange(apt.id, e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#E03673] outline-none"
                                min={new Date().toISOString().split('T')[0]}
                              />
                              <select
                                onChange={e => onRescheduleTimeChange(apt.id, e.target.value)}
                                className="w-full p-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#E03673] outline-none"
                              >
                                <option value="">Selecione o horário</option>
                                {timeOptions}
                              </select>
                              <button
                                onClick={() => onReschedule(apt)}
                                disabled={actionLoading[apt.id]}
                                className="w-full py-2 bg-green-500 hover:bg-green-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Confirmar reagendamento
                              </button>
                            </div>
                          )}

                          {hasBeenRescheduled && (
                            <p className="text-xs text-orange-500 text-center flex items-center justify-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Esta sessão já foi reagendada
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}