"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video, Search, FileText,
  Mail, User, BarChart3, Clock, Users,
  ChevronRight, Zap, Star, CheckCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import MobileHeader from "@/components/mobile/MobileHeader";
import { getFotoSrc } from "@/lib/utils";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  primaryLight: "#FDE8F0",
  secondaryLight: "#E3F0FD",
  dark: "#3A3B21",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
};

interface StatCard {
  label: string;
  value: string | number;
  sub: string;
}

interface NavCard {
  name: string;
  desc: string;
  href: string;
  icon: React.ElementType;
  color: string;
  iconColor: string;
}

export default function MobileDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [nextSession, setNextSession] = useState<any>(null);
  const [lastTherapistId, setLastTherapistId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const role = user?.role;
  const firstName = user?.full_name?.split(" ")[0] || "você";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const appointments = await api("/api/appointments/me/details").catch(() => []);
      const now = new Date();

      const upcoming = (appointments || []).filter((a: any) =>
        new Date(a.starts_at) > now && ["scheduled", "confirmed"].includes(a.status)
      ).length;

      const completed = (appointments || []).filter((a: any) =>
        a.status === "completed"
      ).length;

      const cancelled = (appointments || []).filter((a: any) =>
        a.status?.includes("cancelled")
      ).length;

      let availability = 0;
      let pendingRecords = 0;
      let averageRating = "5.0";
      let totalReviews = 0;
      let totalComplaints = 0;

      if (role === "therapist") {
        const [availData, reviewData] = await Promise.all([
          api("/api/therapist/availability").catch(() => null),
          api("/api/reviews/me").catch(() => null),
        ]);
        availability = Array.isArray(availData) ? availData.length : 0;
        averageRating = reviewData?.length
          ? (reviewData.reduce((acc: number, r: any) => acc + r.rating, 0) / reviewData.length).toFixed(1)
          : "5.0";
        totalReviews = reviewData?.length ?? 0;
      }

      if (role === "patient") {
        totalComplaints = (appointments || []).filter((a: any) => a.complaint).length;

        const lastAppt = (appointments || [])
          .filter((a: any) => ["completed", "confirmed", "scheduled"].includes(a.status))
          .sort((a: any, b: any) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
        if (lastAppt?.therapist?.id) {
          setLastTherapistId(lastAppt.therapist.id);
        }
      }

      setStats({
        upcoming_sessions: upcoming,
        completed_sessions: completed,
        cancelled_sessions: cancelled,
        availability_slots: availability,
        pending_records: pendingRecords,
        average_rating: averageRating,
        total_reviews: totalReviews,
        total_complaints: totalComplaints,
      });

      const nextUp = (appointments || [])
        .filter((a: any) => a.status === "confirmed" && new Date(a.starts_at) > now)
        .sort((a: any, b: any) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      setNextSession(nextUp[0] || null);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (d?: string) => {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const patientStats: StatCard[] = [
    { label: "Sessões realizadas", value: stats?.completed_sessions ?? "-", sub: "Já realizadas" },
    { label: "Próximas sessões", value: stats?.upcoming_sessions ?? "-", sub: "Agendadas" },
    { label: "Sessões canceladas", value: stats?.cancelled_sessions ?? "-", sub: "Todo período" },
    { label: "Queixas registradas", value: stats?.total_complaints ?? "-", sub: "Total" },
  ];

  const therapistStats: StatCard[] = [
    { label: "Próximas sessões", value: stats?.upcoming_sessions ?? "-", sub: "Agendadas" },
    { label: "Sessões realizadas", value: stats?.completed_sessions ?? "-", sub: "Já realizadas" },
    { label: "Cancelamentos", value: stats?.cancelled_sessions ?? "-", sub: "Todo período" },
    { label: "Disponibilidade", value: stats?.availability_slots ?? "-", sub: "Horários config." },
  ];

  const patientCards: NavCard[] = [
    { name: "Sessões", desc: "Próximas sessões", href: "/patient/sessions/upcoming", icon: Video, color: COLORS.primaryLight, iconColor: COLORS.primary },
    { name: "Buscar", desc: "Encontrar terapeuta", href: "/mobile/busca", icon: Search, color: COLORS.secondaryLight, iconColor: COLORS.secondary },
    { name: "Queixas", desc: "Registrar queixa", href: "/mobile/queixas", icon: FileText, color: COLORS.primaryLight, iconColor: COLORS.primary },
    { name: "Agendar", desc: "Agende com seu terapeuta", href: "/mobile/agendar", icon: Zap, color: COLORS.secondaryLight, iconColor: COLORS.secondary },
    { name: "Convites", desc: "Convites recebidos", href: "/patient/invites", icon: Mail, color: COLORS.primaryLight, iconColor: COLORS.primary },
    { name: "Avaliações", desc: "Avaliar sessões", href: "/mobile/avaliacoes", icon: Star, color: COLORS.primaryLight, iconColor: COLORS.primary },
    { name: "Histórico", desc: "Sessões realizadas", href: "/mobile/sessoes-realizadas", icon: CheckCircle, color: COLORS.secondaryLight, iconColor: COLORS.secondary },
    { name: "Meu Perfil", desc: "Dados e preferências", href: "/patient/profile", icon: User, color: "#F3F4F6", iconColor: "#374151" },
  ];

  const therapistCards: NavCard[] = [
    { name: "Pacientes", desc: "Minha lista", href: "/therapist/patients", icon: Users, color: COLORS.primaryLight, iconColor: COLORS.primary },
    { name: "Sessões", desc: "Próximas e passadas", href: "/therapist/sessions/upcoming", icon: Video, color: COLORS.secondaryLight, iconColor: COLORS.secondary },
    { name: "Disponibilidade", desc: "Gerenciar horários", href: "/therapist/availability", icon: Clock, color: COLORS.primaryLight, iconColor: COLORS.primary },
    { name: "Convites", desc: "Acompanhar status", href: "/therapist/invites", icon: Mail, color: COLORS.secondaryLight, iconColor: COLORS.secondary },
  ];

  const currentStats = role === "patient" ? patientStats : therapistStats;
  const currentCards = role === "patient" ? patientCards : therapistCards;

  const sessionPersonName = role === "patient"
    ? nextSession?.therapist?.full_name
    : nextSession?.patient?.full_name;

  const sessionPersonPhoto = getFotoSrc(
    role === "patient" ? nextSession?.therapist?.foto_url : nextSession?.patient?.foto_url
  );

  return (
    <div style={{ backgroundColor: COLORS.gray, minHeight: "100vh", paddingBottom: 32 }}>

      <MobileHeader />

      {/* BANNER DE BOAS VINDAS */}
      <div style={{ backgroundColor: COLORS.primary, padding: "16px 16px 20px" }}>
        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, marginBottom: 8 }}>
          {greeting}, {firstName}!
        </div>

        {nextSession ? (
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {sessionPersonPhoto ? (
                <img src={sessionPersonPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ color: "white", fontSize: 14, fontWeight: 500 }}>
                  {sessionPersonName?.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, marginBottom: 2 }}>Próxima sessão</div>
              <div style={{ color: "white", fontSize: 13, fontWeight: 500 }}>
                {formatTime(nextSession.starts_at)} — {sessionPersonName}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.18)", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Nenhuma sessão agendada</div>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 16px 0" }}>

        {/* STATS */}
        <div style={{ fontSize: 11, color: "#888", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 10 }}>RESUMO</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {currentStats.map((s, i) => (
            <div key={i} style={{ background: COLORS.primary, borderRadius: 14, padding: 12, color: "white" }}>
              <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{loading ? "..." : s.value}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* PRONTUÁRIOS + AVALIAÇÃO — só terapeuta */}
        {role === "therapist" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div style={{ background: COLORS.primary, borderRadius: 14, padding: 12, color: "white" }}>
              <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>Prontuários pendentes</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{loading ? "..." : stats?.pending_records ?? 0}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>Para preencher</div>
            </div>
            <div style={{ background: "#c02c5e", borderRadius: 14, padding: 12, color: "white" }}>
              <div style={{ fontSize: 10, opacity: 0.85, marginBottom: 2 }}>Avaliação média</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{loading ? "..." : `${stats?.average_rating ?? "5.0"} ★`}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 1 }}>{stats?.total_reviews ?? 0} avaliações</div>
            </div>
          </div>
        )}

        {/* NAV CARDS */}
        <div style={{ fontSize: 11, color: "#888", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 10 }}>O QUE VOCÊ QUER FAZER?</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          {currentCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.href + card.name}
                onClick={() => router.push(card.href)}
                style={{ background: "white", border: `0.5px solid ${COLORS.grayBorder}`, borderRadius: 14, padding: "14px 12px 12px", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer" }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 10, background: card.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} color={card.iconColor} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{card.name}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{card.desc}</div>
              </div>
            );
          })}
        </div>

        {/* CARDS LARGOS — terapeuta */}
        {role === "therapist" && (
          <>
            {[
              { name: "Relatório Financeiro", desc: "Ganhos e histórico", href: "/therapist/financial-report", icon: BarChart3, color: COLORS.secondaryLight, iconColor: COLORS.secondary },
              { name: "Meu Perfil", desc: "Dados e disponibilidade", href: "/therapist/profile", icon: User, color: "#F3F4F6", iconColor: "#374151" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.href + item.name}
                  onClick={() => router.push(item.href)}
                  style={{ background: "white", border: `0.5px solid ${COLORS.grayBorder}`, borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10, cursor: "pointer" }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={18} color={item.iconColor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{item.desc}</div>
                  </div>
                  <ChevronRight size={18} color="#9CA3AF" />
                </div>
              );
            })}

            {/* UPGRADE CARD */}
            <div style={{ background: "linear-gradient(135deg, #2F80D3, #1a5fa8)", borderRadius: 14, padding: 14, marginBottom: 10, color: "white" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, display: "flex", alignItems: "center", gap: 8 }}>
                Potencialize sua prática
                <span style={{ background: "#FB8811", color: "white", fontSize: 9, padding: "2px 6px", borderRadius: 6 }}>Comissões reduzidas</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 10 }}>Escolha o plano ideal para crescer</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>Profissional</div>
                    <span style={{ background: "#FB8811", color: "white", fontSize: 9, padding: "1px 5px", borderRadius: 5 }}>Top</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>R$ 79<span style={{ fontSize: 10, opacity: 0.8 }}>/mês</span></div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>Comissão: 10%</div>
                </div>
                <div style={{ background: "rgba(224,54,115,0.4)", borderRadius: 10, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>Premium</div>
                    <span style={{ background: "#E03673", color: "white", fontSize: 9, padding: "1px 5px", borderRadius: 5 }}>Melhor</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>R$ 149<span style={{ fontSize: 10, opacity: 0.8 }}>/mês</span></div>
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>Comissão: 3%</div>
                </div>
              </div>
              <div
                onClick={() => router.push("/planos")}
                style={{ marginTop: 10, background: "white", color: COLORS.secondary, borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 500, cursor: "pointer", textAlign: "center" }}
              >
                Upgrade Agora →
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}