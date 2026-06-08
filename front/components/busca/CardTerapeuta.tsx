"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";
import { 
  User, Star, ChevronLeft, ChevronRight, Calendar, Clock,
  FileText, Tag, Brain, ShieldCheck, Award, Building2, Heart
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  ciano: "#49CCD4",
  verdeEscuro: "#3A3B21",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

const DIAS_SEMANA: Record<number, string> = { 0: "dom", 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 6: "sáb" };

interface CardTerapeutaProps {
  terapeuta: {
    id: number;
    user_id: number;
    full_name: string;
    specialties?: string;
    session_price?: number;
    foto_url?: string;
    rating?: number;
    reviews_count?: number;
    abordagem?: string;
    bio?: string;
    gender?: string;
    verified?: boolean;
    instagram_url?: string;
    video_url?: string;
    idiomas?: string;
    experiencia?: string;
    formacao?: string;
    phone?: string;
    accepts_corporate_sessions?: boolean;
    session_duration_30min?: boolean;
    session_duration_50min?: boolean;
    is_available_now?: boolean;
  };
  isLoggedIn?: boolean;
  viewMode?: "list" | "grid";
}

const getHorarioStr = (startsAt: string): string => {
  const match = startsAt.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : new Date(startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

const getDateStr = (startsAt: string): string => {
  const match = startsAt.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  return new Date(startsAt).toISOString().split('T')[0]
}

// 🔥 Calcula o próximo slot arredondado para cima (30min)
function getNextSlot(): { starts_at: string; ends_at: string; label: string } {
  const now = new Date();
  const minutes = now.getMinutes();
  const roundedMinutes = minutes < 30 ? 30 : 0;
  const hoursAdd = minutes < 30 ? 0 : 1;
  const next = new Date(now);
  next.setMinutes(roundedMinutes, 0, 0);
  next.setHours(next.getHours() + hoursAdd);
  const label = next.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return {
    starts_at: next.toISOString(),
    ends_at: new Date(next.getTime() + 50 * 60000).toISOString(),
    label,
  };
}

export function CardTerapeuta({ terapeuta, isLoggedIn = false, viewMode = "list" }: CardTerapeutaProps) {
  const router = useRouter();
  const hoje = new Date();

  const [slotsPorDia, setSlotsPorDia] = useState<Record<string, any[]>>({});
  const [dias, setDias] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorito, setIsFavorito] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [durationModal, setDurationModal] = useState<{ slot: any } | null>(null);

  const DIAS_POR_PAGINA = 7;
  const nomeCompleto = terapeuta.full_name || "Nome não disponível";
  const fotoUrl = getFotoSrc(terapeuta.foto_url);
  const preco = terapeuta.session_price || 0;
  const precoFormatado = `R$ ${preco.toFixed(2)}`;
  const rating = Number(terapeuta.rating) || 0;
  const reviewsCount = Number(terapeuta.reviews_count) || 0;

  useEffect(() => {
    if (!isLoggedIn) return;
    api(`/api/favorites/${terapeuta.id}`)
      .then((data) => setIsFavorito(data.is_favorite))
      .catch(() => {});
  }, [terapeuta.id, isLoggedIn]);

  const toggleFavorito = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn) { router.push('/auth/login'); return; }
    if (favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorito) {
        await api(`/api/favorites/${terapeuta.id}`, { method: "DELETE" });
        setIsFavorito(false);
      } else {
        await api(`/api/favorites/${terapeuta.id}`, { method: "POST" });
        setIsFavorito(true);
      }
    } catch (err) {
      console.error("Erro ao favoritar:", err);
    } finally {
      setFavLoading(false);
    }
  };

  const processarSlots = useCallback((slotsData: any[]) => {
    const grupos: Record<string, any[]> = {};
    (slotsData || []).forEach((slot: any) => {
      const dateStr = getDateStr(slot.starts_at)
      if (!grupos[dateStr]) grupos[dateStr] = [];
      grupos[dateStr].push(slot);
    });
    const diasOrdenados = Object.keys(grupos).sort();
    setSlotsPorDia(grupos);
    setDias(diasOrdenados);
    setCurrentPage(0);
  }, []);

  const carregarSlots = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/public/terapeutas/${terapeuta.id}/slots?days=90`);
      if (response.ok) {
        const data = await response.json();
        processarSlots(data.slots || []);
      }
    } catch (error) {
      console.error("Erro ao carregar slots:", error);
    } finally {
      setLoading(false);
    }
  }, [terapeuta.id, processarSlots]);

  useEffect(() => {
    if (viewMode === "list") carregarSlots();
  }, [carregarSlots, viewMode]);

  const totalPaginas = Math.ceil(dias.length / DIAS_POR_PAGINA);
  const diasPaginados = dias.slice(currentPage * DIAS_POR_PAGINA, (currentPage + 1) * DIAS_POR_PAGINA);

  const getDiaSemana = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number)
    return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  }

  const getDiaMes = (dateStr: string) => {
    const [, m, d] = dateStr.split("-")
    return `${d}/${m}`
  }

  const isHoje = (dateStr: string) => {
    const hojeStr = hoje.toISOString().split('T')[0]
    return dateStr === hojeStr
  }

  const getHorarios = (slots: any[]) =>
    (slots || [])
      .filter(s => {
        const h = parseInt(getHorarioStr(s.starts_at).split(':')[0])
        return h >= 7 && h <= 22
      })
      .sort((a, b) => getHorarioStr(a.starts_at).localeCompare(getHorarioStr(b.starts_at)))

  const periodoLabel = (() => {
    if (!diasPaginados.length) return "";
    const first = diasPaginados[0]
    const last = diasPaginados[diasPaginados.length - 1]
    const [y1, m1, d1] = first.split("-")
    const [y2, m2, d2] = last.split("-")
    const mesAno = new Date(Date.UTC(parseInt(y2), parseInt(m2) - 1, parseInt(d2)))
      .toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
    return m1 === m2
      ? `${d1}–${d2}/${m2} · ${mesAno}`
      : `${d1}/${m1}–${d2}/${m2} · ${mesAno}`
  })();

  const preco30 = Math.round((preco / 5) * 3 * 100) / 100;

  const handleAgendar = async (slot: any, durationMinutes?: number) => {
    if (!isLoggedIn) { router.push('/auth/login?redirect=/busca'); return; }
    if (isLoading) return;
    // 🔥 Se aceita 30min e duração não foi escolhida ainda, abrir modal
    if (!durationMinutes && terapeuta.session_duration_30min) {
      setDurationModal({ slot });
      return;
    }
    const duration = durationMinutes || 50;
    setIsLoading(true);
    try {
      const walletData = await api('/api/wallet/balance');
      const balance = walletData.balance || 0;
      if (balance >= preco) {
        const bookingData = await api('/api/appointments', {
          method: "POST",
          body: JSON.stringify({ therapist_user_id: terapeuta.user_id, starts_at: slot.starts_at, ends_at: slot.ends_at, duration_minutes: duration })
        });
        const appointmentId = bookingData.id;
        await api(`/api/appointments/${appointmentId}/status`, { method: "PATCH", body: JSON.stringify({ status: "confirmed" }) });
        await carregarSlots();
        router.push(`/patient/dashboard?payment_success=true&appointment_id=${appointmentId}&therapist_name=${encodeURIComponent(terapeuta.full_name)}&date=${encodeURIComponent(getDiaMes(getDateStr(slot.starts_at)))}&time=${encodeURIComponent(getHorarioStr(slot.starts_at))}&duration=${duration}&price=${duration === 30 ? preco30 : preco}`);
        return;
      }
      const bookingData = await api('/api/appointments', {
        method: "POST",
        body: JSON.stringify({ therapist_user_id: terapeuta.user_id, starts_at: slot.starts_at, ends_at: slot.ends_at, duration_minutes: duration })
      });
      router.push(`/checkout?appointment_id=${bookingData.id}`);
    } catch (err: any) {
      console.error("Erro ao agendar:", err);
      if (err.message?.toLowerCase().includes('ocupado') || err.message?.toLowerCase().includes('conflict')) {
        await carregarSlots();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (size = 12) => {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return (
      <div className="flex">
        {[...Array(fullStars)].map((_, i) => <Star key={`f${i}`} size={size} className="fill-[#FBBF24] text-[#FBBF24]" />)}
        {[...Array(emptyStars)].map((_, i) => <Star key={`e${i}`} size={size} className="text-[#FBBF24]" />)}
      </div>
    );
  };

  // ============================================================
  // 🔥 MODO GRID
  // ============================================================
  if (viewMode === "grid") {
    return (
      <div style={{
        backgroundColor: CORES.branco, borderRadius: "16px", overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "all 0.2s ease",
        position: "relative", display: "flex", flexDirection: "column",
      }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 20px rgba(0,0,0,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"; }}
      >
        {/* Foto header — fundo azul com foto centralizada */}
        <div style={{ backgroundColor: CORES.cinzaClaro, padding: "28px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
          {/* Botão favoritar */}
          <button onClick={toggleFavorito} disabled={favLoading} style={{
            position: "absolute", top: "12px", right: "12px",
            background: "white", border: "none", borderRadius: "50%",
            width: "34px", height: "34px", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}>
            <Heart size={16} style={{ fill: isFavorito ? CORES.rosa : "none", color: isFavorito ? CORES.rosa : "#9CA3AF", transition: "all 0.2s" }} />
          </button>

          {/* Foto com selo */}
          <div style={{ position: "relative", display: "inline-block" }}>
            <div style={{
              width: "96px", height: "96px", borderRadius: "50%",
              backgroundColor: "#E0EAF8",
              backgroundImage: fotoUrl ? `url(${fotoUrl})` : "none",
              backgroundSize: "cover", backgroundPosition: "center",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `3px solid ${CORES.branco}`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}>
              {!fotoUrl && <User size={40} color={CORES.azul} />}
            </div>
            {terapeuta.verified && (
              <div style={{ position: "absolute", bottom: "2px", right: "2px", backgroundColor: "#16A34A", borderRadius: "50%", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                <ShieldCheck size={14} color="white" strokeWidth={2.5} />
              </div>
            )}
          </div>

          {/* Nome */}
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: CORES.azul, textAlign: "center", margin: "12px 0 4px", lineHeight: "1.3" }}>
            {nomeCompleto}
          </h3>

          {/* Badge verificado abaixo do nome centralizado */}
          {terapeuta.verified && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", backgroundColor: "#16A34A", color: "white", fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", marginBottom: "4px", whiteSpace: "nowrap" }}>
              <ShieldCheck size={10} strokeWidth={2.5} /> Verificado
            </span>
          )}
          {/* 🔥 Badge disponível agora com slot imediato */}
          {terapeuta.is_available_now && (
            <button
              onClick={() => { const slot = getNextSlot(); handleAgendar(slot); }}
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#059669", color: "white", fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px", marginBottom: "4px", whiteSpace: "nowrap", border: "none", cursor: "pointer" }}
            >
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#6EE7B7", display: "inline-block" }} />
              Agendar às {getNextSlot().label}
            </button>
          )}

          {/* Especialidade em destaque */}
          {terapeuta.specialties && (
            <span style={{ fontSize: "12px", color: CORES.cinzaTexto, textAlign: "center" }}>
              {terapeuta.specialties}
            </span>
          )}

          {/* Stars + avaliações */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
            {renderStars(13)}
            <span style={{ fontSize: "11px", color: CORES.cinzaTexto }}>{reviewsCount} {reviewsCount === 1 ? 'avaliação' : 'avaliações'}</span>
          </div>
        </div>

        {/* Corpo do card */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>

          {/* Bio */}
          {terapeuta.bio && (
            <p style={{
              fontSize: "12px", color: CORES.cinzaTexto, lineHeight: "1.6", margin: 0,
              display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
            }}>
              {terapeuta.bio}
            </p>
          )}

          {/* Abordagem */}
          {terapeuta.abordagem && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "4px" }}>
              <Brain size={11} color={CORES.ciano} style={{ marginTop: "2px", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: CORES.cinzaTexto, lineHeight: "1.4" }}>
                <strong style={{ color: CORES.ciano }}>Abordagem:</strong> {terapeuta.abordagem}
              </span>
            </div>
          )}

          {/* Badge empresa */}
          {terapeuta.accepts_corporate_sessions && (
            <span style={{
              backgroundColor: "#E8F4FD", color: CORES.azul, fontSize: "11px", fontWeight: "600",
              padding: "3px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "4px", alignSelf: "flex-start"
            }}>
              <Building2 size={11} /> Aceita plano empresa
            </span>
          )}
        </div>

        {/* Rodapé — preço + botão */}
        <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${CORES.cinzaBorda}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "11px", color: CORES.cinzaTexto }}>Sessão 50 min</span>
            <span style={{ fontSize: "16px", fontWeight: "700", color: CORES.verdeEscuro }}>{precoFormatado}</span>
          </div>
          <Link href={`/terapeuta/${terapeuta.id}`} style={{ textDecoration: "none" }}>
            <button style={{
              width: "100%", padding: "10px", backgroundColor: CORES.rosa, color: CORES.branco,
              border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "600",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              transition: "opacity 0.2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Ver perfil completo <Award size={14} />
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // MODO LISTA — layout original horizontal com agenda
  // ============================================================
  return (
    <>
    <div
      style={{ backgroundColor: CORES.branco, borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "all 0.2s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"; }}
    >
      <div style={{ display: "flex", flexDirection: "row", padding: "24px", gap: "24px" }}>
        {/* COLUNA ESQUERDA */}
        <div style={{ width: "280px", flexShrink: 0, position: "relative" }}>
          <button onClick={toggleFavorito} disabled={favLoading} style={{
            position: "absolute", top: 0, right: 0, zIndex: 10,
            background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%",
            width: "32px", height: "32px", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}>
            <Heart size={16} style={{ fill: isFavorito ? CORES.rosa : "none", color: isFavorito ? CORES.rosa : CORES.cinzaTexto, transition: "all 0.2s" }} />
          </button>

          {/* Foto com selo */}
          <div style={{ position: "relative", display: "inline-block", margin: "0 auto 16px auto" }}>
            <div style={{ width: "120px", height: "120px", borderRadius: "50%", backgroundColor: CORES.cinzaClaro, backgroundImage: fotoUrl ? `url(${fotoUrl})` : "none", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {!fotoUrl && <User size={48} color={CORES.azul} />}
            </div>
            {terapeuta.verified && (
              <div style={{ position: "absolute", bottom: "4px", right: "4px", backgroundColor: "#16A34A", borderRadius: "50%", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid white", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                <ShieldCheck size={16} color="white" strokeWidth={2.5} />
              </div>
            )}
          </div>

          <h3 style={{ fontSize: "20px", fontWeight: "bold", color: CORES.azul, textAlign: "center", marginBottom: "4px" }}>
            {nomeCompleto}
          </h3>

          {/* Badge verificado abaixo do nome centralizado */}
          {terapeuta.verified && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#16A34A", color: "white", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px", whiteSpace: "nowrap" }}>
                <ShieldCheck size={11} strokeWidth={2.5} /> Verificado
              </span>
            </div>
          )}
          {/* 🔥 Badge disponível agora com slot imediato */}
          {terapeuta.is_available_now && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <button
                onClick={() => { const slot = getNextSlot(); handleAgendar(slot); }}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", backgroundColor: "#059669", color: "white", fontSize: "11px", fontWeight: "700", padding: "4px 12px", borderRadius: "20px", whiteSpace: "nowrap", border: "none", cursor: "pointer" }}
              >
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#6EE7B7", display: "inline-block" }} />
                Agendar às {getNextSlot().label}
              </button>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "12px", flexDirection: "column" }}>
            {renderStars()}
            <span style={{ fontSize: "11px", color: CORES.cinzaTexto }}>{reviewsCount} {reviewsCount === 1 ? 'avaliação' : 'avaliações'}</span>
          </div>

          {terapeuta.accepts_corporate_sessions === true && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              <span style={{ backgroundColor: "#E8F4FD", color: CORES.azul, fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "20px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Building2 size={12} /> Aceita plano empresa
              </span>
            </div>
          )}

          <p style={{ fontSize: "18px", fontWeight: "bold", color: CORES.verdeEscuro, textAlign: "center", marginBottom: "16px" }}>
            {precoFormatado} / sessão
          </p>

          {terapeuta.bio && (
            <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: `1px solid ${CORES.cinzaBorda}` }}>
              <h4 style={{ fontSize: "12px", fontWeight: "600", color: CORES.rosa, marginBottom: "8px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "4px" }}>
                <FileText size={12} /> Sobre
              </h4>
              <p style={{ fontSize: "13px", color: CORES.cinzaTexto, lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {terapeuta.bio}
              </p>
            </div>
          )}

          {terapeuta.specialties && (
            <div style={{ marginTop: "12px" }}>
              <p style={{ fontSize: "12px", color: CORES.cinzaTexto, display: "flex", alignItems: "center", gap: "4px" }}>
                <Tag size={12} color={CORES.azul} />
                <strong style={{ color: CORES.azul }}>Especialidades:</strong> {terapeuta.specialties}
              </p>
            </div>
          )}

          {terapeuta.abordagem && (
            <div style={{ marginTop: "8px" }}>
              <p style={{ fontSize: "12px", color: CORES.ciano, display: "flex", alignItems: "center", gap: "4px" }}>
                <Brain size={12} />
                <strong>Abordagem:</strong> {terapeuta.abordagem}
              </p>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA — AGENDA */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ backgroundColor: CORES.branco, borderRadius: "12px", overflow: "hidden", border: `1px solid ${CORES.cinzaBorda}` }}>
            <div style={{ backgroundColor: CORES.azul, padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ fontSize: "14px", fontWeight: "600", color: CORES.branco, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={14} /> Agenda de Atendimentos
                </h4>
                <span style={{ fontSize: "12px", color: CORES.branco, fontWeight: "500" }}>{precoFormatado}</span>
              </div>
            </div>

            <div style={{ padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${CORES.cinzaBorda}`, backgroundColor: CORES.cinzaClaro }}>
              <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}
                style={{ backgroundColor: currentPage === 0 ? CORES.cinza : CORES.rosa, color: CORES.branco, border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: currentPage === 0 ? "not-allowed" : "pointer", opacity: currentPage === 0 ? 0.4 : 1, display: "flex", alignItems: "center", gap: "4px" }}>
                <ChevronLeft size={12} /> Anterior
              </button>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: CORES.rosa }}>{periodoLabel}</span>
                {totalPaginas > 1 && <div style={{ fontSize: "10px", color: CORES.cinzaTexto, marginTop: "1px" }}>{currentPage + 1} de {totalPaginas}</div>}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPaginas - 1, p + 1))} disabled={currentPage >= totalPaginas - 1}
                style={{ backgroundColor: currentPage >= totalPaginas - 1 ? CORES.cinza : CORES.rosa, color: CORES.branco, border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: currentPage >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: currentPage >= totalPaginas - 1 ? 0.4 : 1, display: "flex", alignItems: "center", gap: "4px" }}>
                Próximo <ChevronRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ padding: "32px", textAlign: "center" }}><p style={{ color: CORES.cinzaTexto, fontSize: "13px" }}>Carregando disponibilidade...</p></div>
            ) : diasPaginados.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center" }}><p style={{ color: CORES.cinzaTexto, fontSize: "13px" }}>Nenhum horário disponível nos próximos 90 dias</p></div>
            ) : (
              <div style={{ padding: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${diasPaginados.length}, 1fr)`, gap: "8px" }}>
                  {diasPaginados.map((dia) => {
                    const horarios = getHorarios(slotsPorDia[dia] || []);
                    const ehHoje = isHoje(dia);
                    return (
                      <div key={dia} style={{ borderRadius: "8px", overflow: "hidden", border: `${ehHoje ? "2px" : "1px"} solid ${ehHoje ? CORES.rosa : CORES.cinzaBorda}`, boxShadow: ehHoje ? `0 0 0 2px ${CORES.rosa}33` : "none" }}>
                        <div style={{ textAlign: "center", padding: "8px", backgroundColor: ehHoje ? CORES.rosa : CORES.azul, color: CORES.branco }}>
                          <div style={{ fontSize: "11px", fontWeight: "500", opacity: 0.85 }}>{getDiaSemana(dia)}</div>
                          <div style={{ fontSize: "14px", fontWeight: "bold" }}>{getDiaMes(dia)}</div>
                        </div>
                        <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: ehHoje ? `${CORES.rosa}0D` : CORES.branco }}>
                          {horarios.length === 0 ? (
                            <p style={{ fontSize: "10px", textAlign: "center", color: CORES.cinzaTexto, padding: "8px 0" }}>–</p>
                          ) : (
                            horarios.map((slot, idx) => (
                              <button key={idx} onClick={() => handleAgendar(slot)} disabled={isLoading}
                                style={{ fontSize: "11px", padding: "6px 8px", borderRadius: "6px", backgroundColor: ehHoje ? `${CORES.rosa}1A` : CORES.cinza, color: ehHoje ? CORES.rosaEscuro : CORES.cinzaTexto, border: ehHoje ? `1px solid ${CORES.rosa}55` : "none", cursor: isLoading ? "not-allowed" : "pointer", width: "100%", textAlign: "center", opacity: isLoading ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontWeight: ehHoje ? "600" : "400" }}>
                                <Clock size={10} />
                                {isLoading ? "..." : getHorarioStr(slot.starts_at)}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ padding: "12px 16px", borderTop: `1px solid ${CORES.cinzaBorda}` }}>
              <Link href={`/terapeuta/${terapeuta.id}`} style={{ textDecoration: "none" }}>
                <button style={{ width: "100%", padding: "10px", backgroundColor: CORES.cinza, color: CORES.azul, border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "500", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                  Ver perfil completo <Award size={14} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* 🔥 Modal de seleção de duração */}
      {durationModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div style={{ backgroundColor: "white", borderRadius: "16px", padding: "24px", maxWidth: "320px", width: "90%", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: CORES.azul, marginBottom: "8px", textAlign: "center" }}>Duração da sessão</h3>
            <p style={{ fontSize: "13px", color: CORES.cinzaTexto, textAlign: "center", marginBottom: "20px" }}>Escolha a duração para esta sessão</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={() => { setDurationModal(null); handleAgendar(durationModal.slot, 50); }}
                style={{ padding: "14px", border: `2px solid ${CORES.azul}`, borderRadius: "12px", backgroundColor: "white", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: "700", color: CORES.azul, fontSize: "15px" }}>50 minutos</div>
                <div style={{ color: CORES.cinzaTexto, fontSize: "13px", marginTop: "2px" }}>R$ {preco.toFixed(2)}</div>
              </button>
              <button onClick={() => { setDurationModal(null); handleAgendar(durationModal.slot, 30); }}
                style={{ padding: "14px", border: `2px solid ${CORES.rosa}`, borderRadius: "12px", backgroundColor: "white", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontWeight: "700", color: CORES.rosa, fontSize: "15px" }}>30 minutos</div>
                <div style={{ color: CORES.cinzaTexto, fontSize: "13px", marginTop: "2px" }}>R$ {preco30.toFixed(2)}</div>
              </button>
              <button onClick={() => setDurationModal(null)}
                style={{ padding: "10px", border: "none", backgroundColor: CORES.cinza, borderRadius: "10px", cursor: "pointer", color: CORES.cinzaTexto, fontSize: "13px" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}