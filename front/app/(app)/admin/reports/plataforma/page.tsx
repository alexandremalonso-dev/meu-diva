"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { getFotoSrc } from '@/lib/utils';
import { 
  Loader2,
  Eye,
  TrendingUp,
  Clock as ClockIcon,
  AlertCircle,
  Download,
  Search,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  XCircle,
  HelpCircle,
  Briefcase,
  Calendar
} from "lucide-react";
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 🔥 TIPOS
interface FinancialSession {
  id: number;
  appointment_id: number;
  date: string;
  time: string;
  patient_name: string;
  patient_email: string;
  patient_foto_url?: string;
  patient_user_id?: number;
  therapist_name: string;
  therapist_id: number;
  therapist_foto_url?: string;
  status: string;
  session_price: number;
  session_not_occurred: boolean;
  not_occurred_reason: string | null;
  has_medical_record: boolean;
  is_completed: boolean;
}

interface FinancialSummary {
  total_completed_sessions: number;
  total_revenue: number;
  total_pending_sessions: number;
  total_pending_value: number;
  total_cancelled_sessions: number;
  total_no_show_sessions: number;
  average_ticket: number;
  total_refunded: number;
}

interface ChartDataPoint {
  date: string;
  day: number;
  revenue: number;
  sessions: number;
  cancelled: number;
  cumulative: number;
}

// 🔥 OPÇÕES
const MONTHS = [
  { value: 0, label: "Janeiro" }, { value: 1, label: "Fevereiro" }, { value: 2, label: "Março" },
  { value: 3, label: "Abril" }, { value: 4, label: "Maio" }, { value: 5, label: "Junho" },
  { value: 6, label: "Julho" }, { value: 7, label: "Agosto" }, { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" }, { value: 10, label: "Novembro" }, { value: 11, label: "Dezembro" }
];

// 🔥 STATUS BASEADOS NOS DADOS REAIS DO BANCO
const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "completed", label: "Realizada" },
  { value: "confirmed", label: "Confirmada" },
  { value: "scheduled", label: "Agendada" },
  { value: "cancelled_by_patient", label: "Cancelada pelo paciente" },
  { value: "cancelled_by_therapist", label: "Cancelada pelo terapeuta" }
];

// 🔥 FUNÇÕES AUXILIARES
const getPolicyApplied = (status: string, reason: string | null, hasMedicalRecord: boolean): string => {
  if (status === "completed" || (hasMedicalRecord && !reason)) return "✅ Pagamento integral";
  if (status === "confirmed" && !hasMedicalRecord) return "⏳ Aguardando realização";
  if (status === "scheduled" && !hasMedicalRecord) return "⏳ Agendada aguardando";
  if (reason === "CLIENTE_NAO_COMPARECEU") return "⚠️ Pendente - Aguardando definição";
  if (reason === "PROBLEMAS_VIDEOCHAMADA" || reason === "CONFLITO_AGENDA") return "🔄 Reagendamento obrigatório";
  if (reason === "OUTROS") return "📋 Avaliação pendente";
  if (status === "cancelled_by_patient") return "🆓 Cancelado pelo paciente";
  if (status === "cancelled_by_therapist") return "💰 Cancelado pelo terapeuta";
  return "📋 Em análise";
};

const getReasonLabel = (reason: string | null, status: string): string => {
  if (reason === "CLIENTE_NAO_COMPARECEU") return "Cliente não compareceu";
  if (reason === "PROBLEMAS_VIDEOCHAMADA") return "Problemas na videochamada";
  if (reason === "CONFLITO_AGENDA") return "Conflito de agenda do terapeuta";
  if (reason === "OUTROS") return "Outros motivos";
  if (status === "cancelled_by_patient") return "Cancelamento pelo paciente";
  if (status === "cancelled_by_therapist") return "Cancelamento pelo terapeuta";
  return "-";
};

