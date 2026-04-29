"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Star, Calendar, Clock, Brain, Target, Heart,
  Languages, User, Flag, BookOpen, BarChart3,
  Sparkles, CheckCircle, Building2, ChevronLeft,
  ChevronRight, Loader2, Youtube, GraduationCap,
  ShieldCheck, Video, Lock, FileText
} from "lucide-react";
import MobileHeader from "@/components/mobile/MobileHeader";
import { getFotoSrc } from "@/lib/utils";
import { api } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  dark: "#3A3B21",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
  ciano: "#49CCD4",
};

const DIAS_SEMANA: Record<number, string> = { 0: "dom", 1: "seg", 2: "ter", 3: "qua", 4: "qui", 5: "sex", 6: "sáb" };

function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?#]+)/,
    /youtube\.com\/watch\?.*v=([^&]+)/,
    /youtu\.be\/([^?]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1] && match[1].length === 11) return match[1];
  }
  return null;
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-block", backgroundColor: `${COLORS.secondary}15`, color: COLORS.secondary, padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500", margin: "3px" }}>
    {children}
  </span>
);

const SectionTitle = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.secondary, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
    <Icon size={14} color={COLORS.secondary} /> {title}
  </h3>
);

export default function MobileTerapeutaPage() {
  const params = useParams();
  const router = useRouter();
  const therapistId = params.id as string;

  const [terapeuta, setTerapeuta] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [slotsPorDia, setSlotsPorDia] = useState<Record<string, any[]>>({});
  const [dias, setDias] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const DIAS_POR_PAGINA = 3;
  const hoje = new Date();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
    carregarDados();
  }, [therapistId]);

  const carregarDados = async () => {
    try {
      const numericId = Number(therapistId);
      if (isNaN(numericId)) throw new Error("ID inválido");

      const res = await fetch(`${BACKEND_URL}/public/terapeutas/${numericId}`);
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      const data = await res.json();
      setTerapeuta(data);
      carregarSlots(data.id || numericId);

      try {
        const resAval = await fetch(`${BACKEND_URL}/api/reviews/therapist/${data.user_id}?limit=10`);
        if (resAval.ok) setAvaliacoes(await resAval.json());
      } catch {}

    } catch (err: any) {
      setError(err.message || "Erro ao carregar terapeuta");
    } finally {
      setLoading(false);
    }
  };

  const carregarSlots = async (id: number) => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`${BACKEND_URL}/public/terapeutas/${id}/slots?days=90`);
      if (res.ok) {
        const data = await res.json();
        const grupos: Record<string, any[]> = {};
        (data.slots || []).forEach((slot: any) => {
          const dateStr = new Date(slot.starts_at).toLocaleDateString("pt-BR");
          if (!grupos[dateStr]) grupos[dateStr] = [];
          grupos[dateStr].push(slot);
        });
        const ordenados = Object.keys(grupos).sort((a, b) => {
          const parse = (s: string) => { const [d, m, y] = s.split("/"); return new Date(`${y}-${m}-${d}`).getTime(); };
          return parse(a) - parse(b);
        });
        setSlotsPorDia(grupos);
        setDias(ordenados);
      }
    } catch {}
    finally { setLoadingSlots(false); }
  };

  const totalPaginas = Math.ceil(dias.length / DIAS_POR_PAGINA);
  const diasPaginados = dias.slice(currentPage * DIAS_POR_PAGINA, (currentPage + 1) * DIAS_POR_PAGINA);

  const getDiaSemana = (dateStr: string) => {
    const [d, m, y] = dateStr.split("/");
    return DIAS_SEMANA[new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d))).getUTCDay()];
  };

  const getDiaMes = (dateStr: string) => { const [d, m] = dateStr.split("/"); return `${d}/${m}`; };
  const isHoje = (dateStr: string) => dateStr === hoje.toLocaleDateString("pt-BR");
  const getHorarios = (slots: any[]) =>
    (slots || []).filter(s => { const h = new Date(s.starts_at).getHours(); return h >= 7 && h <= 22; })
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const handleAgendar = async (slot: any) => {
    if (!isLoggedIn) { router.push(`/mobile/login`); return; }
    if (loadingSlot) return;
    setLoadingSlot(slot.starts_at);
    try {
      const walletData = await api("/api/wallet/balance");
      const balance = walletData.balance || 0;
      const preco = terapeuta.session_price || 0;
      const startsAt = new Date(slot.starts_at);
      const therapistName = encodeURIComponent(terapeuta.full_name);
      const date = encodeURIComponent(startsAt.toLocaleDateString('pt-BR'));
      const time = encodeURIComponent(startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));

      if (balance >= preco) {
        const bookingData = await api('/api/appointments', {
          method: "POST",
          body: JSON.stringify({ therapist_user_id: terapeuta.user_id, starts_at: slot.starts_at, ends_at: slot.ends_at, duration_minutes: 50 })
        });
        await api(`/api/appointments/${bookingData.id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: "confirmed" })
        });
        router.push(`/mobile/dashboard?payment_success=true&appointment_id=${bookingData.id}&therapist_name=${therapistName}&date=${date}&time=${time}&price=${preco}`);
        return;
      }

      const residual = preco - balance;
      const successUrl = `${window.location.origin}/mobile/dashboard?payment_success=true&therapist_name=${therapistName}&date=${date}&time=${time}&price=${preco}`;
      const cancelUrl = `${window.location.origin}/mobile/terapeuta/${therapistId}?cancel=true`;
      const stripeData = await api('/api/payments/create-checkout', {
        method: "POST",
        body: JSON.stringify({ amount: residual, success_url: successUrl, cancel_url: cancelUrl, therapist_user_id: terapeuta.user_id, starts_at: slot.starts_at, ends_at: slot.ends_at, duration_minutes: 50 })
      });
      window.location.href = stripeData.checkout_url;
    } catch (err: any) {
      alert(err.message || "Erro ao agendar");
    } finally {
      setLoadingSlot(null);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.gray }}>
      <Loader2 size={40} color={COLORS.primary} className="animate-spin" />
    </div>
  );

  if (error || !terapeuta) return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray }}>
      <MobileHeader title="Terapeuta" showBack backTo="/mobile/busca" />
      <div style={{ padding: 32, textAlign: "center" }}>
        <p style={{ color: "#EF4444", marginBottom: 16 }}>{error || "Terapeuta não encontrado"}</p>
        <button onClick={() => router.push("/mobile/busca")} style={{ backgroundColor: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>
          Voltar para busca
        </button>
      </div>
    </div>
  );

  const fotoUrl = getFotoSrc(terapeuta.foto_url);
  const rating = Number(terapeuta.rating) || 0;
  const reviewsCount = Number(terapeuta.reviews_count) || 0;
  const youtubeId = terapeuta.video_url ? getYoutubeId(terapeuta.video_url) : null;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: COLORS.gray, paddingBottom: 32 }}>
      <MobileHeader title="Perfil" showBack backTo="/mobile/busca" />

      {/* HERO */}
      <div style={{ backgroundColor: COLORS.secondary, padding: "24px 16px 20px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", border: "3px solid white", flexShrink: 0, backgroundColor: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={32} color="white" />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: "white", margin: 0 }}>{terapeuta.full_name}</h1>
              {terapeuta.verified && <CheckCircle size={16} color="#4ade80" />}
            </div>
            {terapeuta.service_types?.length > 0 && (
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: "0 0 6px" }}>
                {terapeuta.service_types.map((t: string) => t === 'psicanalista' ? 'Psicanalista' : t === 'psicologo' ? 'Psicólogo' : t).join(' • ')}
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ display: "flex", gap: 1 }}>
                {[1,2,3,4,5].map(s => <Star key={s} size={12} style={{ fill: s <= Math.floor(rating) ? "#FBBF24" : "transparent", color: "#FBBF24" }} />)}
              </div>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{reviewsCount} aval.</span>
              <span style={{ fontSize: 11, color: COLORS.ciano }}>• {terapeuta.total_sessions || 0} sessões</span>
            </div>
            {terapeuta.accepts_corporate_sessions && (
              <span style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, backgroundColor: "rgba(255,255,255,0.2)", color: "white", padding: "3px 8px", borderRadius: 10 }}>
                <Building2 size={10} /> Aceita plano empresa
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "6px 14px" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "white" }}>R$ {(terapeuta.session_price || 0).toFixed(2)}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}> /sessão</span>
          </div>
          <button
            onClick={() => { const el = document.getElementById('agenda-section'); el?.scrollIntoView({ behavior: 'smooth' }); }}
            style={{ backgroundColor: COLORS.primary, color: "white", border: "none", borderRadius: 20, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
          >
            <Calendar size={14} /> Agendar sessão
          </button>
        </div>
      </div>

      <div style={{ padding: "16px" }}>

        {/* SOBRE */}
        {terapeuta.bio && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
            <SectionTitle icon={FileText} title="Sobre" />
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
              {bioExpanded ? terapeuta.bio : terapeuta.bio.slice(0, 200) + (terapeuta.bio.length > 200 ? "..." : "")}
            </p>
            {terapeuta.bio.length > 200 && (
              <button onClick={() => setBioExpanded(!bioExpanded)} style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 12, fontWeight: 500, cursor: "pointer", marginTop: 6, padding: 0 }}>
                {bioExpanded ? "Ver menos" : "Ver mais"}
              </button>
            )}
          </div>
        )}

        {/* AGENDA */}
        <div id="agenda-section" style={{ backgroundColor: "white", borderRadius: 14, overflow: "hidden", marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
          <div style={{ backgroundColor: COLORS.secondary, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={14} /> Horários disponíveis
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0} style={{ background: "none", border: "none", cursor: currentPage === 0 ? "not-allowed" : "pointer", opacity: currentPage === 0 ? 0.4 : 1, color: "white", display: "flex" }}>
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>{currentPage + 1}/{totalPaginas || 1}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPaginas - 1, p + 1))} disabled={currentPage >= totalPaginas - 1} style={{ background: "none", border: "none", cursor: currentPage >= totalPaginas - 1 ? "not-allowed" : "pointer", opacity: currentPage >= totalPaginas - 1 ? 0.4 : 1, color: "white", display: "flex" }}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div style={{ padding: 12 }}>
            {loadingSlots ? (
              <div style={{ textAlign: "center", padding: 24, color: "#6B7280", fontSize: 13 }}>Carregando horários...</div>
            ) : diasPaginados.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: "#6B7280", fontSize: 13 }}>Nenhum horário disponível</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {diasPaginados.map((dia) => {
                  const horarios = getHorarios(slotsPorDia[dia] || []);
                  const ehHoje = isHoje(dia);
                  return (
                    <div key={dia} style={{ borderRadius: 8, overflow: "hidden", border: `${ehHoje ? "2px" : "1px"} solid ${ehHoje ? COLORS.primary : COLORS.grayBorder}` }}>
                      <div style={{ textAlign: "center", padding: "6px 4px", backgroundColor: ehHoje ? COLORS.primary : COLORS.secondary, color: "white" }}>
                        <div style={{ fontSize: 10, opacity: 0.85 }}>{getDiaSemana(dia)}</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{getDiaMes(dia)}</div>
                      </div>
                      <div style={{ padding: "6px 4px", display: "flex", flexDirection: "column", gap: 4 }}>
                        {horarios.length === 0 ? (
                          <p style={{ fontSize: 10, textAlign: "center", color: "#9CA3AF", padding: "4px 0", margin: 0 }}>–</p>
                        ) : (
                          horarios.slice(0, 4).map((slot, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleAgendar(slot)}
                              disabled={!!loadingSlot}
                              style={{
                                fontSize: 11, padding: "5px 4px", borderRadius: 6,
                                backgroundColor: ehHoje ? `${COLORS.primary}1A` : COLORS.gray,
                                color: ehHoje ? "#c02c5e" : "#374151",
                                border: ehHoje ? `1px solid ${COLORS.primary}55` : "none",
                                cursor: loadingSlot ? "not-allowed" : "pointer",
                                width: "100%", opacity: loadingSlot ? 0.6 : 1,
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 2,
                                fontWeight: ehHoje ? 600 : 400,
                              }}
                            >
                              <Clock size={9} />
                              {loadingSlot === slot.starts_at ? "..." : new Date(slot.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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
        </div>

        {/* INFORMAÇÕES DA SESSÃO */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
          <SectionTitle icon={Clock} title="Informações da Sessão" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 2px" }}>Valor</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: COLORS.dark, margin: 0 }}>R$ {(terapeuta.session_price || 0).toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 4px" }}>Duração</p>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {terapeuta.session_duration_30min && <span style={{ fontSize: 11, backgroundColor: COLORS.gray, color: COLORS.secondary, padding: "2px 8px", borderRadius: 8 }}>30 min</span>}
                {terapeuta.session_duration_50min && <span style={{ fontSize: 11, backgroundColor: COLORS.gray, color: COLORS.secondary, padding: "2px 8px", borderRadius: 8 }}>50 min</span>}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.grayBorder}` }}>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 4 }}>
              <FileText size={10} /> Política de remarcação
            </p>
            <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>Remarcações até 24h antes sem custo adicional</p>
          </div>
        </div>

        {/* ABORDAGENS + ESPECIALIDADES */}
        {(terapeuta.approaches?.length > 0 || terapeuta.specialties_list?.length > 0 || terapeuta.reasons?.length > 0) && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
            {terapeuta.approaches?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Brain size={12} /> ABORDAGENS
                </p>
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {terapeuta.approaches.map((a: string, i: number) => <Tag key={i}>{a}</Tag>)}
                </div>
              </div>
            )}
            {terapeuta.specialties_list?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={12} /> ESPECIALIDADES
                </p>
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {terapeuta.specialties_list.map((s: string, i: number) => <Tag key={i}>{s}</Tag>)}
                </div>
              </div>
            )}
            {terapeuta.reasons?.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: COLORS.primary, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Target size={12} /> MOTIVOS QUE ATENDO
                </p>
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {terapeuta.reasons.map((r: string, i: number) => <Tag key={i}>{r}</Tag>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* FORMAÇÃO */}
        {terapeuta.experiencia && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
            <SectionTitle icon={GraduationCap} title="Formação e Experiência" />
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{terapeuta.experiencia}</p>
          </div>
        )}

        {/* DADOS PESSOAIS */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
          <SectionTitle icon={User} title="Sobre o profissional" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: User, label: "Gênero", value: terapeuta.gender },
              { icon: Flag, label: "Etnia", value: terapeuta.ethnicity },
              { icon: BookOpen, label: "Formação", value: terapeuta.formation },
              { icon: BarChart3, label: "Sessões", value: `${terapeuta.total_sessions || 0} realizadas` },
              { icon: Languages, label: "Idiomas", value: terapeuta.languages_list?.join(", ") || (terapeuta as any).idiomas },
              { icon: Heart, label: "LGBTQIA+", value: terapeuta.lgbtqia_ally ? "✓ Aliado" : null },
            ].filter(item => item.value).map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ backgroundColor: COLORS.gray, borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ fontSize: 10, color: "#9CA3AF", margin: "0 0 2px", display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon size={10} /> {label.toUpperCase()}
                </p>
                <p style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* VÍDEO */}
        {youtubeId && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
            <SectionTitle icon={Youtube} title="Vídeo de apresentação" />
            <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: 8 }}>
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                title="Apresentação"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: 8 }}
              />
            </div>
          </div>
        )}

        {/* AVALIAÇÕES */}
        {avaliacoes.length > 0 && (
          <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
            <SectionTitle icon={Star} title={`Avaliações (${reviewsCount})`} />
            {avaliacoes.slice(0, 5).map((aval: any, i: number) => (
              <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < Math.min(avaliacoes.length, 5) - 1 ? `1px solid ${COLORS.grayBorder}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.dark }}>{aval.patient_name || "Paciente"}</span>
                  <div style={{ display: "flex", gap: 1 }}>
                    {[1,2,3,4,5].map(s => <Star key={s} size={10} style={{ fill: s <= aval.rating ? "#FBBF24" : "transparent", color: "#FBBF24" }} />)}
                  </div>
                </div>
                {aval.comment && <p style={{ fontSize: 12, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>{aval.comment}</p>}
              </div>
            ))}
          </div>
        )}

        {/* CONFIANÇA */}
        <div style={{ backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, border: `1px solid ${COLORS.grayBorder}` }}>
          <SectionTitle icon={ShieldCheck} title="Confiança e Segurança" />
          {[
            { icon: Video, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", title: "Atendimento online", desc: "Sessões por videochamada segura e criptografada" },
            { icon: Lock, color: COLORS.primary, bg: "#fdf2f8", border: "#fbcfe8", title: "Pagamento 100% seguro", desc: "Processado via Stripe com criptografia de ponta a ponta" },
            ...(terapeuta.verified ? [{ icon: ShieldCheck, color: COLORS.dark, bg: "#f0fdf4", border: "#bbf7d0", title: "Profissional verificado", desc: "Documentos e formação verificados pela equipe Meu Divã" }] : []),
          ].map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div key={title} style={{ backgroundColor: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#111827", margin: "0 0 2px" }}>{title}</p>
                <p style={{ fontSize: 11, color: "#6B7280", margin: 0 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}