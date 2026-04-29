"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Star, User, Calendar, CheckCircle, Loader2, X } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
  dark: "#3A3B21",
};

interface Appointment {
  id: number;
  starts_at: string;
  status: string;
  therapist?: { full_name?: string; foto_url?: string };
  has_review?: boolean;
}

export default function MobileAvaliacoesPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(false);

  useEffect(() => { loadAppointments(); }, []);

  const loadAppointments = async () => {
    try {
      const data = await api("/api/appointments/me/details");
      const completed = (data || [])
        .filter((a: any) => a.status === "completed")
        .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

      const withReviews = await Promise.all(
        completed.map(async (a: any) => {
          try {
            await api(`/api/reviews/appointment/${a.id}`);
            return { ...a, has_review: true };
          } catch {
            return { ...a, has_review: false };
          }
        })
      );
      setAppointments(withReviews);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openReview = (apt: Appointment) => {
    setSelected(apt);
    setRating(0);
    setComment("");
    setError("");
  };

  const closeReview = () => {
    setSelected(null);
    setRating(0);
    setComment("");
    setError("");
  };

  const handleSubmit = async () => {
    if (rating === 0) { setError("Selecione de 1 a 5 estrelas"); return; }
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await api("/api/reviews/create", {
        method: "POST",
        body: JSON.stringify({ appointment_id: selected.id, rating, comment: comment || null })
      });
      setAppointments(prev => prev.map(a => a.id === selected.id ? { ...a, has_review: true } : a));
      closeReview();
      setToast(true);
      setTimeout(() => setToast(false), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  const pending = appointments.filter(a => !a.has_review);
  const reviewed = appointments.filter(a => a.has_review);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const SessionCard = ({ apt, done }: { apt: Appointment; done: boolean }) => {
    const fotoUrl = getFotoSrc(apt.therapist?.foto_url);
    return (
      <div style={{
        backgroundColor: "white", borderRadius: 14, padding: "14px 16px",
        marginBottom: 10, border: `1px solid ${done ? COLORS.grayBorder : COLORS.primary}`,
        display: "flex", alignItems: "center", gap: 12,
        opacity: done ? 0.7 : 1,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={20} color="#9CA3AF" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: COLORS.dark, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {apt.therapist?.full_name || "Terapeuta"}
          </p>
          <p style={{ fontSize: 11, color: "#6B7280", margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
            <Calendar size={10} /> {formatDate(apt.starts_at)}
          </p>
        </div>
        {done ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#10B981", fontSize: 12, flexShrink: 0 }}>
            <CheckCircle size={16} color="#10B981" /> Avaliado
          </div>
        ) : (
          <button
            onClick={() => openReview(apt)}
            style={{
              backgroundColor: COLORS.primary, color: "white", border: "none",
              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 500,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
            }}
          >
            <Star size={12} /> Avaliar
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray, paddingBottom: 32 }}>
      <MobileHeader title="Avaliações" showBack backTo="/mobile/dashboard" />

      <div style={{ backgroundColor: COLORS.primary, padding: "16px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Star size={22} color="white" />
          <div>
            <p style={{ color: "white", fontSize: 15, fontWeight: 600, margin: 0 }}>Suas avaliações</p>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Avalie suas sessões concluídas</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Loader2 size={40} color={COLORS.primary} className="animate-spin" style={{ margin: "0 auto" }} />
          </div>
        ) : appointments.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Star size={48} color="#E5E7EB" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6B7280", fontSize: 14 }}>Nenhuma sessão concluída ainda</p>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 10 }}>
                  PENDENTES ({pending.length})
                </div>
                {pending.map(apt => <SessionCard key={apt.id} apt={apt} done={false} />)}
              </>
            )}
            {reviewed.length > 0 && (
              <>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 10, marginTop: pending.length > 0 ? 16 : 0 }}>
                  AVALIADAS ({reviewed.length})
                </div>
                {reviewed.map(apt => <SessionCard key={apt.id} apt={apt} done={true} />)}
              </>
            )}
          </>
        )}
      </div>

      {/* MODAL DE AVALIAÇÃO */}
      {selected && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}
          onClick={closeReview}
        >
          <div
            style={{ backgroundColor: "white", borderRadius: "20px 20px 0 0", width: "100%", padding: 24 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.secondary, margin: 0 }}>Avaliar sessão</h3>
              <button onClick={closeReview} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={22} color="#9CA3AF" />
              </button>
            </div>

            <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>
              Como foi sua sessão com <strong style={{ color: COLORS.primary }}>{selected.therapist?.full_name}</strong>?
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                >
                  <Star
                    size={40}
                    style={{
                      fill: (hoverRating || rating) >= star ? "#FBBF24" : "transparent",
                      color: (hoverRating || rating) >= star ? "#FBBF24" : "#D1D5DB",
                      transition: "all 0.15s",
                    }}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Compartilhe sua experiência (opcional)"
              rows={4}
              style={{
                width: "100%", padding: "12px", borderRadius: 10,
                border: `1px solid ${COLORS.grayBorder}`, fontSize: 14,
                resize: "none", outline: "none", boxSizing: "border-box",
                fontFamily: "inherit",
              }}
            />

            {error && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || submitting}
              style={{
                width: "100%", marginTop: 16, padding: "14px",
                backgroundColor: rating === 0 ? "#E5E7EB" : COLORS.primary,
                color: rating === 0 ? "#9CA3AF" : "white",
                border: "none", borderRadius: 12, fontSize: 15,
                fontWeight: 600, cursor: rating === 0 ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {submitting ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />}
              {submitting ? "Enviando..." : "Enviar avaliação"}
            </button>

            <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 10 }}>
              Sua avaliação ajuda outros pacientes a escolherem profissionais
            </p>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 300,
          backgroundColor: "#10B981", color: "white", borderRadius: 12,
          padding: "12px 16px", fontSize: 14, fontWeight: 500, textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
        }}>
          ✅ Avaliação enviada com sucesso!
        </div>
      )}
    </div>
  );
}