const getStatusLabel = (status: string): string => {
  const map: Record<string, string> = {
    completed: "Realizada",
    confirmed: "Confirmada",
    scheduled: "Agendada",
    cancelled_by_patient: "Cancelada pelo paciente",
    cancelled_by_therapist: "Cancelada pelo terapeuta"
  };
  return map[status] ?? status;
};

// 🔥 Função para saber se a sessão é futura (confirmada ou agendada)
const isPending = (status: string): boolean => {
  return status === "confirmed" || status === "scheduled";
};

// 🔥 Função para saber se a sessão gerou receita
const isRevenueGenerating = (status: string): boolean => {
  return status === "completed" || status === "confirmed" || status === "scheduled";
};

// 🔥 Função para obter URL correta da foto
const getFotoUrl = (fotoUrl?: string) => {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('http')) return fotoUrl;
  return getFotoSrc(fotoUrl) ?? "";
};

export default function AdminPlataformaReportPage() {
  const { user } = useAuth();
  const { openProntuario } = useSidebar();
  const { execute: apiCall } = useApi();
  
  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<FinancialSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<FinancialSession[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [therapists, setTherapists] = useState<{ id: number; name: string }[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    total_completed_sessions: 0, total_revenue: 0, total_pending_sessions: 0,
    total_pending_value: 0, total_cancelled_sessions: 0, total_no_show_sessions: 0,
    average_ticket: 0, total_refunded: 0
  });
  
  // 🔥 FILTROS
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("");
  const [searchTherapist, setSearchTherapist] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [chartMetric, setChartMetric] = useState<"revenue" | "sessions" | "cumulative">("revenue");
  
  // 🔥 PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // 🔥 TOGGLES
  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]);
    setCurrentPage(1);
  };
  
  const toggleYear = (year: number) => {
    setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
    setCurrentPage(1);
  };
  
  const selectAllMonths = () => { setSelectedMonths(MONTHS.map(m => m.value)); setCurrentPage(1); };
  const clearMonths = () => { setSelectedMonths([]); setCurrentPage(1); };
  const selectAllYears = () => { setSelectedYears([...availableYears]); setCurrentPage(1); };
  const clearYears = () => { setSelectedYears([]); setCurrentPage(1); };

  // 🔥 CARREGAR DADOS - ENDPOINT /plataforma
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 [ADMIN] Carregando relatório da plataforma...");

      const [data, patientsResult, therapistsResult] = await Promise.allSettled([
        apiCall({ url: "/api/admin/reports/plataforma", requireAuth: true }), // 🔥 ÚNICA MUDANÇA: ENDPOINT
        apiCall({ url: "/api/patients", requireAuth: true }).catch(() => []),
        apiCall({ url: "/api/therapists", requireAuth: true }).catch(() => [])
      ]);

      if (data.status !== "fulfilled" || !data.value) {
        console.error("❌ Falha ao carregar dashboard");
        setLoading(false);
        return;
      }

      const dashboardData = data.value;
      console.log(`📊 Sessões recebidas: ${dashboardData.sessions?.length}`);

      const fotoMap = new Map<number, string>();
      
      if (patientsResult.status === "fulfilled" && Array.isArray(patientsResult.value)) {
        patientsResult.value.forEach((p: any) => {
          if (p.user_id && p.foto_url) fotoMap.set(p.user_id, p.foto_url);
          if (p.id && p.foto_url && !fotoMap.has(p.id)) fotoMap.set(p.id, p.foto_url);
        });
      }
      
      if (therapistsResult.status === "fulfilled" && Array.isArray(therapistsResult.value)) {
        therapistsResult.value.forEach((t: any) => {
          if (t.user_id && t.foto_url) fotoMap.set(t.user_id, t.foto_url);
        });
      }

      const processedSessions: FinancialSession[] = (dashboardData.sessions ?? []).map((apt: any) => {
        const sessionDate = new Date(apt.starts_at);
        
        const patientId = apt.patient_user_id || apt.patient?.id;
        const patientFotoUrl = apt.patient_foto_url || fotoMap.get(patientId) || apt.patient?.foto_url;
        const therapistId = apt.therapist_id || apt.therapist_user_id || apt.therapist?.id;
        const therapistFotoUrl = apt.therapist_foto_url || fotoMap.get(therapistId);

        return {
          id: apt.id,
          appointment_id: apt.id,
          date: sessionDate.toISOString().split('T')[0],
          time: sessionDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          patient_name: apt.patient_name || apt.patient?.full_name || "Paciente",
          patient_email: apt.patient_email || apt.patient?.email || "",
          patient_foto_url: patientFotoUrl,
          patient_user_id: apt.patient_user_id,
          therapist_name: apt.therapist_name || apt.therapist?.full_name || "Terapeuta",
          therapist_id: apt.therapist_id || apt.therapist_user_id || 0,
          therapist_foto_url: therapistFotoUrl,
          status: apt.status,
          session_price: apt.session_price || 0, // 🔥 VALOR DA COMISSÃO (vem do backend)
          session_not_occurred: false,
          not_occurred_reason: null,
          has_medical_record: apt.status === "completed",
          is_completed: apt.status === "completed"
        };
      });

      const yearsSet = new Set<number>();
      processedSessions.forEach(s => yearsSet.add(new Date(s.date).getFullYear()));
      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
      setAvailableYears(sortedYears);

      if (sortedYears.length > 0 && selectedYears.length === 0) {
        setSelectedYears([sortedYears[0]]);
      }

      processedSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(processedSessions);
      setTherapists(dashboardData.therapists ?? []);

      // 🔥 Configurar dados do gráfico
      if (dashboardData.chart_data && dashboardData.chart_data.length > 0) {
        const chartPoints = dashboardData.chart_data.map((item: any) => ({
          date: item.date,
          day: item.day,
          revenue: item.comissao || item.revenue,
          sessions: item.sessoes || item.sessions,
          cancelled: 0,
          cumulative: item.cumulative
        }));
        setChartData(chartPoints);
      }

      // 🔥 Configurar resumo
      if (dashboardData.resumo) {
        setSummary({
          total_completed_sessions: dashboardData.resumo.total_sessoes || dashboardData.summary?.total_sessions || 0,
          total_revenue: dashboardData.resumo.total_comissao || dashboardData.summary?.total_revenue || 0,
          total_pending_sessions: 0,
          total_pending_value: 0,
          total_cancelled_sessions: 0,
          total_no_show_sessions: 0,
          average_ticket: dashboardData.resumo.comissao_media || dashboardData.summary?.average_ticket || 0,
          total_refunded: 0
        });
      } else if (dashboardData.summary) {
        setSummary(prev => ({
          ...prev,
          total_revenue: dashboardData.summary.total_revenue || 0,
          total_completed_sessions: dashboardData.summary.total_sessions || 0,
        }));
      }

      console.log("✅ Dados carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // 🔥 APLICAR FILTROS E GERAR GRÁFICO
  useEffect(() => {
    if (sessions.length === 0) return;
    
    let filtered = [...sessions];
    
    if (useCustomPeriod && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59);
      filtered = filtered.filter(s => {
        const date = new Date(s.date);
        return date >= start && date <= end;
      });
    } else if (selectedMonths.length > 0 && selectedYears.length > 0) {
      filtered = filtered.filter(s => {
        const date = new Date(s.date);
        return selectedMonths.includes(date.getMonth()) && selectedYears.includes(date.getFullYear());
      });
    }
    
    if (searchPatient) {
      const term = searchPatient.toLowerCase();
      filtered = filtered.filter(s => 
        s.patient_name.toLowerCase().includes(term) || 
        s.patient_email.toLowerCase().includes(term)
      );
    }
    
    if (selectedTherapistId) {
      filtered = filtered.filter(s => s.therapist_id === parseInt(selectedTherapistId));
    }
    
    if (searchTherapist) {
      const term = searchTherapist.toLowerCase();
      filtered = filtered.filter(s => s.therapist_name.toLowerCase().includes(term));
    }
    
    // 🔥 FILTRO POR STATUS
    if (statusFilter !== "todos") {
      filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    // 🔥 GERAR DADOS DO GRÁFICO (apenas sessões que geram receita)
    const sessionsByDate = new Map<string, { revenue: number; sessions: number; cancelled: number }>();
    
    filtered.forEach(s => {
      const date = s.date;
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, { revenue: 0, sessions: 0, cancelled: 0 });
      }
      const d = sessionsByDate.get(date)!;
      if (isRevenueGenerating(s.status)) {
        d.revenue += s.session_price;
        d.sessions += 1;
      }
      if (s.status === "cancelled_by_therapist") {
        d.cancelled += 1;
      }
    });
    
    const sortedDates = Array.from(sessionsByDate.keys()).sort();
    let cumulative = 0;
    const chartPoints: ChartDataPoint[] = sortedDates.map(date => {
      const d = sessionsByDate.get(date)!;
      cumulative += d.revenue;
      return {
        date,
        day: new Date(date).getDate(),
        revenue: d.revenue,
        sessions: d.sessions,
        cancelled: d.cancelled,
        cumulative
      };
    });
    
    setChartData(chartPoints);
    
    // 🔥 CALCULAR RESUMO
    const revenueSessions = filtered.filter(s => isRevenueGenerating(s.status));
    const completed = filtered.filter(s => s.status === "completed");
    const pending = filtered.filter(s => isPending(s.status));
    const cancelled = filtered.filter(s => s.status === "cancelled_by_patient" || s.status === "cancelled_by_therapist");
    
    const totalRevenue = revenueSessions.reduce((sum, s) => sum + s.session_price, 0);
    const totalPendingValue = pending.reduce((sum, s) => sum + s.session_price, 0);
    const totalRefunded = filtered.filter(s => s.status === "cancelled_by_therapist").reduce((sum, s) => sum + s.session_price, 0);
    const averageTicket = revenueSessions.length > 0 ? totalRevenue / revenueSessions.length : 0;
    
    setSummary({
      total_completed_sessions: completed.length,
      total_revenue: totalRevenue,
      total_pending_sessions: pending.length,
      total_pending_value: totalPendingValue,
      total_cancelled_sessions: cancelled.length,
      total_no_show_sessions: 0,
      average_ticket: averageTicket,
      total_refunded: totalRefunded
    });
    
    setFilteredSessions(filtered);
    setCurrentPage(1);
  }, [sessions, selectedMonths, selectedYears, customStartDate, customEndDate, useCustomPeriod, searchPatient, selectedTherapistId, searchTherapist, statusFilter]);
  
  // 🔥 PAGINAÇÃO
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };
  
  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "confirmed") return <CheckCircle className="w-4 h-4 text-blue-500" />;
    if (status === "scheduled") return <ClockIcon className="w-4 h-4 text-yellow-500" />;
    if (status === "cancelled_by_patient") return <XCircle className="w-4 h-4 text-orange-500" />;
    if (status === "cancelled_by_therapist") return <XCircle className="w-4 h-4 text-red-500" />;
    return <HelpCircle className="w-4 h-4 text-gray-500" />;
  };
  
  const handleViewSession = (sessionId: number) => {
    openProntuario(sessionId, true);
  };
  
  const exportToCSV = () => {
    const headers = [
      "ID Sessão", "Data", "Hora", "Paciente", "Terapeuta", "Status", 
      "Comissão (R$)", "Motivo", "Política Aplicada"
    ];
    
    const rows = filteredSessions.map(s => [
      s.appointment_id, s.date, s.time, s.patient_name, s.therapist_name,
      getStatusLabel(s.status),
      formatCurrency(s.session_price),
      getReasonLabel(s.not_occurred_reason, s.status),
      getPolicyApplied(s.status, s.not_occurred_reason, s.has_medical_record)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    
    let filename = "relatorio_plataforma";
    if (useCustomPeriod && customStartDate && customEndDate) {
      filename += `_${customStartDate}_a_${customEndDate}`;
    } else if (selectedMonths.length > 0 && selectedYears.length > 0) {
      const monthsStr = selectedMonths.map(m => MONTHS.find(mo => mo.value === m)?.label.substring(0, 3)).join('-');
      filename += `_${monthsStr}_${selectedYears.join('-')}`;
    }
    filename += ".csv";
    
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const resetFilters = () => {
    setSelectedMonths([new Date().getMonth()]);
    setSelectedYears([new Date().getFullYear()]);
    setCustomStartDate("");
    setCustomEndDate("");
    setUseCustomPeriod(false);
    setSearchPatient("");
    setSearchTherapist("");
    setSelectedTherapistId("");
    setStatusFilter("todos");
    setCurrentPage(1);
  };
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#10B981] animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h1>
            <p className="text-gray-600 mt-1">
              Acompanhe o faturamento e gestão financeira da plataforma
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
              Limpar filtros
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981] text-white rounded-lg hover:bg-[#0c8a5f] transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>
      
      {/* 📈 GRÁFICO DE LINHA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#10B981]" />
            <h3 className="font-semibold text-gray-900">Evolução Financeira</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChartMetric("revenue")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "revenue" ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Comissão (R$)
            </button>
            <button
              onClick={() => setChartMetric("sessions")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "sessions" ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Sessões
            </button>
            <button
              onClick={() => setChartMetric("cumulative")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "cumulative" ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Acumulado (R$)
            </button>
          </div>
        </div>
        
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            <p>Nenhum dado disponível para o período selecionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="day" 
                label={{ value: 'Dia do mês', position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => chartMetric === "sessions" ? value : `R$ ${value}`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "Comissão (R$)" || name === "Acumulado (R$)") return [formatCurrency(value), name];
                  return [value, name];
                }}
                labelFormatter={(label) => `Dia ${label}`}
              />
              <Legend />
              {chartMetric === "revenue" && (
                <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Comissão (R$)" />
              )}
              {chartMetric === "sessions" && (
                <>
                  <Line type="monotone" dataKey="sessions" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Sessões com comissão" />
                  <Line type="monotone" dataKey="cancelled" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 4 }} name="Cancelamentos" />
                </>
              )}
              {chartMetric === "cumulative" && (
                <Line type="monotone" dataKey="cumulative" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Acumulado (R$)" />
              )}
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 📊 CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Comissão Total</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_revenue)}</p>
          <p className="text-sm text-gray-500 mt-1">{summary.total_completed_sessions} sessões com comissão</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Comissão Média</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.average_ticket)}</p>
          <p className="text-sm text-gray-500 mt-1">por sessão</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sessões</span>
            <Calendar className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_completed_sessions}</p>
          <p className="text-sm text-gray-500 mt-1">que geraram comissão</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Cancelamentos</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_cancelled_sessions}</p>
          <p className="text-sm text-gray-500 mt-1">Estornado: {formatCurrency(summary.total_refunded)}</p>
        </div>
      </div>
      
      {/* 🔥 PAINEL DE FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#10B981]" />
            Filtros
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setUseCustomPeriod(false)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${!useCustomPeriod ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Por mês/ano
            </button>
            <button
              onClick={() => setUseCustomPeriod(true)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${useCustomPeriod ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Período personalizado
            </button>
          </div>
        </div>
        
        {useCustomPeriod ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              />
            </div>
          </div>
        ) : (
          <>
            {availableYears.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Anos disponíveis</label>
                  <div className="flex gap-2">
                    <button onClick={selectAllYears} className="text-xs text-[#10B981] hover:underline">Selecionar todos</button>
                    <button onClick={clearYears} className="text-xs text-gray-500 hover:underline">Limpar</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => toggleYear(year)}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        selectedYears.includes(year) ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Meses</label>
                <div className="flex gap-2">
                  <button onClick={selectAllMonths} className="text-xs text-[#10B981] hover:underline">Selecionar todos</button>
                  <button onClick={clearMonths} className="text-xs text-gray-500 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {MONTHS.map((month) => (
                  <button
                    key={month.value}
                    onClick={() => toggleMonth(month.value)}
                    className={`p-2 text-sm rounded-lg transition-colors ${
                      selectedMonths.includes(month.value) ? 'bg-[#10B981] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {month.label.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
            <select
              value={selectedTherapistId}
              onChange={(e) => setSelectedTherapistId(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
            >
              <option value="">Todos os terapeutas</option>
              {therapists.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Terapeuta</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTherapist}
                onChange={(e) => setSearchTherapist(e.target.value)}
                placeholder="Nome do terapeuta"
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                placeholder="Nome ou e-mail"
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>
          )}
          {!useCustomPeriod && selectedMonths.length > 0 && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>
          )}
          {useCustomPeriod && customStartDate && customEndDate && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>
          )}
          {statusFilter !== "todos" && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
            </span>
          )}
          {selectedTherapistId && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Terapeuta selecionado</span>
          )}
          {searchTherapist && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Terapeuta: {searchTherapist}</span>
          )}
          {searchPatient && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Paciente: {searchPatient}</span>
          )}
        </div>
      </div>
      
      {/* 📋 TABELA DE RELATÓRIO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Paciente</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Comissão</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Política Aplicada</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Nenhuma sessão encontrada no período selecionado
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => {
                  const patientFotoUrl = getFotoUrl(session.patient_foto_url);
                  const therapistFotoUrl = getFotoUrl(session.therapist_foto_url);
                  return (
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-sm text-gray-600">#{session.appointment_id}</td>
                      <td className="p-3">
                        <div className="text-sm font-medium text-gray-900">{session.date}</div>
                        <div className="text-xs text-gray-500">{session.time}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                            {patientFotoUrl ? (
                              <img 
                                src={patientFotoUrl} 
                                alt={session.patient_name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.parentElement) {
                                    e.currentTarget.parentElement.innerHTML = session.patient_name?.charAt(0).toUpperCase() || "P";
                                    e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-white text-xs font-bold">
                                {session.patient_name?.charAt(0).toUpperCase() || "P"}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{session.patient_name}</div>
                            <div className="text-xs text-gray-500">{session.patient_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#10B981] to-[#10B981]/80 flex items-center justify-center flex-shrink-0">
                            {therapistFotoUrl ? (
                              <img 
                                src={therapistFotoUrl} 
                                alt={session.therapist_name} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  if (e.currentTarget.parentElement) {
                                    e.currentTarget.parentElement.innerHTML = session.therapist_name?.charAt(0).toUpperCase() || "T";
                                    e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#10B981] to-[#10B981]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-white text-xs font-bold">
                                {session.therapist_name?.charAt(0).toUpperCase() || "T"}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-700">{session.therapist_name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(session.status)}
                          <span className="text-sm text-gray-700">{getStatusLabel(session.status)}</span>
                        </div>
                        {session.not_occurred_reason && (
                          <div className="text-xs text-gray-400 mt-1">
                            {getReasonLabel(session.not_occurred_reason, session.status)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-medium text-[#10B981]">
                          {formatCurrency(session.session_price)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs text-gray-500">
                          {getPolicyApplied(session.status, session.not_occurred_reason, session.has_medical_record)}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleViewSession(session.id)}
                          className="p-1.5 text-gray-400 hover:text-[#10B981] transition-colors"
                          title="Ver prontuário"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">
              Página {currentPage} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}