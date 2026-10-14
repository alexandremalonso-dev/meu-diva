"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, Video, Clock, User,
  CheckCircle, XCircle, AlertCircle, Loader2, Download, Mail
} from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  proposed: "Convite pendente",
  completed: "Realizada",
  cancelled_by_patient: "Cancelada",
  cancelled_by_therapist: "Cancelada (terapeuta)",
  cancelled_by_admin: "Cancelada (admin)",
  rescheduled: "Reagendada",
};

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  scheduled:   { bg: "#D1FAE5", text: "#065F46" },
  confirmed:   { bg: "#DBEAFE", text: "#1E40AF" },
  proposed:    { bg: "#FEF3C7", text: "#92400E" },
  completed:   { bg: "#F3F4F6", text: "#374151" },
  rescheduled: { bg: "#FFEDD5", text: "#9A3412" },
};

function getStatusStyle(status: string) {
  if (status.includes("cancelled")) return { bg: "#FEE2E2", text: "#991B1B" };
  return STATUS_COLOR[status] || { bg: "#F3F4F6", text: "#374151" };
}

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function getPhotoSrc(url: string | null): string {
  if (!url) return "/avatar-placeholder.png";
  if (url.startsWith("blob:") || url.startsWith("http")) return url;
  return `https://api.meudivaonline.com${url}`;
}

