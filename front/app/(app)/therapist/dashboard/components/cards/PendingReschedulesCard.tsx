"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { useSidebar } from "@/contexts/SidebarContext";
import { Calendar, AlertCircle, ChevronRight, RefreshCw, User, CheckCircle, FileWarning, Clock } from "lucide-react";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { getFotoSrc } from '@/lib/utils';

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type PendingMedicalRecord = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  patient_name?: string;
  patient_email?: string;
  patient_foto_url?: string;
  hasRecord: boolean;
};

export function PendingReschedulesCard() {
  const { execute: apiCall } = useApi();
  const { openProntuario } = useSidebar();
  const [pendings, setPendings] = useState<PendingMedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // 🔥 WebSocket para atualização em tempo real
  const { subscribe } = useRealtimeEvents();

  async function loadPendingMedicalRecords() {
    setLoading(true);
    try {
      const appointments = await apiCall({
        url: "/api/appointments/me/details",
        requireAuth: true
      });

      console.log("📋 Todas as sessões do terapeuta:", appointments.map((a: any) => ({
        id: a.id,
        status: a.status,
        starts_at: a.starts_at,
        patient: a.patient?.full_name,
        hasMedicalRecord: a.hasMedicalRecord
      })));

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const pendingRecords = [];

      for (const apt of appointments) {
        const sessionDate = new Date(apt.starts_at);
        sessionDate.setHours(0, 0, 0, 0);

        const isPastSession = sessionDate < now;
        if (!isPastSession) continue;

        const isValidStatus = ["confirmed", "scheduled"].includes(apt.status);
        if (!isValidStatus) continue;

        let hasRecord = false;
        try {
          const record = await apiCall({
            url: `/api/appointments/${apt.id}/medical-record`,
            requireAuth: true,
            silent: true
          });
          hasRecord = record && record.id ? true : false;
        } catch {
          hasRecord = false;
        }

        if (!hasRecord) {
          pendingRecords.push({
            id: apt.id,
            patient_user_id: apt.patient_user_id,
            therapist_user_id: apt.therapist_user_id,
            starts_at: apt.starts_at,
            ends_at: apt.ends_at,
            status: apt.status,
            patient_name: apt.patient?.full_name,
            patient_email: apt.patient?.email,
            patient_foto_url: apt.patient?.foto_url,
            hasRecord: false
          });
        }
      }

      pendingRecords.sort((a: any, b: any) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );

      console.log("📋 Sessões pendentes de prontuário:", pendingRecords.map((p: any) => ({
        id: p.id,
        patient: p.patient_name,
        date: p.starts_at,
        status: p.status
      })));

      setPendings(pendingRecords);
      setError(false);
    } catch (error) {
      console.error("Erro ao carregar pendências:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // 🔥 Escutar eventos de prontuário criado
  useEffect(() => {
    // Carregar dados iniciais
    loadPendingMedicalRecords();
    
    // Inscrever para eventos de prontuário criado
    const unsubscribe = subscribe('medical_record.created', (payload) => {
      console.log('🔔 Evento recebido: medical_record.created', payload);
      // Recarregar a lista de pendências
      loadPendingMedicalRecords();
    });
    
    // Também escutar eventos de sessão completada (pode afetar pendências)
    const unsubscribeAppointment = subscribe('appointment.completed', (payload) => {
      console.log('🔔 Evento recebido: appointment.completed', payload);
      loadPendingMedicalRecords();
    });
    
    return () => {
      unsubscribe();
      unsubscribeAppointment();
    };
  }, []);

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleOpenProntuario = (appointmentId: number) => {
    openProntuario(appointmentId, false);
  };

  const recentPendings = pendings.slice(0, 5);
  const pendingCount = pendings.length;

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-6 bg-white/30 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-white/30 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-white/30 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-white" />
          <h3 className="text-lg font-semibold text-white">Prontuários Pendentes</h3>
        </div>
        <p className="text-sm text-white/80">Erro ao carregar pendências</p>
        <button
          onClick={loadPendingMedicalRecords}
          className="mt-2 text-sm text-white hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FileWarning className="w-5 h-5 text-white" />
            <h3 className="text-lg font-semibold text-white">Prontuários Pendentes</h3>
          </div>
          {pendingCount > 0 && (
            <span className="bg-white text-[#2F80D3] text-xs font-bold px-2 py-1 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>

        {pendingCount === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CheckCircle className="w-5 h-5 text-white/80" />
            <p className="text-sm text-white/80">
              Nenhum prontuário pendente no momento
            </p>
          </div>
        ) : (
          <>
            <p className="text-white/80 text-sm mb-4">
              Sessões realizadas que ainda não tiveram o prontuário registrado
            </p>

            <div className="space-y-2 mb-4">
              {recentPendings.map((item) => {
                const patientName = item.patient_name || item.patient_email || `Paciente ${item.patient_user_id}`;
                const fotoUrl = getFotoUrl(item.patient_foto_url);

                return (
                  <button
                    key={item.id}
                    onClick={() => handleOpenProntuario(item.id)}
                    className="w-full bg-white/20 rounded-lg p-3 hover:bg-white/30 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-white/30 flex items-center justify-center">
                        {fotoUrl ? (
                          <img
                            src={fotoUrl}
                            alt={patientName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-white/80" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {patientName}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="w-3 h-3 text-white/70" />
                          <p className="text-xs text-white/70">
                            {formatDate(item.starts_at)} às {formatTime(item.starts_at)}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                    </div>

                    <div className="flex items-center gap-2 ml-12">
                      <Clock className="w-3 h-3 text-white/60" />
                      <span className="text-xs text-white/60">
                        Status: {item.status === "confirmed" ? "Confirmada" : "Agendada"}
                      </span>
                      <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded-full text-white/90">
                        Prontuário pendente
                      </span>
                    </div>
                  </button>
                );
              })}

              {pendingCount > 5 && (
                <p className="text-xs text-white/70 text-center pt-2">
                  + {pendingCount - 5} {pendingCount - 5 === 1 ? 'outra sessão pendente' : 'outras sessões pendentes'}
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-2 text-sm text-white/90 flex items-center justify-end gap-1">
          <span>{pendingCount === 0 ? "Ver agenda" : "Registrar prontuários"}</span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}