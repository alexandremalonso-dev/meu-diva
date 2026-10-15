"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, User, Calendar, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

function getPhotoSrc(url?: string) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `https://api.meudivaonline.com${url}`;
}

export default function MobileAvaliacoesPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api("/api/appointments/me/details");
      const completed = (data || [])
        .filter((a: any) => a.status === "completed")
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      const withReviews = await Promise.all(
        completed.map(async (a: any) => {
          try { await api(`/api/reviews/appointment/${a.id}`); return { ...a, has_review: true }; }
          catch { return { ...a, has_review: false }; }
        })
      );
      setAppointments(withReviews);
    } catch { setError("Erro ao carregar sessões."); }
    finally { setLoading(false); }
  }

  async function handleSubmit() {
    if (rating === 0) { setError("Selecione de 1 a 5 estrelas."); return; }
    setSubmitting(true); setError("");
    try {
      await api("/api/reviews/create", { method: "POST", body: JSON.stringify({ appointment_id: selected.id, rating, comment: comment || null }) });
      setAppointments(prev => prev.map(a => a.id === selected.id ? { ...a, has_review: true } : a));
      setSelected(null); setRating(0); setComment("");
      setSuccess("✅ Avaliação enviada com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) { setError(e.message || "Erro ao enviar avaliação."); }
    finally { setSubmitting(false); }
  }

  const pending = appointments.filter(a => !a.has_review);
  const reviewed = appointments.filter(a => a.has_review);
  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Avaliações</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Avalie suas sessões concluídas</div>
      </div>

      <div style={{ padding: 16 }}>
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}
        {error && !selected && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><Loader2 size={32} className="animate-spin" color={COLORS.primary} /></div>
        ) : appointments.length === 0 ? (
          <div style={{ background: "white", borderRadius: 14, padding: 32, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <Star size={40} color="#D1D5DB" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark }}>Nenhuma sessão realizada ainda</div>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 10 }}>PENDENTES ({pending.length})</div>
                {pending.map(apt => (
                  <div key={apt.id} style={{ background: "white", borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.primary}40`, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {getPhotoSrc(apt.therapist?.foto_url) ? <img src={getPhotoSrc(apt.therapist.foto_url)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.dark }}>{apt.therapist?.full_name || "Terapeuta"}</div>
                      <div style={{ fontSize: 11, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10} /> {fmt(apt.starts_at)}</div>
                    </div>
                    <button onClick={() => { setSelected(apt); setRating(0); setComment(""); setError(""); }}
                      style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <Star size={12} /> Avaliar
                    </button>
                  </div>
                ))}
              </>
            )}
            {reviewed.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 10, marginTop: pending.length > 0 ? 16 : 0 }}>AVALIADAS ({reviewed.length})</div>
                {reviewed.map(apt => (
                  <div key={apt.id} style={{ background: "white", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", gap: 12, opacity: 0.7 }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {getPhotoSrc(apt.therapist?.foto_url) ? <img src={getPhotoSrc(apt.therapist.foto_url)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.dark }}>{apt.therapist?.full_name || "Terapeuta"}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{fmt(apt.starts_at)}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#10B981", fontSize: 12 }}><CheckCircle size={16} color="#10B981" /> Avaliado</div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={() => setSelected(null)}>
          <div style={{ background: "white", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.dark, marginBottom: 4 }}>Avaliar sessão</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{selected.therapist?.full_name} · {fmt(selected.starts_at)}</div>

            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Star size={36} fill={(hover || rating) >= s ? COLORS.primary : "none"} color={(hover || rating) >= s ? COLORS.primary : "#D1D5DB"} />
                </button>
              ))}
            </div>

            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentário opcional..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, resize: "none", outline: "none", boxSizing: "border-box", minHeight: 80 }} />

            {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginTop: 10 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setSelected(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : "Enviar avaliação"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 10 }}>Sua avaliação ajuda outros pacientes a escolherem profissionais</p>
          </div>
        </div>
      )}
    </div>
  );
}
