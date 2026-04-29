"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getFotoSrc } from "@/lib/utils";
import { 
  User, Star, ChevronLeft, ChevronRight, Calendar, Clock,
  FileText, Tag, Brain, CheckCircle, Award, Building2
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
  };
}

export function CardTerapeuta({ terapeuta }: CardTerapeutaProps) {
  const router = useRouter();
  const hoje = new Date();

  const [slotsPorDia, setSlotsPorDia] = useState<Record<string, any[]>>({});
  const [dias, setDias] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const DIAS_POR_PAGINA = 7;
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
      } else {
        console.error("Erro ao carregar slots:", response.status);
      }
    } catch (error) {
      console.error("Erro ao carregar slots:", error);
    } finally {
      setLoading(false);
    }
  }, [terapeuta.id, processarSlots]);

useEffect(() => { carregarSlots(); }, [carregarSlots]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('cancel') === 'true') {
        carregarSlots();
      }
    }
  }, []);
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

  const periodoLabel = (() => {
    if (!diasPaginados.length) return "";
    const [d1, m1] = diasPaginados[0].split("/");
    const [d2, m2, y2] = diasPaginados[diasPaginados.length - 1].split("/");
    const mesAno = new Date(`${y2}-${m2}-${d2}`).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    return m1 === m2 ? `${d1}–${d2}/${m2} · ${mesAno}` : `${d1}/${m1}–${d2}/${m2} · ${mesAno}`;
  })();

  const handleAgendar = async (slot: any) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      // ✅ Verifica autenticação
      await api('/api/users/me');

      // ✅ Verifica saldo ANTES de criar o appointment
      const walletData = await api('/api/wallet/balance');
      const balance = walletData.balance || 0;

      const startsAt = new Date(slot.starts_at);
      const therapistName = encodeURIComponent(terapeuta.full_name);
      const date = encodeURIComponent(startsAt.toLocaleDateString('pt-BR'));
      const time = encodeURIComponent(startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
      const duration = 50;
      const price = preco;

      if (balance >= preco) {
        // ✅ SALDO SUFICIENTE: cria appointment e confirma direto
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
        router.push(`/patient/dashboard?payment_success=true&appointment_id=${appointmentId}&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${price}`);
        return;
      }

      // ✅ SALDO INSUFICIENTE: vai direto pro Stripe SEM criar appointment
      // O appointment será criado pelo webhook após pagamento confirmado
      const residual = preco - balance;
      const isMobile = window.location.pathname.startsWith('/mobile') || sessionStorage.getItem('oauth_from_mobile') === 'true';
      const dashPath = isMobile ? '/mobile/dashboard' : '/patient/dashboard';
      const successUrl = `${window.location.origin}${dashPath}?payment_success=true&therapist_name=${therapistName}&date=${date}&time=${time}&duration=${duration}&price=${price}`;
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
      <div className="flex text-yellow-300 text-sm">
        {[...Array(fullStars)].map((_, i) => (
          <Star key={`full-${i}`} size={12} className="fill-[#FBBF24] text-[#FBBF24]" />
        ))}
        {[...Array(emptyStars)].map((_, i) => (
          <Star key={`empty-${i}`} size={12} className="text-[#FBBF24]" />
        ))}
      </div>
    );
  };

  return (
    <div
      style={{ backgroundColor: CORES.branco, borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", transition: "all 0.2s ease" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0,0,0,0.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)"; }}
    >
      <div style={{ display: "flex", flexDirection: "row", padding: "24px", gap: "24px" }}>

        {/* COLUNA ESQUERDA */}
        <div style={{ width: "280px", flexShrink: 0 }}>
          <div style={{ width: "120px", height: "120px", borderRadius: "50%", backgroundColor: CORES.cinzaClaro, backgroundImage: fotoUrl ? `url(${fotoUrl})` : "none", backgroundSize: "cover", backgroundPosition: "center", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
            {!fotoUrl && <User size={48} color={CORES.azul} />}
          </div>

          <h3 style={{ fontSize: "20px", fontWeight: "bold", color: CORES.azul, textAlign: "center", marginBottom: "8px" }}>
            {nomeCompleto}
            {terapeuta.verified && <CheckCircle size={16} color={CORES.verdeEscuro} style={{ marginLeft: "4px", display: "inline" }} />}
          </h3>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginBottom: "12px", flexDirection: "column" }}>
            {renderStars()}
            <span style={{ fontSize: "11px", color: CORES.cinzaTexto }}>{reviewsCount} avaliação{reviewsCount !== 1 ? 'ões' : ''}</span>
          </div>

          {terapeuta.accepts_corporate_sessions === true && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}>
              <span style={{
                backgroundColor: "#E8F4FD",
                color: CORES.azul,
                fontSize: "11px",
                fontWeight: "600",
                padding: "4px 10px",
                borderRadius: "20px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}>
                <Building2 size={12} />
                Aceita plano empresa
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
              <button
                onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                style={{ backgroundColor: currentPage === 0 ? CORES.cinza : CORES.rosa, color: CORES.branco, border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: currentPage === 0 ? "not-allowed" : "pointer", opacity: currentPage === 0 ? 0.4 : 1, display: "flex", alignItems: "center", gap: "4px" }}
              >
                <ChevronLeft size={12} /> Anterior
              </button>

              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: CORES.rosa }}>{periodoLabel}</span>
                {totalPaginas > 1 && (
                  <div style={{ fontSize: "10px", color: CORES.cinzaTexto, marginTop: "1px" }}>
                    {currentPage + 1} de {totalPaginas}
                  </div>
                )}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={currentPage >= totalPaginas - 1}
                style={{ backgroundColor: currentPage >= totalPaginas - 1 ? CORES.cinza : CORES.rosa, color: CORES.branco, border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "12px", cursor: currentPage >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: currentPage >= totalPaginas - 1 ? 0.4 : 1, display: "flex", alignItems: "center", gap: "4px" }}
              >
                Próximo <ChevronRight size={12} />
              </button>
            </div>

            {loading ? (
              <div style={{ padding: "32px", textAlign: "center" }}>
                <p style={{ color: CORES.cinzaTexto, fontSize: "13px" }}>Carregando disponibilidade...</p>
              </div>
            ) : diasPaginados.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center" }}>
                <p style={{ color: CORES.cinzaTexto, fontSize: "13px" }}>Nenhum horário disponível nos próximos 90 dias</p>
              </div>
            ) : (
              <div style={{ padding: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${diasPaginados.length}, 1fr)`, gap: "8px" }}>
                  {diasPaginados.map((dia) => {
                    const horarios = getHorarios(slotsPorDia[dia] || []);
                    const ehHoje = isHoje(dia);
                    return (
                      <div key={dia} style={{
                        borderRadius: "8px", overflow: "hidden",
                        border: `${ehHoje ? "2px" : "1px"} solid ${ehHoje ? CORES.rosa : CORES.cinzaBorda}`,
                        boxShadow: ehHoje ? `0 0 0 2px ${CORES.rosa}33` : "none",
                      }}>
                        <div style={{ textAlign: "center", padding: "8px", backgroundColor: ehHoje ? CORES.rosa : CORES.azul, color: CORES.branco }}>
                          <div style={{ fontSize: "11px", fontWeight: "500", opacity: 0.85 }}>{getDiaSemana(dia)}</div>
                          <div style={{ fontSize: "14px", fontWeight: "bold" }}>{getDiaMes(dia)}</div>
                        </div>
                        <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: ehHoje ? `${CORES.rosa}0D` : CORES.branco }}>
                          {horarios.length === 0 ? (
                            <p style={{ fontSize: "10px", textAlign: "center", color: CORES.cinzaTexto, padding: "8px 0" }}>–</p>
                          ) : (
                            horarios.map((slot, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleAgendar(slot)}
                                disabled={isLoading}
                                style={{
                                  fontSize: "11px", padding: "6px 8px", borderRadius: "6px",
                                  backgroundColor: ehHoje ? `${CORES.rosa}1A` : CORES.cinza,
                                  color: ehHoje ? CORES.rosaEscuro : CORES.cinzaTexto,
                                  border: ehHoje ? `1px solid ${CORES.rosa}55` : "none",
                                  cursor: isLoading ? "not-allowed" : "pointer",
                                  width: "100%", textAlign: "center", opacity: isLoading ? 0.6 : 1,
                                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                                  fontWeight: ehHoje ? "600" : "400",
                                }}
                              >
                                <Clock size={10} />
                                {isLoading ? "..." : new Date(slot.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
  );
}