"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, User, Calendar, ChevronRight, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

function getPhotoSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

const STATUS: Record<string, { label: string; color: string }> = {
  confirmed:  { label: "Confirmada", color: "#2F80D3" },
  scheduled:  { label: "Agendada",   color: "#FB8811" },
  completed:  { label: "Realizada",  color: "#10B981" },
};

export default function MobileQueixasPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [complaint, setComplaint] = useState("");
  const [existing, setExisting] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api("/api/appointments/me/details");
      const filtered = (data || [])
        .filter((a: any) => ["confirmed", "scheduled", "completed"].includes(a.status))
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
        .slice(0, 20);
      setAppointments(filtered);
    } catch { setError("Erro ao carregar sessões."); }
    finally { setLoading(false); }
  }

  async function openQueixa(apt: any) {
    setSelected(apt); setComplaint(""); setExisting(""); setError("");
    try {
      const rec = await api(`/api/appointments/${apt.id}/medical-record`);
      if (rec?.patient_complaint) setExisting(rec.patient_complaint);
    } catch {}
  }

  async function handleSubmit() {
    if (!complaint.trim()) { setError("Escreva sua queixa antes de enviar."); return; }
    setSubmitting(true); setError("");
    try {
      await api(`/api/sessions/${selected.id}/complaint`, { method: "POST", body: JSON.stringify({ complaint: complaint.trim() }) });
      setSelected(null); setComplaint("");
      setSuccess("✅ Queixa registrada com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) { setError(e.message || "Erro ao registrar queixa."); }
    finally { setSubmitting(false); }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR") + " às " + new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Queixas</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Selecione uma sessão para registrar sua queixa</div>
      </div>

      <div style={{ padding: 16 }}>
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}
        {error && !selected && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>
        ) : appointments.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <MessageSquare size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>Nenhuma sessão encontrada</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {appointments.map(apt => {
              const st = STATUS[apt.status] || { label: apt.status, color: "#9CA3AF" };
              const photo = getPhotoSrc(apt.therapist?.foto_url);
              return (
                <div key={apt.id} onClick={() => openQueixa(apt)}
                  style={{ background: "white", borderRadius: 14, padding: 14, border: "0.5px solid #E5E7EB", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {photo ? <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.dark, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{apt.therapist?.full_name || "Terapeuta"}</div>
                    <div style={{ fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {fmt(apt.starts_at)}</div>
                    <span style={{ fontSize: 11, color: st.color, background: st.color + "15", padding: "2px 8px", borderRadius: 8, marginTop: 4, display: "inline-block" }}>{st.label}</span>
                  </div>
                  <ChevronRight size={18} color="#9CA3AF" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={() => setSelected(null)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.dark, marginBottom: 4 }}>Registrar queixa</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>{selected.therapist?.full_name} · {new Date(selected.starts_at).toLocaleDateString("pt-BR")}</div>

            {existing && (
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Queixa registrada:</div>
                {existing}
              </div>
            )}

            <textarea value={complaint} onChange={e => setComplaint(e.target.value)}
              placeholder="Descreva o motivo da consulta, sintomas ou situação que motivou a sessão..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box", minHeight: 120 }} />

            {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginTop: 8 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setSelected(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : "Registrar queixa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
