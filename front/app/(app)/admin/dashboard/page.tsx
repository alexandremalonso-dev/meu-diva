"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { getFotoSrc } from '@/lib/utils';
import Link from "next/link";
import {
  Calendar, Users, User, ArrowRight, X, Loader2,
  BarChart2, UserPlus, CheckCircle, XCircle, DollarSign, Activity,
  CreditCard, Building2
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

import { MenuCard } from "@/app/(app)/therapist/dashboard/components/cards/MenuCard";
import { CalendarAdmin } from "@/components/calendar/CalendarAdmin";
import { StatsCards } from "./components/StatsCards";
import { useStats } from "./components/hooks/useStats";
import type { Appointment } from '@/types/appointment';
import { ChartTooltip } from '@/components/ui/ChartTooltip';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserData {
  id: number;
  email: string;
  role: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
  foto_url?: string;
}

interface SubscriptionData {
  therapist_id: number;
  user_id: number;
  name: string;
  email: string;
  plan: string;
  subscription_status: string;
  total_commission_paid: number;
  total_sessions: number;
  current_period_end?: string;
  created_at?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, onClick, active = false, children }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; onClick?: () => void; active?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div onClick={onClick}
      className={`bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-sm p-4 text-white transition-all hover:shadow-md hover:scale-[1.02] ${onClick ? "cursor-pointer" : ""} ${active ? "ring-2 ring-white/50 ring-offset-2" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/80">{title}</span>
        <Icon className="w-5 h-5 text-white/70" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
      {children}
    </div>
  );
}

// Avatar com foto ou inicial
function UserAvatar({ fotoUrl, name, size = "sm" }: { fotoUrl?: string | null; name?: string | null; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  const initial = name?.charAt(0).toUpperCase() || "U";
  
  let src: string | null = null;
  if (fotoUrl) {
    if (fotoUrl.startsWith("http")) {
      src = fotoUrl;
    } else {
      src = getFotoSrc(fotoUrl) ?? "";
    }
  }
  
  return (
    <div className={`${dim} rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0`}>
      {src ? (
        <img 
          src={src} 
          alt={name || ""} 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            if (e.currentTarget.parentElement) {
              e.currentTarget.parentElement.innerHTML = `<span class="text-white font-bold">${initial}</span>`;
              e.currentTarget.parentElement.className = `${dim} rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white font-bold flex-shrink-0`;
            }
          }}
        />
      ) : (
        <span className="text-white font-bold">{initial}</span>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [totalAvailability, setTotalAvailability] = useState<number>(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [subscriptionChartData, setSubscriptionChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [modalFilter, setModalFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  
  // Dados para os cards
  const [reportData, setReportData] = useState({
    geral: { revenue: 0, sessions: 0 },
    terapeutas: { revenue: 0, sessions: 0 },
    plataforma: { revenue: 0, sessions: 0 },
    assinaturas: { revenue: 0, subscribers: 0, mrr: 0 }
  });

  // Usando o hook useStats com totalAvailability
  const stats = useStats(appointments, totalAvailability);

  // Estatísticas de usuários para os cards
  const userStats = useMemo(() => {
    const therapists = users.filter(u => u.role === "therapist");
    const patients = users.filter(u => u.role === "patient");
    const last30 = new Date(); last30.setDate(last30.getDate() - 30);
    return {
      total: users.length,
      therapists: therapists.length,
      patients: patients.length,
      newTherapists: therapists.filter(u => new Date(u.created_at) >= last30).length,
      newPatients: patients.filter(u => new Date(u.created_at) >= last30).length,
      active: users.filter(u => u.is_active).length,
    };
  }, [users]);

  const filteredForModal = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    let base = [...appointments];
    
    if (periodFilter === "week") base = base.filter((a: Appointment) => a.starts_at && new Date(a.starts_at) >= startOfWeek);
    else if (periodFilter === "month") base = base.filter((a: Appointment) => a.starts_at && new Date(a.starts_at) >= startOfMonth);
    else if (periodFilter === "year") base = base.filter((a: Appointment) => a.starts_at && new Date(a.starts_at) >= startOfYear);
    
    if (modalFilter === "upcoming") return base.filter((a: Appointment) => a.starts_at && new Date(a.starts_at) > now && ["scheduled", "confirmed"].includes(a.status));
    if (modalFilter === "completed") return base.filter((a: Appointment) => a.status === "completed");
    if (modalFilter === "cancelled") return base.filter((a: Appointment) => a.status?.includes("cancelled"));
    return base;
  }, [appointments, modalFilter, periodFilter]);

  // Buscar disponibilidade total
  const loadTotalAvailability = useCallback(async () => {
    try {
      const data = await apiCall({
        url: "/api/admin/availability/all",
        requireAuth: true
      });
      
      if (data && Array.isArray(data) && data.length > 0) {
        let totalSlots = 0;
        for (const therapist of data) {
          if (therapist?.periods && Array.isArray(therapist.periods)) {
            for (const period of therapist.periods) {
              if (period?.slots && Array.isArray(period.slots)) {
                totalSlots += period.slots.length;
              }
            }
          }
        }
        setTotalAvailability(totalSlots);
      } else {
        setTotalAvailability(0);
      }
    } catch (err) {
      console.error("Erro ao carregar disponibilidade:", err);
      setTotalAvailability(0);
    }
  }, [apiCall]);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [appointmentsData, usersData, subscriptionsData] = await Promise.all([
        apiCall({ url: "/api/appointments/admin/all", requireAuth: true }),
        apiCall({ url: "/api/users", requireAuth: true }),
        apiCall({ url: "/api/admin/reports/therapists-by-plan", requireAuth: true }).catch(() => []),
      ]);

      setAppointments(appointmentsData);
      setUsers(usersData);
      setSubscriptions(subscriptionsData || []);

      await loadTotalAvailability();

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      const dailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        revenue: 0,
        sessions: 0,
        liquidRevenue: 0,
        commission: 0
      }));
      
      appointmentsData.forEach((apt: Appointment) => {
        if (apt.status === "completed" && apt.session_price && apt.starts_at) {
          const aptDate = new Date(apt.starts_at);
          if (aptDate.getFullYear() === year && aptDate.getMonth() === month) {
            const dayIndex = aptDate.getDate() - 1;
            if (dayIndex >= 0 && dayIndex < daysInMonth) {
              const commission = apt.session_price * 0.2;
              const liquid = apt.session_price - commission;
              dailyData[dayIndex].revenue += apt.session_price;
              dailyData[dayIndex].sessions += 1;
              dailyData[dayIndex].liquidRevenue += liquid;
              dailyData[dayIndex].commission += commission;
            }
          }
        }
      });
      
      setChartData(dailyData);
      
      const currentMonthAppointments = appointmentsData.filter((apt: Appointment) => {
        if (!apt.starts_at) return false;
        const aptDate = new Date(apt.starts_at);
        return aptDate.getFullYear() === year && aptDate.getMonth() === month && apt.status === "completed";
      });
      
      const currentMonthRevenue = currentMonthAppointments.reduce((sum: number, apt: Appointment) => sum + (apt.session_price || 0), 0);
      const currentMonthSessions = currentMonthAppointments.length;
      const currentMonthLiquid = currentMonthRevenue * 0.8;
      const currentMonthCommission = currentMonthRevenue * 0.2;
      
      const activeSubscriptions = (subscriptionsData || []).filter((s: any) => s.subscription_status === "active");
      const mrr = activeSubscriptions.reduce((sum: number, s: any) => {
        if (s.plan === "profissional") return sum + 79;
        if (s.plan === "premium") return sum + 149;
        return sum;
      }, 0);
      
      const subscriptionDailyData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        subscribers: 0,
        mrr: 0
      }));
      
      activeSubscriptions.forEach((sub: any) => {
        const createdAt = sub.created_at ? new Date(sub.created_at) : null;
        if (createdAt && createdAt.getFullYear() === year && createdAt.getMonth() === month) {
          const dayIndex = createdAt.getDate() - 1;
          if (dayIndex >= 0 && dayIndex < daysInMonth) {
            subscriptionDailyData[dayIndex].subscribers += 1;
            const planValue = sub.plan === "profissional" ? 79 : sub.plan === "premium" ? 149 : 0;
            subscriptionDailyData[dayIndex].mrr += planValue;
          }
        }
      });
      
      let accumulatedSubscribers = 0;
      let accumulatedMrr = 0;
      for (let i = 0; i < daysInMonth; i++) {
        accumulatedSubscribers += subscriptionDailyData[i].subscribers;
        accumulatedMrr += subscriptionDailyData[i].mrr;
        subscriptionDailyData[i].subscribers = accumulatedSubscribers;
        subscriptionDailyData[i].mrr = accumulatedMrr;
      }
      
      setSubscriptionChartData(subscriptionDailyData);
      
      setReportData({
        geral: { revenue: currentMonthRevenue, sessions: currentMonthSessions },
        terapeutas: { revenue: currentMonthLiquid, sessions: currentMonthSessions },
        plataforma: { revenue: currentMonthCommission, sessions: currentMonthSessions },
        assinaturas: { revenue: mrr, subscribers: activeSubscriptions.length, mrr: mrr }
      });
      
    } catch (err) {
      console.error("❌ Erro:", err);
      setError("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall, loadTotalAvailability]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpcomingClick = () => {
    setModalFilter("upcoming");
    setPeriodFilter("all");
    setShowSessionsModal(true);
  };

  const handlePeriodFilter = (period: string, type: "completed" | "cancelled" | "availability") => {
    if (type === "completed" || type === "cancelled") {
      setModalFilter(type);
      setPeriodFilter(period);
    }
    if (type === "availability") {
      setModalFilter(type);
      setPeriodFilter(period);
    }
  };

  const handleAvailabilityClick = () => {};
  const handleFinancialClick = () => { router.push("/admin/reports/geral"); };

  const formatDate = (d?: string) => {
    if (!d) return "--/--/---- --:--";
    return new Date(d).toLocaleDateString("pt-BR") + " às " + new Date(d).toLocaleTimeString("pt-BR").slice(0, 5);
  };
  
  const statusColor = (s: string) => {
    if (s === "scheduled") return "bg-green-100 text-green-800";
    if (s === "confirmed") return "bg-blue-100 text-blue-800";
    if (s === "proposed") return "bg-yellow-100 text-yellow-800";
    if (s.includes("cancelled")) return "bg-red-100 text-red-800";
    if (s === "completed") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };
  
  const statusLabel = (s: string) => {
    if (s === "scheduled") return "Agendada";
    if (s === "confirmed") return "Confirmada";
    if (s === "proposed") return "Convite pendente";
    if (s === "cancelled_by_patient") return "Cancelada (paciente)";
    if (s === "cancelled_by_therapist") return "Cancelada (terapeuta)";
    if (s === "completed") return "Realizada";
    return s;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  const hasSubscriptionData = subscriptionChartData.some(d => d.subscribers > 0 || d.mrr > 0);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Olá, {user?.full_name || user?.email}!</h1>
        <p className="text-sm text-gray-600 mt-1">Painel Administrativo — visão geral da plataforma</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && <div className="p-3 bg-red-50 text-red-700 rounded border border-red-200">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MenuCard href="/admin/dashboard" icon="dashboard" title="Dashboard" description="Visão geral" color="blue" />
          <MenuCard href="/admin/users" icon="users" title="Usuários" description="Todos" color="blue" />
          <MenuCard href="/admin/therapists" icon="user" title="Terapeutas" description="Gerenciar" color="blue" />
          <MenuCard href="/admin/patients" icon="users" title="Pacientes" description="Gerenciar" color="blue" />
          <MenuCard href="/admin/sessions" icon="calendar" title="Sessões" description="Todas" color="blue" />
          <MenuCard href="/admin/availability" icon="calendar" title="Agendas" description="Disponibilidade" color={"blue"} />
          <MenuCard href="/admin/invites" icon="invites" title="Convites" description="Enviados" color="blue" />
          <MenuCard href="/admin/reports" icon="reports" title="Relatórios" description="Financeiro" color="blue" />
        </div>

        <StatsCards
          stats={stats}
          sessionFilter={modalFilter}
          selectedPeriod={periodFilter}
          onUpcomingClick={handleUpcomingClick}
          onPeriodFilter={handlePeriodFilter}
          onAvailabilityClick={handleAvailabilityClick}
          onFinancialClick={handleFinancialClick}
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard title="Total Usuários" value={userStats.total} subtitle={`${userStats.active} ativos`} icon={Users} onClick={() => router.push("/admin/users")} />
          <StatCard title="Terapeutas" value={userStats.therapists} subtitle="Cadastrados" icon={Activity} onClick={() => router.push("/admin/therapists")} />
          <StatCard title="Pacientes" value={userStats.patients} subtitle="Cadastrados" icon={User} onClick={() => router.push("/admin/patients")} />
          <StatCard title="Novos Terapeutas" value={userStats.newTherapists} subtitle="Últimos 30 dias" icon={UserPlus} onClick={() => router.push("/admin/therapists")} />
          <StatCard title="Novos Pacientes" value={userStats.newPatients} subtitle="Últimos 30 dias" icon={UserPlus} onClick={() => router.push("/admin/patients")} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CalendarAdmin appointments={appointments} />
          </div>
          
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-lg p-5 text-white">
              <Link href="/admin/reports/geral" className="block">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <BarChart2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70">Receita Total (mês atual)</p>
                      <p className="text-xl font-bold">{formatCurrency(reportData.geral.revenue)}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/70" />
                </div>
              </Link>
              <div className="pt-3 border-t border-white/20">
                <div className="flex justify-between text-xs text-white/70 mb-3">
                  <span>Receita diária - {new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                  <span>{reportData.geral.sessions} sessões este mês</span>
                </div>
                {chartData.every(d => d.revenue === 0) ? (
                  <div className="h-24 flex items-center justify-center text-white/50 text-xs">Nenhum dado disponível</div>
                ) : (
                  <ResponsiveContainer width="100%" height={110}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 10)} />
                      <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                      <Line type="monotone" dataKey="revenue" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <Link href="/admin/reports/geral" className="flex justify-between text-xs text-white/70 hover:text-white mt-3 pt-2 border-t border-white/20 transition-colors">
                  <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Ver relatório completo</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg p-5 text-white">
              <Link href="/admin/reports/assinaturas" className="block">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70">MRR (Assinaturas)</p>
                      <p className="text-xl font-bold">{formatCurrency(reportData.assinaturas.mrr)}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/70" />
                </div>
              </Link>
              <div className="pt-3 border-t border-white/20">
                <div className="flex justify-between text-xs text-white/70 mb-3">
                  <span>Receita recorrente mensal</span>
                  <span>{reportData.assinaturas.subscribers} assinantes ativos</span>
                </div>
                {!hasSubscriptionData ? (
                  <div className="h-24 flex items-center justify-center text-white/50 text-xs">Nenhuma assinatura ativa no mês</div>
                ) : (
                  <ResponsiveContainer width="100%" height={110}>
                    <LineChart data={subscriptionChartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} interval={Math.floor(subscriptionChartData.length / 10)} />
                      <YAxis tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} width={35} />
                      <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                      <Line type="monotone" dataKey="subscribers" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} dot={{ fill: "white", r: 2 }} />
                      <Line type="monotone" dataKey="mrr" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                <div className="flex justify-between text-xs text-white/70 mt-3 pt-2 border-t border-white/20">
                  <span>Planos: Profissional (R$79) | Premium (R$149)</span>
                  <Link href="/admin/reports/assinaturas" className="hover:text-white transition-colors">Ver detalhes →</Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <Link href="/admin/reports/geral" className="block">
            <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-lg p-4 text-white transition-all hover:shadow-md hover:scale-[1.02] h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <BarChart2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Relatório Geral</p>
                    <p className="text-lg font-bold">{formatCurrency(reportData.geral.revenue)}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/70" />
              </div>
              <p className="text-xs text-white/70 mb-2 -mt-1">{reportData.geral.sessions} sessões este mês</p>
              <div className="pt-2 border-t border-white/20">
                {chartData.every(d => d.revenue === 0) ? (
                  <div className="h-16 flex items-center justify-center text-white/50 text-xs">Nenhum dado disponível</div>
                ) : (
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                      <YAxis hide={true} />
                      <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                      <Line type="monotone" dataKey="revenue" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Link>

          <Link href="/admin/reports/terapeutas" className="block">
            <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-lg p-4 text-white transition-all hover:shadow-md hover:scale-[1.02] h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Relatório por Terapeuta</p>
                    <p className="text-lg font-bold">{formatCurrency(reportData.terapeutas.revenue)}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/70" />
              </div>
              <p className="text-xs text-white/70 mb-2 -mt-1">{reportData.terapeutas.sessions} sessões (líquido)</p>
              <div className="pt-2 border-t border-white/20">
                {chartData.every(d => d.liquidRevenue === 0) ? (
                  <div className="h-16 flex items-center justify-center text-white/50 text-xs">Nenhum dado disponível</div>
                ) : (
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                      <YAxis hide={true} />
                      <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                      <Line type="monotone" dataKey="liquidRevenue" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Link>

          <Link href="/admin/reports/plataforma" className="block">
            <div className="bg-gradient-to-r from-[#10B981] to-[#10B981]/80 rounded-xl shadow-lg p-4 text-white transition-all hover:shadow-md hover:scale-[1.02] h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Relatório da Plataforma</p>
                    <p className="text-lg font-bold">{formatCurrency(reportData.plataforma.revenue)}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/70" />
              </div>
              <p className="text-xs text-white/70 mb-2 -mt-1">{reportData.plataforma.sessions} sessões (comissão 20%)</p>
              <div className="pt-2 border-t border-white/20">
                {chartData.every(d => d.commission === 0) ? (
                  <div className="h-16 flex items-center justify-center text-white/50 text-xs">Nenhum dado disponível</div>
                ) : (
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                      <YAxis hide={true} />
                      <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                      <Line type="monotone" dataKey="commission" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Link>

          <Link href="/admin/reports/assinaturas" className="block">
            <div className="bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 rounded-xl shadow-lg p-4 text-white transition-all hover:shadow-md hover:scale-[1.02] h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Relatório de Assinaturas</p>
                    <p className="text-lg font-bold">{formatCurrency(reportData.assinaturas.mrr)}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/70" />
              </div>
              <p className="text-xs text-white/70 mb-2 -mt-1">{reportData.assinaturas.subscribers} assinantes ativos</p>
              <div className="pt-2 border-t border-white/20">
                {!hasSubscriptionData ? (
                  <div className="h-16 flex items-center justify-center text-white/50 text-xs">Nenhuma assinatura ativa</div>
                ) : (
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={subscriptionChartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.6)" }} axisLine={false} tickLine={false} interval={Math.floor(subscriptionChartData.length / 6)} />
                      <YAxis hide={true} />
                      <Tooltip content={<ChartTooltip formatter={formatCurrency} />} />
                      <Line type="monotone" dataKey="subscribers" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} dot={{ fill: "white", r: 1.5 }} />
                      <Line type="monotone" dataKey="mrr" stroke="white" strokeWidth={2} dot={{ fill: "white", r: 2 }} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </Link>
        </div>
      </div>

      {showSessionsModal && modalFilter === "upcoming" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#E03673]" />
                Próximas sessões
                <span className="text-sm font-normal text-gray-500 ml-1">({filteredForModal.length})</span>
              </h3>
              <button onClick={() => setShowSessionsModal(false)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredForModal.length === 0 ? (
                <div className="p-12 text-center text-gray-400">Nenhuma sessão encontrada</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data</th>
                      <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                      <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                      <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredForModal.slice(0, 100).map((apt: Appointment) => {
                      const patientFotoUrl = apt.patient?.foto_url ? (apt.patient.foto_url.startsWith("http") ? apt.patient.foto_url : `${BACKEND_URL}${apt.patient.foto_url}`) : null;
                      const therapistFotoUrl = apt.therapist?.foto_url ? (apt.therapist.foto_url.startsWith("http") ? apt.therapist.foto_url : getFotoSrc(apt.therapist.foto_url) ?? "") : null;
                      
                      return (
                        <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-sm text-gray-700">{formatDate(apt.starts_at)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar fotoUrl={patientFotoUrl} name={apt.patient?.full_name} size="sm" />
                              <span className="text-sm text-gray-800">{apt.patient?.full_name || `Paciente #${apt.patient_user_id}`}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <UserAvatar fotoUrl={therapistFotoUrl} name={apt.therapist?.full_name} size="sm" />
                              <span className="text-sm text-gray-800">{apt.therapist?.full_name || `Terapeuta #${apt.therapist_user_id}`}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(apt.status)}`}>{statusLabel(apt.status)}</span>
                          </td>
                          <td className="p-3 text-right text-sm text-gray-700">
                            {apt.session_price ? formatCurrency(apt.session_price) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">Mostrando até 100 registros</span>
              <button onClick={() => setShowSessionsModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}