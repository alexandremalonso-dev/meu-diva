"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Cabecalho } from "./components/Cabecalho";
import { Sobre } from "./components/Sobre";
import { InformacoesSessao } from "./components/InformacoesSessao";
import { AgendaPublica } from "./components/AgendaPublica";
import { Confianca } from "./components/Confianca";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { AvaliacoesTerapeuta } from "@/components/AvaliacoesTerapeuta";
import type { TerapeutaPublico, AgendaResumida } from "./types";
import {
  Search,
  LayoutDashboard,
  GraduationCap,
  Brain,
  Star,
  Heart,
  Target,
  User,
  BookOpen,
  Flag,
  BarChart3,
  Sparkles,
  Languages,
  Calendar,
  Youtube
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-block", backgroundColor: `${CORES.azul}15`, color: CORES.azul, padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "500", margin: "4px" }}>
    {children}
  </span>
);

const SecondaryCard = ({ icon: IconComponent, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) => (
  <div style={{ backgroundColor: CORES.branco, borderRadius: "12px", padding: "16px", border: `1px solid ${CORES.cinzaBorda}`, height: "100%", display: "flex", flexDirection: "column" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
      <IconComponent size={20} color={CORES.rosa} />
      <h4 style={{ fontSize: "12px", fontWeight: "600", color: CORES.rosa, margin: 0, textTransform: "uppercase" }}>{title}</h4>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>{children}</div>
  </div>
);

const getYoutubeId = (url: string): string | null => {
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
};

export default function PaginaPublicaTerapeuta() {
  const params = useParams();
  const router = useRouter();
  const therapistId = params.id as string;
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [terapeuta, setTerapeuta] = useState<TerapeutaPublico | null>(null);
  const [agenda, setAgenda] = useState<AgendaResumida | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  const [loadingAvaliacoes, setLoadingAvaliacoes] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    async function carregarDados() {
      try {
        const numericId = Number(therapistId);
        if (isNaN(numericId)) throw new Error("ID do terapeuta inválido");

        const responseTerapeuta = await fetch(`${BACKEND_URL}/public/terapeutas/${numericId}`);
        if (!responseTerapeuta.ok) {
          let errorMsg = `Erro ${responseTerapeuta.status}`;
          try { const d = await responseTerapeuta.json(); errorMsg = d.detail || d.message || errorMsg; } catch {}
          throw new Error(errorMsg);
        }

        const dadosTerapeuta = await responseTerapeuta.json();
        setTerapeuta({...dadosTerapeuta});

        const terapeutaIdSlots = dadosTerapeuta.id || dadosTerapeuta.profile_id || numericId;
        const responseSlots = await fetch(`${BACKEND_URL}/public/terapeutas/${terapeutaIdSlots}/slots?days=30`);
        if (responseSlots.ok) {
          const slots = await responseSlots.json();
          setAgenda(slots);
        } else {
          setAgenda(null);
        }

        try {
          const responseAvaliacoes = await fetch(`${BACKEND_URL}/api/reviews/therapist/${dadosTerapeuta.user_id}?limit=20`);
          if (responseAvaliacoes.ok) {
            const dadosAvaliacoes = await responseAvaliacoes.json();
            setAvaliacoes(dadosAvaliacoes);
          }
        } catch (err) {
          console.error("Erro ao carregar avaliações:", err);
        } finally {
          setLoadingAvaliacoes(false);
        }

      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar dados do terapeuta");
      } finally {
        setLoading(false);
      }
    }
    if (therapistId) carregarDados();
  }, [therapistId]);

  const handleAgendar = () => {
    if (isLoggedIn) {
      router.push(`/agendar/${therapistId}`);
    } else {
      router.push(`/auth/login?redirect=/terapeuta/${therapistId}`);
    }
  };

  const youtubeId = (terapeuta as any)?.video_url ? getYoutubeId((terapeuta as any).video_url) : null;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "50%", borderBottom: `2px solid ${CORES.rosa}`, animation: "spin 1s linear infinite" }}></div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !terapeuta) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ backgroundColor: "#FEE2E2", padding: "32px", borderRadius: "16px", textAlign: "center", maxWidth: "448px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#DC2626", marginBottom: "16px" }}>Erro ao carregar terapeuta</h2>
          <p style={{ color: "#374151" }}>{error || "Terapeuta não encontrado"}</p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
            <button onClick={() => router.push("/busca")} style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: CORES.azul, color: CORES.branco, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              <Search size={16} /> Voltar para busca
            </button>
            {isLoggedIn && (
              <button onClick={() => router.push("/patient/dashboard")} style={{ padding: "8px 16px", borderRadius: "8px", backgroundColor: CORES.rosa, color: CORES.branco, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <LayoutDashboard size={16} /> Ir para Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", display: "flex", flexDirection: "column" }}>

      {/* Header — esconde no mobile pois o MobileHeader já está no layout */}
      {!isMobile && (isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />)}

      {/* Hero azul */}
      <div style={{ backgroundColor: CORES.azul }}>
        <div style={{ maxWidth: "1152px", margin: "0 auto", padding: isMobile ? "24px 16px" : "48px 16px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px", gap: "12px" }}>
            <Link href="/busca" style={{ textDecoration: "none" }}>
              <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", backgroundColor: `${CORES.branco}20`, color: CORES.branco, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}>
                <Search size={16} /> Voltar para busca
              </button>
            </Link>
            {isLoggedIn && (
              <Link href="/patient/dashboard" style={{ textDecoration: "none" }}>
                <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", backgroundColor: CORES.branco, color: CORES.azul, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}>
                  <LayoutDashboard size={16} /> Dashboard
                </button>
              </Link>
            )}
          </div>
          <Cabecalho
            key={`${terapeuta.id}_${terapeuta.rating}_${terapeuta.reviews_count}_${terapeuta.total_sessions}`}
            terapeuta={terapeuta}
            isLoggedIn={isLoggedIn}
            onAgendar={handleAgendar}
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: isMobile ? "16px" : "32px 16px", flex: 1, width: "100%" }}>

        <div style={{ marginBottom: "32px" }}>
          <Sobre terapeuta={terapeuta} mostrarBioApenas={true} />
        </div>

        <div style={{ marginBottom: "32px" }}>
          {agenda && agenda.slots && agenda.slots.length > 0 ? (
            <AgendaPublica
              agenda={agenda}
              therapistId={therapistId}
              sessionPrice={terapeuta.session_price || 200}
              isLoggedIn={isLoggedIn}
              onAgendar={handleAgendar}
            />
          ) : (
            <div style={{ backgroundColor: CORES.branco, borderRadius: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", padding: "48px", textAlign: "center" }}>
              <Calendar size={48} style={{ margin: "0 auto 16px", color: CORES.cinza }} />
              <p style={{ color: "#6B7280", fontSize: "18px" }}>Nenhum horário disponível no momento</p>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "32px", marginBottom: "32px" }}>
          <InformacoesSessao terapeuta={terapeuta} isLoggedIn={isLoggedIn} />
          <Confianca terapeuta={terapeuta} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "32px", marginBottom: "32px" }}>
          {terapeuta.experiencia && (
            <div style={{ backgroundColor: CORES.branco, borderRadius: "16px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", padding: "24px", height: "fit-content" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "16px", color: CORES.azul, display: "flex", alignItems: "center", gap: "8px" }}>
                <GraduationCap size={24} /> Formação e Experiência
              </h2>
              <p style={{ color: "#374151", whiteSpace: "pre-line", lineHeight: "1.6", fontSize: "14px" }}>{terapeuta.experiencia}</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ backgroundColor: CORES.branco, borderRadius: "12px", padding: "16px", border: `1px solid ${CORES.cinzaBorda}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Brain size={24} color={CORES.rosa} />
                <h4 style={{ fontSize: "13px", fontWeight: "600", color: CORES.rosa, margin: 0, textTransform: "uppercase" }}>Abordagens</h4>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {terapeuta.approaches?.length ? terapeuta.approaches.map((item, i) => <Tag key={i}>{item}</Tag>)
                  : terapeuta.abordagem ? <Tag>{terapeuta.abordagem}</Tag>
                  : <Tag>Não informado</Tag>}
              </div>
            </div>

            <div style={{ backgroundColor: CORES.branco, borderRadius: "12px", padding: "16px", border: `1px solid ${CORES.cinzaBorda}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Star size={24} color={CORES.rosa} />
                <h4 style={{ fontSize: "13px", fontWeight: "600", color: CORES.rosa, margin: 0, textTransform: "uppercase" }}>Especialidades</h4>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {terapeuta.specialties_list?.length ? terapeuta.specialties_list.map((item, i) => <Tag key={i}>{item}</Tag>)
                  : terapeuta.specialties ? <Tag>{terapeuta.specialties}</Tag>
                  : <Tag>Não informado</Tag>}
              </div>
            </div>

            <div style={{ backgroundColor: CORES.branco, borderRadius: "12px", padding: "16px", border: `1px solid ${CORES.cinzaBorda}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <Target size={24} color={CORES.rosa} />
                <h4 style={{ fontSize: "13px", fontWeight: "600", color: CORES.rosa, margin: 0, textTransform: "uppercase" }}>Motivos que atendo</h4>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {terapeuta.reasons?.length ? terapeuta.reasons.map((item, i) => <Tag key={i}>{item}</Tag>)
                  : terapeuta.specialties_list?.length ? terapeuta.specialties_list.map((item, i) => <Tag key={i}>{item}</Tag>)
                  : <Tag>Ansiedade, Depressão, Relacionamentos</Tag>}
              </div>
            </div>

            {youtubeId && (
              <div style={{ backgroundColor: CORES.branco, borderRadius: "12px", padding: "16px", border: `1px solid ${CORES.cinzaBorda}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <Youtube size={20} color={CORES.rosa} />
                  <h4 style={{ fontSize: "13px", fontWeight: "600", color: CORES.rosa, margin: 0, textTransform: "uppercase" }}>Vídeo de apresentação</h4>
                </div>
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", borderRadius: "8px" }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: "32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(7, minmax(0, 1fr))", gap: "16px" }}>
            <SecondaryCard icon={Sparkles} title="Atuo como">
              {terapeuta.service_types?.length ? (
                terapeuta.service_types.map((item, i) => (
                  <Tag key={i}>{item === 'psicanalista' ? 'Psicanalista' : item === 'psicologo' ? 'Psicólogo' : item === 'nutricionista' ? 'Nutricionista' : item === 'psiquiatra' ? 'Psiquiatra' : item}</Tag>
                ))
              ) : <Tag>Psicanalista</Tag>}
            </SecondaryCard>

            <SecondaryCard icon={Languages} title="Idiomas">
              {terapeuta.languages_list?.length ? terapeuta.languages_list.map((item, i) => <Tag key={i}>{item}</Tag>)
                : (terapeuta as any).idiomas ? <Tag>{(terapeuta as any).idiomas}</Tag>
                : <Tag>Português</Tag>}
            </SecondaryCard>

            <SecondaryCard icon={User} title="Gênero">
              <Tag>{terapeuta.gender || "Não informado"}</Tag>
            </SecondaryCard>

            <SecondaryCard icon={Flag} title="Etnia">
              <Tag>{terapeuta.ethnicity || "Não informado"}</Tag>
            </SecondaryCard>

            <SecondaryCard icon={BookOpen} title="Formação">
              <Tag>{terapeuta.formation || "Não informado"}</Tag>
            </SecondaryCard>

            <SecondaryCard icon={Heart} title="LGBTQIAPN+">
              {terapeuta.lgbtqia_ally ? (
                <><Tag>✓ Aliado</Tag><Tag>✓ Pertencente</Tag></>
              ) : <Tag>Não informado</Tag>}
            </SecondaryCard>

            <SecondaryCard icon={BarChart3} title="Experiência">
              {terapeuta.total_sessions === undefined || terapeuta.total_sessions === null ? <Tag>Carregando...</Tag>
                : terapeuta.total_sessions === 0 ? <Tag>Nenhuma sessão</Tag>
                : <Tag>{terapeuta.total_sessions} sessão{terapeuta.total_sessions === 1 ? '' : 's'}</Tag>}
            </SecondaryCard>
          </div>
        </div>

        <div style={{ marginBottom: "32px" }}>
          <AvaliacoesTerapeuta
            avaliacoes={avaliacoes}
            loading={loadingAvaliacoes}
            mediaRating={terapeuta.rating || 0}
            totalReviews={terapeuta.reviews_count || 0}
          />
        </div>
      </div>

      {/* Footer — esconde no mobile */}
      {!isMobile && (isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />)}

    </div>
  );
}