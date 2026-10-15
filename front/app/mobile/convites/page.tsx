"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, User, Calendar, Clock, CheckCircle, XCircle, Loader2, AlertCircle, Tag } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

function getPhotoSrc(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

function fmt(iso: string) {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default function MobileConvitesPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState<Record<number, boolean>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api("/api/invites/me");
      setInvites(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError("Erro ao carregar convites.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(invite: any) {
    setResponding(r => ({ ...r, [invite.id]: true }));
    setError(""); setSuccess("");
    try {
      const sessionPrice = invite.therapist?.session_price || 200;
      const walletData = await api("/api/wallet/balance");
      const balance = walletData.balance || 0;
      if (balance < sessionPrice) {
        router.push(`/mobile/checkout?appointment_id=${invite.id}`);
        return;
      }
      await api(`/api/appointments/${invite.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
      setSuccess("✅ Sessão confirmada! Valor debitado da sua carteira.");
      setInvites(prev => prev.filter(i => i.id !== invite.id));
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao confirmar convite.");
    } finally {
      setResponding(r => ({ ...r, [invite.id]: false }));
    }
  }

  async function handleDecline(id: number) {
    setResponding(r => ({ ...r, [id]: true }));
    setError(""); setSuccess("");
    try {
      await api(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: "declined" }) });
      setSuccess("Convite recusado.");
      setInvites(prev => prev.filter(i => i.id !== id));
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao recusar convite.");
    } finally {
      setResponding(r => ({ ...r, [id]: false }));
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Meus Convites</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Gerencie os convites recebidos</div>
      </div>

      <div style={{ padding: 16 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>
        ) : invites.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <Mail size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 6 }}>Nenhum convite pendente</div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>Quando um terapeuta te convidar, aparecerá aqui.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {invites.map(invite => {
              const { date, time } = fmt(invite.starts_at);
              const endTime = new Date(invite.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              const duration = Math.round((new Date(invite.ends_at).getTime() - new Date(invite.starts_at).getTime()) / 60000);
              const photo = getPhotoSrc(invite.therapist?.foto_url);
              const sessionPrice = invite.therapist?.session_price || 200;
              const isLoading = responding[invite.id];
              return (
                <div key={invite.id} style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
                  <div style={{ background: "#FEF3C7", padding: "8px 14px", fontSize: 12, color: "#92400E", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    <Mail size={12} /> Convite pendente
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={22} color="#9CA3AF" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>{invite.therapist?.full_name || "Terapeuta"}</div>
                        {invite.therapist?.specialties && <div style={{ fontSize: 11, color: COLORS.primary, display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}><Tag size={10} /> {invite.therapist.specialties}</div>}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary }}>{Number(sessionPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                    </div>
                    <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                      <div><div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Data</div><div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark }}>{date}</div></div>
                      <div><div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Horário</div><div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark }}>{time}–{endTime}</div></div>
                      <div><div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Duração</div><div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark }}>{duration} min</div></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleConfirm(invite)} disabled={isLoading}
                        style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isLoading ? 0.5 : 1 }}>
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle size={14} /> Confirmar</>}
                      </button>
                      <button onClick={() => handleDecline(invite.id)} disabled={isLoading}
                        style={{ flex: 1, background: "white", color: COLORS.secondary, border: `1px solid ${COLORS.secondary}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: isLoading ? 0.5 : 1 }}>
                        <XCircle size={14} /> Recusar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