export default function MobileSessoesPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const [success, setSuccess] = useState("");
  const [receiptApt, setReceiptApt] = useState<any>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const downloadReceipt = (apt: any) => {
    const d = new Date(apt.starts_at);
    const content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Recibo - Meu Divã</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#333}.title{font-size:22px;font-weight:bold;color:#E03673;margin-bottom:8px}.row{margin:12px 0;padding:10px 0;border-bottom:1px solid #eee}.label{font-weight:bold;width:180px;display:inline-block}</style></head><body><div class="title">Declaração de Atendimento</div><p>Meu Divã - Plataforma de Teleterapia</p><div class="row"><span class="label">Terapeuta:</span><span>${apt.therapist?.full_name || "Terapeuta"}</span></div><div class="row"><span class="label">CRP:</span><span>${apt.therapist?.crp || "A definir"}</span></div><div class="row"><span class="label">Data:</span><span>${d.toLocaleDateString("pt-BR")}</span></div><div class="row"><span class="label">ID da sessão:</span><span>${apt.id}</span></div><p style="font-size:11px;color:#999;margin-top:40px">Este documento foi produzido com o fim exclusivo de atender às solicitações de reembolso.</p></body></html>`;
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `recibo-sessao-${apt.id}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const sendReceiptEmail = async (apt: any) => {
    setSendingEmail(true);
    try {
      await api("/api/sessions/send-receipt", { method: "POST", body: JSON.stringify({ appointment_id: apt.id }) });
      setSuccess("Recibo enviado por e-mail!");
      setReceiptApt(null);
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e.message || "Erro ao enviar recibo.");
    } finally {
      setSendingEmail(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await api("/api/appointments/me/details");
      setAppointments(data || []);
    } catch (e: any) {
      setError("Erro ao carregar sessões.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const upcoming = appointments
    .filter(a => new Date(a.starts_at) > now && !a.status.includes("cancelled") && a.status !== "completed")
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const completed = appointments
    .filter(a => a.status === "completed" || new Date(a.starts_at) < now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const list = tab === "upcoming" ? upcoming : completed;

  const handleCancel = async (id: number) => {
    setConfirmCancel(null); setActionLoading(id);
    try {
      await api(`/api/appointments/${id}/cancel`, { method: "POST" });
      setSuccess("Sessão cancelada com sucesso.");
      setTimeout(() => setSuccess(""), 3000);
      await load();
    } catch (e: any) {
      setError(e.message || "Erro ao cancelar sessão.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleJoin = (apt: any) => {
    if (apt.video_call_url) window.open(apt.video_call_url, "_blank");
    else router.push(`/mobile/videochamada/${apt.id}`);
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
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Acompanhe e gerencie suas sessões</div>
      </div>

      <div style={{ background: "white", display: "flex", borderBottom: "1px solid #E5E7EB" }}>
        {[{ key: "upcoming", label: `Próximas (${upcoming.length})` }, { key: "completed", label: `Realizadas (${completed.length})` }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ flex: 1, padding: "14px 0", border: "none", background: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
              color: tab === t.key ? COLORS.primary : "#6B7280",
              borderBottom: tab === t.key ? `2px solid ${COLORS.primary}` : "2px solid transparent" }}>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 6 }}>
              {tab === "upcoming" ? "Nenhuma sessão futura" : "Nenhuma sessão realizada"}
            </div>
            {tab === "upcoming" && (
              <button onClick={() => router.push("/mobile/busca")}
                style={{ marginTop: 12, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Buscar terapeutas
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list.map(apt => {
              const { date, time } = fmt(apt.starts_at);
              const statusStyle = getStatusStyle(apt.status);
              const therapist = apt.therapist;
              const joinable = isJoinable(apt);
              const cancellable = ["scheduled", "confirmed"].includes(apt.status) && new Date(apt.starts_at) > now;
              return (
                <div key={apt.id} style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
                  <div style={{ background: COLORS.primary + "08", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #E5E7EB" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>
                      <Calendar size={12} /> {date} <Clock size={12} style={{ marginLeft: 4 }} /> {time}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: statusStyle.bg, color: statusStyle.text }}>
                      {STATUS_LABEL[apt.status] || apt.status}
                    </span>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {therapist?.foto_url ? <img src={getPhotoSrc(therapist.foto_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{therapist?.full_name || "Terapeuta"}</div>
                        {therapist?.crp && <div style={{ fontSize: 11, color: "#9CA3AF" }}>CRP {therapist.crp}</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary }}>{Number(apt.session_price).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>50 min</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {joinable && (
                        <button onClick={() => handleJoin(apt)} style={{ flex: 1, background: COLORS.secondary, color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          <Video size={14} /> Entrar
                        </button>
                      )}
                      {cancellable && (
                        <button onClick={() => setConfirmCancel(apt.id)} disabled={actionLoading === apt.id}
                          style={{ flex: joinable ? 0 : 1, background: "white", color: "#DC2626", border: "1px solid #DC2626", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading === apt.id ? 0.5 : 1 }}>
                          {actionLoading === apt.id ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> Cancelar</>}
                        </button>
                      )}
                      {apt.status === "completed" && (
                        <>
                          <button onClick={() => router.push("/mobile/avaliacoes")}
                            style={{ flex: 1, background: "white", color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                            Avaliar
                          </button>
                          <button onClick={() => setReceiptApt(apt)}
                            style={{ flex: 1, background: "white", color: COLORS.secondary, border: `1px solid ${COLORS.secondary}`, borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
                            Recibo
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {receiptApt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: COLORS.dark }}>Recibo da sessão</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
              {receiptApt.therapist?.full_name} · {new Date(receiptApt.starts_at).toLocaleDateString("pt-BR")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => { downloadReceipt(receiptApt); setReceiptApt(null); }}
                style={{ background: "#F3F4F6", color: COLORS.dark, border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Download size={16} /> Baixar recibo
              </button>
              <button onClick={() => sendReceiptEmail(receiptApt)} disabled={sendingEmail}
                style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: sendingEmail ? 0.6 : 1 }}>
                {sendingEmail ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={16} /> Enviar por e-mail</>}
              </button>
              <button onClick={() => setReceiptApt(null)}
                style={{ background: "white", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: COLORS.dark }}>Cancelar sessão?</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Cancele com pelo menos 24h de antecedência para evitar cobranças.</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancel(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => handleCancel(confirmCancel)} style={{ flex: 1, background: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
