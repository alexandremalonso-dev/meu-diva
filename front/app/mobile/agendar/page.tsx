"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Clock, User, Loader2, Search, Star, X, ChevronRight } from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
  dark: "#3A3B21",
};

interface Slot {
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
}

interface TherapistWithSlots {
  therapist: any;
  profileId: number;
  nextSlots: Slot[];
  loading: boolean;
}

export default function MobileAgendarPage() {
  const router = useRouter();
  const [therapistsWithSlots, setTherapistsWithSlots] = useState<TherapistWithSlots[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ therapist: any; slots: Slot[] } | null>(null);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    loadFrequentTherapists();
  }, []);

  const loadFrequentTherapists = async () => {
    try {
      const appointments = await api("/api/appointments/me/details");
      const therapistMap = new Map<number, { count: number; therapist: any }>();

      (appointments || [])
        .filter((a: any) => ["completed", "confirmed", "scheduled"].includes(a.status))
        .forEach((a: any) => {
          if (a.therapist && a.therapist_user_id) {
            const curr = therapistMap.get(a.therapist_user_id) || {
              count: 0,
              therapist: { ...a.therapist, user_id: a.therapist_user_id }
            };
            curr.count += 1;
            therapistMap.set(a.therapist_user_id, curr);
          }
        });

      const frequent = Array.from(therapistMap.values())
        .sort((a, b) => b.count - a.count)
        .map(item => item.therapist)
        .slice(0, 5);

      setTherapistsWithSlots(frequent.map(t => ({ therapist: t, profileId: 0, nextSlots: [], loading: true })));
      setLoading(false);

      const therapistsData = await api('/api/therapists').catch(() => []);

      const results = await Promise.all(
        frequent.map(async (therapist) => {
          try {
            const profile = therapistsData.find((t: any) => t.user_id === therapist.user_id);
            if (!profile?.id) return { therapist, profileId: 0, nextSlots: [], loading: false };

            // ✅ Usa profile.id para buscar dados públicos corretos
            const [resSlots, resPublic] = await Promise.all([
              fetch(`${BACKEND_URL}/public/terapeutas/${profile.id}/slots?days=14`),
              fetch(`${BACKEND_URL}/public/terapeutas/${profile.id}`),
            ]);

            const publicData = resPublic.ok ? await resPublic.json() : {};
            // ✅ Garante que user_id original é mantido para o agendamento
            const enrichedTherapist = {
              ...therapist,
              ...publicData,
              user_id: therapist.user_id, // mantém o user_id original
            };

            const slots: Slot[] = resSlots.ok
              ? ((await resSlots.json()).slots || [])
                  .filter((s: any) => new Date(s.starts_at) > new Date())
                  .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                  .slice(0, 3)
              : [];

            return { therapist: enrichedTherapist, profileId: profile.id, nextSlots: slots, loading: false };
          } catch {
            return { therapist, profileId: 0, nextSlots: [], loading: false };
          }
        })
      );

      setTherapistsWithSlots(results);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const openModal = async (item: TherapistWithSlots) => {
    if (!item.profileId) return;
    setLoadingModal(true);
    setModalData({ therapist: item.therapist, slots: [] });
    try {
      const res = await fetch(`${BACKEND_URL}/public/terapeutas/${item.profileId}/slots?days=30`);
      if (res.ok) {
        const data = await res.json();
        const slots: Slot[] = (data.slots || [])
          .filter((s: any) => new Date(s.starts_at) > new Date())
          .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        setModalData({ therapist: item.therapist, slots });
      }
    } catch {}
    finally { setLoadingModal(false); }
  };

  const handleAgendar = async (slot: Slot, therapist: any) => {
    const therapistUserId = therapist.user_id;
    const key = `${therapistUserId}_${slot.starts_at}`;
    if (isBooking) return;
    setIsBooking(key);

    try {
      const walletData = await api("/api/wallet/balance");
      const balance = walletData.balance || 0;
      const preco = Number(therapist.session_price) || 0;

      if (!preco || preco <= 0) {
        alert("Preço da sessão não disponível. Acesse o perfil do terapeuta para agendar.");
        return;
      }

      const startsAt = new Date(slot.starts_at);
      const therapistName = encodeURIComponent(therapist.full_name || "Terapeuta");
      const date = encodeURIComponent(startsAt.toLocaleDateString('pt-BR'));
      const time = encodeURIComponent(startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      const duration = slot.duration_minutes || 50;

      if (balance >= preco) {
        // ✅ Saldo suficiente — cria e confirma direto
        const bookingData = await api('/api/appointments', {
          method: "POST",
          body: JSON.stringify({
            therapist_user_id: therapistUserId,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            duration_minutes: duration,
          })
        });
        await api(`/api/appointments/${bookingData.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "confirmed" })
        });
        setModalData(null);
        router.push(`/mobile/dashboard?payment_success=true&appointment_id=${bookingData.id}&therapist_name=${therapistName}&date=${date}&time=${time}&price=${preco}`);
        return;
      }

      // ✅ Saldo insuficiente — vai pro Stripe SEM criar appointment antes
      const residual = preco - balance;
      const successUrl = `${window.location.origin}/mobile/dashboard?payment_success=true&therapist_name=${therapistName}&date=${date}&time=${time}&price=${preco}`;
      const cancelUrl = `${window.location.origin}/mobile/agendar`;

      const stripeData = await api('/api/payments/create-checkout', {
        method: "POST",
        body: JSON.stringify({
          amount: residual,
          success_url: successUrl,
          cancel_url: cancelUrl,
          therapist_user_id: therapistUserId,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          duration_minutes: duration,
        })
      });
      window.location.href = stripeData.checkout_url;

    } catch (err: any) {
      if (err.message?.toLowerCase().includes('ocupado') || err.message?.toLowerCase().includes('conflict')) {
        alert("Este horário já foi ocupado. Por favor escolha outro.");
        loadFrequentTherapists();
      } else {
        alert(err.message || "Erro ao agendar");
      }
    } finally {
      setIsBooking(null);
    }
  };

  const formatSlot = (dateStr: string) => {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray, paddingBottom: 32 }}>
      <MobileHeader title="Agendar Sessão" showBack backTo="/mobile/dashboard" />

      <div style={{ backgroundColor: COLORS.secondary, padding: "16px 16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Calendar size={22} color="white" />
          <div>
            <p style={{ color: "white", fontSize: 15, fontWeight: 600, margin: 0 }}>Seus terapeutas</p>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Selecione um horário para agendar</p>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Loader2 size={40} color={COLORS.primary} style={{ margin: "0 auto" }} className="animate-spin" />
          </div>
        ) : therapistsWithSlots.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Calendar size={48} color="#E5E7EB" style={{ margin: "0 auto 12px" }} />
            <p style={{ color: "#6B7280", fontSize: 14, marginBottom: 16 }}>Nenhum terapeuta encontrado</p>
            <button
              onClick={() => router.push("/mobile/busca")}
              style={{ backgroundColor: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Search size={14} /> Buscar terapeutas
            </button>
          </div>
        ) : (
          therapistsWithSlots.map((item) => {
            const fotoUrl = getFotoSrc(item.therapist.foto_url);
            const rating = Number(item.therapist.rating) || 0;
            const reviewsCount = Number(item.therapist.reviews_count) || 0;
            const sessionPrice = Number(item.therapist.session_price) || 0;

            return (
              <div key={item.therapist.user_id} style={{ backgroundColor: "white", borderRadius: 14, marginBottom: 12, overflow: "hidden", border: `1px solid ${COLORS.grayBorder}` }}>

                <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={22} color="#9CA3AF" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, margin: "0 0 3px" }}>{item.therapist.full_name}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <div style={{ display: "flex", gap: 1 }}>
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={10} style={{ fill: s <= Math.floor(rating) ? "#FBBF24" : "transparent", color: "#FBBF24" }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 10, color: "#6B7280" }}>{reviewsCount} aval.</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark }}>
                      {sessionPrice > 0 ? `R$ ${sessionPrice.toFixed(2)}` : "Carregando..."}
                    </span>
                  </div>
                  <button
                    onClick={() => openModal(item)}
                    style={{ fontSize: 11, color: COLORS.secondary, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: 0, flexShrink: 0 }}
                  >
                    Ver todos <ChevronRight size={12} />
                  </button>
                </div>

                <div style={{ padding: "0 12px 12px", display: "flex", gap: 8 }}>
                  {item.loading ? (
                    <div style={{ width: "100%", textAlign: "center", padding: "8px 0" }}>
                      <Loader2 size={16} color={COLORS.primary} className="animate-spin" style={{ margin: "0 auto" }} />
                    </div>
                  ) : item.nextSlots.length === 0 ? (
                    <p style={{ fontSize: 11, color: "#9CA3AF", padding: "4px 0" }}>Nenhum horário disponível</p>
                  ) : (
                    item.nextSlots.map((slot, idx) => {
                      const { date, time } = formatSlot(slot.starts_at);
                      const key = `${item.therapist.user_id}_${slot.starts_at}`;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleAgendar(slot, item.therapist)}
                          disabled={!!isBooking}
                          style={{
                            flex: 1,
                            backgroundColor: isBooking === key ? `${COLORS.primary}20` : COLORS.gray,
                            border: `1px solid ${isBooking === key ? COLORS.primary : COLORS.grayBorder}`,
                            borderRadius: 10, padding: "8px 4px", textAlign: "center",
                            cursor: isBooking ? "not-allowed" : "pointer",
                            opacity: isBooking && isBooking !== key ? 0.6 : 1,
                            transition: "all 0.2s",
                          }}
                        >
                          <p style={{ fontSize: 10, color: "#6B7280", margin: "0 0 2px" }}>{date}</p>
                          <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, margin: 0 }}>{time}</p>
                          {isBooking === key && <Loader2 size={10} color={COLORS.primary} className="animate-spin" style={{ margin: "2px auto 0" }} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}

        <button
          onClick={() => router.push("/mobile/busca")}
          style={{ width: "100%", backgroundColor: COLORS.secondary, color: "white", border: "none", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}
        >
          <Search size={16} /> Buscar mais terapeutas
        </button>
      </div>

      {modalData && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end" }}
          onClick={() => setModalData(null)}
        >
          <div
            style={{ backgroundColor: "white", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px", borderBottom: `1px solid ${COLORS.grayBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {getFotoSrc(modalData.therapist.foto_url)
                    ? <img src={getFotoSrc(modalData.therapist.foto_url)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <User size={16} color="#9CA3AF" />
                  }
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark, margin: 0 }}>{modalData.therapist.full_name}</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0 }}>
                    {Number(modalData.therapist.session_price) > 0
                      ? `R$ ${Number(modalData.therapist.session_price).toFixed(2)} por sessão`
                      : "Carregando preço..."}
                  </p>
                </div>
              </div>
              <button onClick={() => setModalData(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={20} color="#9CA3AF" />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {loadingModal ? (
                <div style={{ textAlign: "center", padding: 32 }}>
                  <Loader2 size={32} color={COLORS.primary} className="animate-spin" style={{ margin: "0 auto" }} />
                </div>
              ) : modalData.slots.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9CA3AF", padding: 32, fontSize: 14 }}>Nenhum horário disponível</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {modalData.slots.map((slot, idx) => {
                    const { date, time } = formatSlot(slot.starts_at);
                    const key = `${modalData.therapist.user_id}_${slot.starts_at}`;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleAgendar(slot, modalData.therapist)}
                        disabled={!!isBooking}
                        style={{
                          backgroundColor: isBooking === key ? `${COLORS.primary}15` : COLORS.gray,
                          border: `1px solid ${isBooking === key ? COLORS.primary : COLORS.grayBorder}`,
                          borderRadius: 12, padding: "12px 8px", textAlign: "center",
                          cursor: isBooking ? "not-allowed" : "pointer",
                          opacity: isBooking && isBooking !== key ? 0.6 : 1,
                        }}
                      >
                        <p style={{ fontSize: 11, color: "#6B7280", margin: "0 0 3px" }}>{date}</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.primary, margin: "0 0 2px" }}>{time}</p>
                        <p style={{ fontSize: 10, color: "#9CA3AF", margin: 0 }}>{slot.duration_minutes} min</p>
                        {isBooking === key && <Loader2 size={12} color={COLORS.primary} className="animate-spin" style={{ margin: "4px auto 0" }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}