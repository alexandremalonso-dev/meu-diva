"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { Calendar, AlertCircle, ChevronRight, RefreshCw, User, CheckCircle, FileWarning, Clock } from "lucide-react";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { getFotoSrc } from '@/lib/utils';
import { RescheduleModal } from "../RescheduleModal";

type PendingReschedule = {
  id: number;
  patient_user_id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  patient_name?: string;
  patient_email?: string;
  patient_foto_url?: string;
};

const RESCHEDULE_STATUSES = [
  "cancelled_by_therapist",
  "cancelled_by_admin",
  "technical_issue",
  "therapist_conflict",
  "other"
];

const STATUS_LABELS: Record<string, string> = {
  "cancelled_by_therapist": "Cancelado pelo terapeuta",
  "cancelled_by_admin":     "Cancelado pela plataforma",
  "technical_issue":        "Problemas na videochamada",
  "therapist_conflict":     "Conflito de agenda",
  "other":                  "Outros motivos"
};

// 🔥 Verifica se uma data expirou considerando 5 dias úteis (seg-sex)
function isExpired(dateStr: string): boolean {
  const sessionDate = new Date(dateStr);
  sessionDate.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let businessDays = 0;
  const cursor = new Date(sessionDate);

  while (cursor < now) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) { // ignora sábado e domingo
      businessDays++;
    }
    if (businessDays > 5) return true;
  }
  return false;
}

export function PendingReschedulesCard() {
  const { execute: apiCall } = useApi();
  const [pendings, setPendings] = useState<PendingReschedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { subscribe } = useRealtimeEvents();

  const [rescheduleModal, setRescheduleModal] = useState<{
    open: boolean;
    appointmentId: number;
    patientName: string;
    patientFotoUrl?: string;
    currentDate: string;
    currentTime: string;
    therapistId: number;
    reason: string;
  } | null>(null);

  async function loadPendings() {
    setLoading(true);
    try {
      const appointments = await apiCall({
        url: "/api/appointments/me/details",
        requireAuth: true
      });

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const result: PendingReschedule[] = appointments
        .filter((apt: any) => {
          const sessionDate = new Date(apt.starts_at);
          sessionDate.setHours(0, 0, 0, 0);
          // 🔥 Só mostra se: status correto + data passada + NÃO expirou (≤ 5 dias úteis)
          return (
            sessionDate < now &&
            RESCHEDULE_STATUSES.includes(apt.status) &&
            !isExpired(apt.starts_at)
          );
        })
        .map((apt: any) => ({
          id: apt.id,
          patient_user_id: apt.patient_user_id,
          therapist_user_id: apt.therapist_user_id,
          starts_at: apt.starts_at,
          ends_at: apt.ends_at,
          status: apt.status,
          patient_name: apt.patient?.full_name,
          patient_email: apt.patient?.email,
          patient_foto_url: apt.patient?.foto_url,
        }))
        .sort((a: PendingReschedule, b: PendingReschedule) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
        );

      setPendings(result);
      setError(false);
    } catch (err) {
      console.error("Erro ao carregar reagendamentos pendentes:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPendings();
    const u1 = subscribe('appointment.rescheduled', loadPendings);
    const u2 = subscribe('appointment.completed', loadPendings);
    return () => { u1(); u2(); };
  }, []);

  const handleRescheduleClick = (item: PendingReschedule) => {
    const date = new Date(item.starts_at);
    setRescheduleModal({
      open: true,
      appointmentId: item.id,
      patientName: item.patient_name || item.patient_email || `Paciente ${item.patient_user_id}`,
      patientFotoUrl: item.patient_foto_url,
      currentDate: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      currentTime: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      therapistId: item.therapist_user_id,
      reason: STATUS_LABELS[item.status] || "Cancelado"
    });
  };

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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
          <h3 className="text-lg font-semibold text-white">Sessões para Reagendamento</h3>
        </div>
        <p className="text-sm text-white/80">Erro ao carregar pendências</p>
        <button onClick={loadPendings} className="mt-2 text-sm text-white hover:underline flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileWarning className="w-5 h-5 text-white" />
              <h3 className="text-lg font-semibold text-white">Sessões para Reagendamento</h3>
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
              <p className="text-sm text-white/80">Nenhuma sessão pendente de reagendamento</p>
            </div>
          ) : (
            <>
              <p className="text-white/80 text-sm mb-4">
                Sessões canceladas que dão direito a reagendamento (expira em 5 dias úteis)
              </p>
              <div className="space-y-2 mb-4">
                {recentPendings.map((item) => {
                  const patientName = item.patient_name || item.patient_email || `Paciente ${item.patient_user_id}`;
                  const fotoUrl = getFotoUrl(item.patient_foto_url);
                  return (
                    <button key={item.id} onClick={() => handleRescheduleClick(item)}
                      className="w-full bg-white/20 rounded-lg p-3 hover:bg-white/30 transition-colors text-left">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-white/30 flex items-center justify-center">
                          {fotoUrl
                            ? <img src={fotoUrl} alt={patientName} className="h-full w-full object-cover" />
                            : <User className="w-5 h-5 text-white/80" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{patientName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Calendar className="w-3 h-3 text-white/70" />
                            <p className="text-xs text-white/70">{formatDate(item.starts_at)} às {formatTime(item.starts_at)}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-white/70 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 ml-12">
                        <Clock className="w-3 h-3 text-white/60" />
                        <span className="text-xs bg-yellow-500/30 px-2 py-0.5 rounded-full text-white/90">
                          {STATUS_LABELS[item.status] || item.status}
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
            <span>{pendingCount === 0 ? "Ver agenda" : "Reagendar sessões"}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {rescheduleModal?.open && (
        <RescheduleModal
          isOpen={rescheduleModal.open}
          onClose={() => setRescheduleModal(null)}
          onSuccess={() => { loadPendings(); window.dispatchEvent(new CustomEvent('appointmentRescheduled')); }}
          appointmentId={rescheduleModal.appointmentId}
          patientName={rescheduleModal.patientName}
          patientFotoUrl={rescheduleModal.patientFotoUrl}
          currentDate={rescheduleModal.currentDate}
          currentTime={rescheduleModal.currentTime}
          therapistId={rescheduleModal.therapistId}
          reason={rescheduleModal.reason}
        />
      )}
    </>
  );
}