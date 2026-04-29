"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";
import {
  User, Star, ChevronLeft, ChevronRight, Calendar, Clock,
  Tag, Brain, CheckCircle, Award, Building2, FileText
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

interface MobileCardTerapeutaProps {
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
    accepts_corporate_sessions?: boolean;
  };
}

export function MobileCardTerapeuta({ terapeuta }: MobileCardTerapeutaProps) {
  const router = useRouter();
  const hoje = new Date();

  const [slotsPorDia, setSlotsPorDia] = useState<Record<string, any[]>>({});
  const [dias, setDias] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const DIAS_POR_PAGINA = 3;
  const nomeCompleto = terapeuta.full_name || "Nome não disponível";
  const fotoUrl = getFotoSrc(terapeuta.foto_url);
  const preco = terapeuta.session_price || 0;
  const precoFormatado = `R$ ${preco.toFixed(2)}`;
  const rating = Number(terapeuta.rating) || 0;
  const reviewsCount = Number(terapeuta.reviews_count) || 0;

  const processarSlots = useCallback((slotsData: any[]) => {
    const grupos: Record<string, any[]> = {};
    (slotsData || []).forEach((slot: any) => {
      const dateStr = new Date(slot.starts_at).toLocaleDateString("pt-BR");
      if (!grupos[dateStr]) grupos[dateStr] = [];
      grupos[dateStr].push(slot);
    });
    const diasOrdenados = Object.keys(grupos).sort((a, b) => {
      const parse = (s: string) => { const [d, m, y] = s.split("/"); return new Date(`${y}-${m}-${d}`).getTime(); };
      return parse(a) - parse(b);
    });
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

  useEffect(() => { carregarSlots(); }, [carregarSlots]);

  const totalPaginas = Math.ceil(dias.length / DIAS_POR_PAGINA);
  const diasPaginados = dias.slice(currentPage * DIAS_POR_PAGINA, (currentPage + 1) * DIAS_POR_PAGINA);

  const getDiaSemana = (dateStr: string) => {
    const [d, m, y] = dateStr.split("/");
    return DIAS_SEMANA[new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d))).getUTCDay()];
  };

  const getDiaMes = (dateStr: string) => { const [d, m] = dateStr.split("/"); return `${d}/${m}`; };
  const isHoje = (dateStr: string) => dateStr === hoje.toLocaleDateString("pt-BR");

  const getHorarios = (slots: any[]) =>
    (slots || [])
      .filter(s => { const h = new Date(s.starts_at).getHours(); return h >= 7 && h <= 22; })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const handleAgendar = async (slot: any) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await api('/api/users/me');
      const walletData = await api('/api/wallet/balance');
      const balance = walletData.balance || 0;

      const startsAt = new Date(slot.starts_at);
      const therapistName = encodeURIComponent(terapeuta.full_name);
      const date = encodeURIComponent(startsAt.toLocaleDateString('pt-BR'));
      const time = encodeURIComponent(startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      const duration = 50;
      const price = preco;

      if (balance >= preco) {
        const bookingData = await api('/api/appointments', {
          method: "POST",
          body: JSON.stringify({
            therapist_user_id: terapeuta.user_id,
            starts_at: slot.starts_at,
            ends_at: slot.ends_at,
            duration_minutes: 50
          })
        });
        const appointmentId = bookingData.id;
        await api(`/api/appointments/${appointmentId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "confirmed" })
        });
        await carregarSlots();
        router.push(`/mobile/dashboard?payment_success=true&appointment_id=${appointmentId}&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${price}`);
        return;
      }

      const residual = preco - balance;
      const successUrl = `${window.location.origin}/mobile/dashboard?payment_success=true&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${price}`;
      const cancelUrl = `${window.location.origin}/busca?cancel=true`;

      const stripeData = await api('/api/payments/create-checkout', {
        method: "POST",
        body: JSON.stringify({
          amount: residual,
          success_url: successUrl,
          cancel_url: cancelUrl,
          therapist_user_id: terapeuta.user_id,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          duration_minutes: 50
        })
      });
      window.location.href = stripeData.checkout_url;

    } catch (err: any) {
      console.error("Erro ao agendar:", err);
      if (err.message?.toLowerCase().includes('ocupado') || err.message?.toLowerCase().includes('conflict')) {
        await carregarSlots();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = () => {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return (
      <div style={{ display: "flex", gap: 2 }}>
        {[...Array(fullStars)].map((_, i) => <Star key={`f${i}`} size={12} style={{ fill: "#FBBF24", color: "#FBBF24" }} />)}
        {[...Array(emptyStars)].map((_, i) => <Star key={`e${i}`} size={12} style={{ color: "#FBBF24" }} />)}
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: CORES.branco, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: 16 }}>

      {/* HEADER — foto + info */}
      <div style={{ display: "flex", gap: 12, padding: "16px 16px 12px" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%", flexShrink: 0,
          backgroundColor: CORES.cinzaClaro,
          backgroundImage: fotoUrl ? `url(${fotoUrl})` : "none",
          backgroundSize: "cover", backgroundPosition: "center",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {!fotoUrl && <User size={32} color={CORES.azul} />}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: CORES.azul, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nomeCompleto}
            </h3>
            {terapeuta.verified && <CheckCircle size={14} color={CORES.verdeEscuro} />}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {renderStars()}
            <span style={{ fontSize: 11, color: CORES.cinzaTexto }}>{reviewsCount} aval.</span>
          </div>

          {terapeuta.specialties && (
            <p style={{ fontSize: 12, color: CORES.cinzaTexto, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {terapeuta.specialties}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: CORES.verdeEscuro }}>{precoFormatado}</span>
            {terapeuta.accepts_corporate_sessions && (
              <span style={{ fontSize: 10, backgroundColor: "#E8F4FD", color: CORES.azul, padding: "2px 8px", borderRadius: 10, display: "flex", alignItems: "center", gap: 3 }}>
                <Building2 size={10} /> Empresa
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BIO EXPANDÍVEL */}
      {terapeuta.bio && (
        <div style={{ padding: "0 16px 12px" }}>
          <p style={{
            fontSize: 12, color: CORES.cinzaTexto, lineHeight: 1.5, margin: 0,
            display: "-webkit-box", WebkitLineClamp: expanded ? undefined : 2,
            WebkitBoxOrient: "vertical", overflow: expanded ? "visible" : "hidden",
          }}>
            {terapeuta.bio}
          </p>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ background: "none", border: "none", color: CORES.rosa, fontSize: 11, cursor: "pointer", padding: "4px 0 0", fontWeight: 500 }}
          >
            {expanded ? "Ver menos" : "Ver mais"}
          </button>
        </div>
      )}

      {/* TAGS */}
      {(terapeuta.abordagem) && (
        <div style={{ padding: "0 16px 12px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {terapeuta.abordagem && (
            <span style={{ fontSize: 11, backgroundColor: "#E0F7FA", color: CORES.ciano, padding: "3px 8px", borderRadius: 10, display: "flex", alignItems: "center", gap: 3 }}>
              <Brain size={10} /> {terapeuta.abordagem}
            </span>
          )}
        </div>
      )}

      {/* AGENDA */}
      <div style={{ borderTop: `1px solid ${CORES.cinzaBorda}` }}>
        <div style={{ backgroundColor: CORES.azul, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: CORES.branco, display: "flex", alignItems: "center", gap: 6 }}>
            <Calendar size={13} /> Horários disponíveis
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              style={{ background: "none", border: "none", cursor: currentPage === 0 ? "not-allowed" : "pointer", opacity: currentPage === 0 ? 0.4 : 1, color: CORES.branco, padding: 0, display: "flex" }}
            >
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{currentPage + 1}/{totalPaginas || 1}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPaginas - 1, p + 1))}
              disabled={currentPage >= totalPaginas - 1}
              style={{ background: "none", border: "none", cursor: currentPage >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: currentPage >= totalPaginas - 1 ? 0.4 : 1, color: CORES.branco, padding: 0, display: "flex" }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: CORES.cinzaTexto, fontSize: 13 }}>Carregando horários...</div>
        ) : diasPaginados.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: CORES.cinzaTexto, fontSize: 13 }}>Nenhum horário disponível</div>
        ) : (
          <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {diasPaginados.map((dia) => {
              const horarios = getHorarios(slotsPorDia[dia] || []);
              const ehHoje = isHoje(dia);
              return (
                <div key={dia} style={{ borderRadius: 8, overflow: "hidden", border: `${ehHoje ? "2px" : "1px"} solid ${ehHoje ? CORES.rosa : CORES.cinzaBorda}` }}>
                  <div style={{ textAlign: "center", padding: "6px 4px", backgroundColor: ehHoje ? CORES.rosa : CORES.azul, color: CORES.branco }}>
                    <div style={{ fontSize: 10, opacity: 0.85 }}>{getDiaSemana(dia)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{getDiaMes(dia)}</div>
                  </div>
                  <div style={{ padding: "6px 4px", display: "flex", flexDirection: "column", gap: 4, backgroundColor: ehHoje ? `${CORES.rosa}0D` : CORES.branco }}>
                    {horarios.length === 0 ? (
                      <p style={{ fontSize: 10, textAlign: "center", color: CORES.cinzaTexto, padding: "4px 0" }}>–</p>
                    ) : (
                      horarios.slice(0, 4).map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAgendar(slot)}
                          disabled={isLoading}
                          style={{
                            fontSize: 11, padding: "5px 4px", borderRadius: 6,
                            backgroundColor: ehHoje ? `${CORES.rosa}1A` : CORES.cinza,
                            color: ehHoje ? CORES.rosaEscuro : CORES.cinzaTexto,
                            border: ehHoje ? `1px solid ${CORES.rosa}55` : "none",
                            cursor: isLoading ? "not-allowed" : "pointer",
                            width: "100%", textAlign: "center", opacity: isLoading ? 0.6 : 1,
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
                            fontWeight: ehHoje ? 600 : 400,
                          }}
                        >
                          <Clock size={9} />
                          {isLoading ? "..." : new Date(slot.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTÃO VER PERFIL */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${CORES.cinzaBorda}` }}>
        <Link href={`/mobile/terapeuta/${terapeuta.id}`} style={{ textDecoration: "none" }}>
          <button style={{
            width: "100%", padding: "10px", backgroundColor: CORES.cinza,
            color: CORES.azul, border: "none", borderRadius: 8, fontSize: 13,
            fontWeight: 500, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            Ver perfil completo <Award size={14} />
          </button>
        </Link>
      </div>
    </div>
  );
}