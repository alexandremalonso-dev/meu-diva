"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Video, Clock, User, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada", confirmed: "Confirmada", proposed: "Convite pendente",
  completed: "Realizada", cancelled_by_patient: "Cancelada (paciente)",
  cancelled_by_therapist: "Cancelada", rescheduled: "Reagendada",
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#D1FAE5", text: "#065F46" },
  confirmed: { bg: "#DBEAFE", text: "#1E40AF" },
  proposed: { bg: "#FEF3C7", text: "#92400E" },
  completed: { bg: "#F3F4F6", text: "#374151" },
  rescheduled: { bg: "#FFEDD5", text: "#9A3412" },
};

function getStatusStyle(s: string) {
  if (s.includes("cancelled")) return { bg: "#FEE2E2", text: "#991B1B" };
  return STATUS_COLOR[s] || { bg: "#F3F4F6", text: "#374151" };
}

function fmt(iso: string) {
  const d = new Date(iso);
  return { date: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }), time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) };
}

function getPhotoSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

export default function TerapeutaSessoesPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const [rescheduleApt, setRescheduleApt] = useState<any>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await api("/api/appointments/me/details");
      setAppointments(data || []);
    } catch (e: any) { setError("Erro ao carregar sessões."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = appointments.filter(a => new Date(a.starts_at) > now && !a.status.includes("cancelled") && a.status !== "completed").sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const completed = appointments.filter(a => a.status === "completed" || new Date(a.starts_at) < now).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const list = tab === "upcoming" ? upcoming : completed;

  const handleCancel = async (id: number) => {
    setConfirmCancel(null); setActionLoading(id);
    try {
      await api(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelled_by_therapist" }) });
      setSuccess("Sessão cancelada."); setTimeout(() => setSuccess(""), 3000); await load();
    } catch (e: any) { setError(e.message || "Erro ao cancelar."); }
    finally { setActionLoading(null); }
  };

  const handleReschedule = async () => {
    if (!rescheduleApt || !rescheduleDate || !rescheduleTime) { setError("Preencha data e hora."); return; }
    setActionLoading(rescheduleApt.id);
    try {
      const startsAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`);
      const duration = Math.round((new Date(rescheduleApt.ends_at).getTime() - new Date(rescheduleApt.starts_at).getTime()) / 60000);
      const endsAt = new Date(startsAt.getTime() + duration * 60000);
      await api(`/api/appointments/${rescheduleApt.id}/reschedule`, { method: "POST", body: JSON.stringify({ therapist_user_id: rescheduleApt.therapist_user_id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), duration_minutes: duration }) });
      setRescheduleApt(null); setRescheduleDate(""); setRescheduleTime("");
      setSuccess("Sessão reagendada!"); setTimeout(() => setSuccess(""), 3000); await load();
    } catch (e: any) { setError(e.message || "Erro ao reagendar."); }
    finally { setActionLoading(null); }
  };

  const isJoinable = (apt: any) => {
    const diffMin = (new Date(apt.starts_at).getTime() - now.getTime()) / 60000;
    return apt.status === "confirmed" && diffMin <= 15 && diffMin >= -60;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Minhas Sessões</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Gerencie suas sessões com pacientes</div>
      </div>

      <div style={{ background: "white", display: "flex", borderBottom: "1px solid #E5E7EB" }}>
        {[{ key: "upcoming", label: `Próximas (${upcoming.length})` }, { key: "completed", label: `Realizadas (${completed.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flex: 1, padding: "14px 0", border: "none", background: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", color: tab === t.key ? COLORS.primary : "#6B7280", borderBottom: tab === t.key ? `2px solid ${COLORS.primary}` : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>
        ) : list.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <Calendar size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>{tab === "upcoming" ? "Nenhuma sessão futura" : "Nenhuma sessão realizada"}</div>
            {tab === "upcoming" && <button onClick={() => router.push("/mobile/terapeuta-convites")} style={{ marginTop: 12, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Convidar paciente</button>}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(apt => {
              const { date, time } = fmt(apt.starts_at);
              const statusStyle = getStatusStyle(apt.status);
              const patient = apt.patient;
              const photo = getPhotoSrc(patient?.foto_url);
              const joinable = isJoinable(apt);
              const cancellable = ["scheduled", "confirmed"].includes(apt.status) && new Date(apt.starts_at) > now;
              const reschedulable = ["scheduled", "confirmed"].includes(apt.status) && new Date(apt.starts_at) > now;
              return (
                <div key={apt.id} style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
                  <div style={{ background: COLORS.primary + "08", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #E5E7EB" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}><Calendar size={12} /> {date} <Clock size={12} style={{ marginLeft: 4 }} /> {time}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: statusStyle.bg, color: statusStyle.text }}>{STATUS_LABEL[apt.status] || apt.status}</span>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{patient?.full_name || apt.patient_name || "Paciente"}</div>
                        {patient?.email && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{patient.email}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary }}>{Number(apt.session_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {joinable && <button onClick={() => router.push(`/mobile/videochamada/${apt.id}`)} style={{ flex: 1, minWidth: 100, background: COLORS.secondary, color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Video size={14} /> Iniciar</button>}
                      {reschedulable && <button onClick={() => { setRescheduleApt(apt); setRescheduleDate(""); setRescheduleTime(""); }} style={{ flex: 1, minWidth: 100, background: "white", color: COLORS.secondary, border: `1px solid ${COLORS.secondary}`, borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><RefreshCw size={14} /> Reagendar</button>}
                      {cancellable && <button onClick={() => setConfirmCancel(apt.id)} disabled={actionLoading === apt.id} style={{ flex: 1, minWidth: 100, background: "white", color: "#DC2626", border: "1px solid #DC2626", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading === apt.id ? 0.5 : 1 }}>{actionLoading === apt.id ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> Cancelar</>}</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirmCancel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: COLORS.dark }}>Cancelar sessão?</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>O valor será estornado para o paciente.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => handleCancel(confirmCancel)} style={{ flex: 1, background: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {rescheduleApt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: COLORS.dark }}>Reagendar sessão</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>{rescheduleApt.patient?.full_name || "Paciente"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Data</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} min={new Date().toISOString().split("T")[0]} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
              <div><label style={{ fontSize: 12, color: "#6B7280", marginBottom: 4, display: "block" }}>Horário</label>
                <input type="time" value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, outline: "none", boxSizing: "border-box" as const }} /></div>
            </div>
            {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRescheduleApt(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleReschedule} disabled={!!actionLoading} style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading ? 0.5 : 1 }}>
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
