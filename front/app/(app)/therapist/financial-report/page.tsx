"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { 
  Calendar, 
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
  HelpCircle
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
  hour: number;
  patient_name: string;
  patient_email: string;
  patient_id: number;
  patient_foto_url?: string;
  status: string;
  session_price: number;
  net_amount: number;
  session_not_occurred: boolean;
  not_occurred_reason: string | null;
  has_medical_record: boolean;
  is_completed: boolean;
  payment_method?: string;
}

interface FinancialSummary {
  total_completed_sessions: number;
  total_to_receive: number;
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
  { value: 0, label: "Janeiro" },
  { value: 1, label: "Fevereiro" },
  { value: 2, label: "Março" },
  { value: 3, label: "Abril" },
  { value: 4, label: "Maio" },
  { value: 5, label: "Junho" },
  { value: 6, label: "Julho" },
  { value: 7, label: "Agosto" },
  { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" },
  { value: 10, label: "Novembro" },
  { value: 11, label: "Dezembro" }
];

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "completed", label: "Realizada" },
  { value: "confirmed", label: "Confirmada (pendente)" },
  { value: "cancelled_by_patient", label: "Cancelada pelo paciente" },
  { value: "cancelled_by_therapist", label: "Cancelada pelo terapeuta" },
  { value: "no_show", label: "Não compareceu" }
];

// 🔥 REGRAS DE NEGÓCIO
const getPolicyApplied = (status: string, reason: string | null, hasMedicalRecord: boolean): string => {
  if (status === "completed" || (hasMedicalRecord && !reason)) {
    return "✅ Pagamento integral";
  }
  if (status === "confirmed" && !hasMedicalRecord) {
    return "⏳ Aguardando realização";
  }
  if (reason === "CLIENTE_NAO_COMPARECEU") {
    return "⚠️ Pendente - Aguardando definição";
  }
  if (reason === "PROBLEMAS_VIDEOCHAMADA" || reason === "CONFLITO_AGENDA") {
    return "🔄 Reagendamento obrigatório";
  }
  if (reason === "OUTROS") {
    return "📋 Avaliação pendente";
  }
  if (status === "cancelled_by_patient") {
    return "🆓 Reagendamento sem custo (24h+)";
  }
  if (status === "cancelled_by_therapist") {
    return "💰 Estorno total";
  }
  return "📋 Em análise";
};

const getReasonLabel = (reason: string | null, status: string): string => {
  if (reason === "CLIENTE_NAO_COMPARECEU") return "Cliente não compareceu";
  if (reason === "PROBLEMAS_VIDEOCHAMADA") return "Problemas na videochamada";
  if (reason === "CONFLITO_AGENDA") return "Conflito de agenda do terapeuta";
  if (reason === "OUTROS") return "Outros motivos";
  if (status === "cancelled_by_patient") return "Cancelamento pelo paciente";
  if (status === "cancelled_by_therapist") return "Cancelamento pelo terapeuta (com estorno)";
  return "-";
};

const getStatusLabel = (status: string, hasMedicalRecord: boolean, sessionNotOccurred: boolean): string => {
  if (status === "completed" || (hasMedicalRecord && !sessionNotOccurred)) return "Realizada";
  if (status === "confirmed" && !hasMedicalRecord) return "Confirmada (aguardando)";
  if (status === "cancelled_by_patient") return "Cancelada pelo paciente";
  if (status === "cancelled_by_therapist") return "Cancelada pelo terapeuta (estorno)";
  if (sessionNotOccurred) return "Não ocorreu";
  return status;
};

export default function TherapistFinancialReportPage() {
  const { user } = useAuth();
  const { openProntuario } = useSidebar();
  const { execute: apiCall } = useApi();
  
  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<FinancialSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<FinancialSession[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>("essencial");
  const [summary, setSummary] = useState<FinancialSummary>({
    total_completed_sessions: 0,
    total_to_receive: 0,
    total_pending_sessions: 0,
    total_pending_value: 0,
    total_cancelled_sessions: 0,
    total_no_show_sessions: 0,
    average_ticket: 0,
    total_refunded: 0
  });
  
  // 🔥 FILTROS AVANÇADOS
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [chartMetric, setChartMetric] = useState<"revenue" | "sessions" | "cumulative">("revenue");
  
  // 🔥 PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // 🔥 TOGGLE PARA MÊS
  const toggleMonth = (month: number) => {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter(m => m !== month));
    } else {
      setSelectedMonths([...selectedMonths, month]);
    }
    setCurrentPage(1);
  };
  
  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      setSelectedYears(selectedYears.filter(y => y !== year));
    } else {
      setSelectedYears([...selectedYears, year]);
    }
    setCurrentPage(1);
  };
  
  const selectAllMonths = () => {
    setSelectedMonths(MONTHS.map(m => m.value));
    setCurrentPage(1);
  };
  
  const clearMonths = () => {
    setSelectedMonths([]);
    setCurrentPage(1);
  };
  
  const selectAllYears = () => {
    setSelectedYears([...availableYears]);
    setCurrentPage(1);
  };
  
  const clearYears = () => {
    setSelectedYears([]);
    setCurrentPage(1);
  };
  
  // 🔥 CARREGAR DADOS (com valores líquidos)
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 Carregando sessões e valores líquidos para relatório financeiro...");
      
      // Buscar appointments
      const appointmentsData = await apiCall({ 
        url: "/api/appointments/me/details", 
        requireAuth: true 
      });
      
      // Buscar comissões do terapeuta (para obter o valor líquido)
      let netAmountMap = new Map<number, number>();
      try {
        const commissionsData = await apiCall({
          url: "/api/therapists/commissions",
          requireAuth: true
        });
        if (Array.isArray(commissionsData)) {
          commissionsData.forEach((c: any) => {
            netAmountMap.set(c.appointment_id, c.net_amount);
          });
        }
      } catch (err) {
        console.log("⚠️ Nenhuma comissão encontrada ainda - usando valores brutos");
      }
      
      // Buscar assinatura atual
      try {
        const subData = await apiCall({
          url: "/api/therapists/subscription",
          requireAuth: true
        });
        setSubscriptionPlan(subData?.plan || "essencial");
      } catch (err) {
        setSubscriptionPlan("essencial");
      }
      
      const therapistAppointments = appointmentsData.filter(
        (apt: any) => apt.therapist_user_id === user?.id
      );
      
      // Extrair anos disponíveis das sessões
      const yearsSet = new Set<number>();
      const processedSessions: FinancialSession[] = [];
      
      for (const apt of therapistAppointments) {
        const sessionDate = new Date(apt.starts_at);
        yearsSet.add(sessionDate.getFullYear());
        
        let hasMedicalRecord = false;
        let sessionNotOccurred = false;
        let notOccurredReason = null;
        
        try {
          const record = await apiCall({
            url: `/api/appointments/${apt.id}/medical-record`,
            requireAuth: true
          });
          if (record && record.id) {
            hasMedicalRecord = true;
            sessionNotOccurred = record.session_not_occurred || false;
            notOccurredReason = record.not_occurred_reason;
          }
        } catch (err) {
          // Sem prontuário
        }
        
        const isCompleted = apt.status === "completed" || (hasMedicalRecord && !sessionNotOccurred);
        
        // 🔥 VALOR LÍQUIDO (se tiver comissão, usa net_amount, senão usa session_price)
        let netAmount = apt.session_price || 0;
        if (netAmountMap.has(apt.id)) {
          netAmount = netAmountMap.get(apt.id)!;
        }
        
        processedSessions.push({
          id: apt.id,
          appointment_id: apt.id,
          date: sessionDate.toISOString().split('T')[0],
          time: sessionDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          hour: sessionDate.getHours(),
          patient_name: apt.patient?.full_name || "Paciente",
          patient_email: apt.patient?.email || "",
          patient_id: apt.patient_user_id,
          patient_foto_url: apt.patient?.foto_url,
          status: apt.status,
          session_price: apt.session_price || 0,
          net_amount: netAmount,
          session_not_occurred: sessionNotOccurred,
          not_occurred_reason: notOccurredReason,
          has_medical_record: hasMedicalRecord,
          is_completed: isCompleted,
          payment_method: apt.payment_method || "Cartão"
        });
      }
      
      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
      setAvailableYears(sortedYears);
      
      if (sortedYears.length > 0 && selectedYears.length === 0) {
        setSelectedYears([sortedYears[0]]);
      }
      
      processedSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSessions(processedSessions);
      
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
    let filtered = [...sessions];
    
    // Filtro por período
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
    
    // Filtro por paciente
    if (searchPatient) {
      const term = searchPatient.toLowerCase();
      filtered = filtered.filter(s => 
        s.patient_name.toLowerCase().includes(term) || 
        s.patient_email.toLowerCase().includes(term)
      );
    }
    
    // Filtro por status
    if (statusFilter !== "todos") {
      if (statusFilter === "completed") {
        filtered = filtered.filter(s => s.is_completed);
      } else if (statusFilter === "no_show") {
        filtered = filtered.filter(s => s.session_not_occurred && s.not_occurred_reason === "CLIENTE_NAO_COMPARECEU");
      } else {
        filtered = filtered.filter(s => s.status === statusFilter);
      }
    }
    
    // 🔥 GERAR DADOS DO GRÁFICO (com valores líquidos)
    const sessionsByDate = new Map<string, { revenue: number; sessions: number; cancelled: number }>();
    
    filtered.forEach(s => {
      const date = s.date;
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, { revenue: 0, sessions: 0, cancelled: 0 });
      }
      const data = sessionsByDate.get(date)!;
      
      if (s.is_completed) {
        data.revenue += s.net_amount;
        data.sessions += 1;
      }
      if (s.status === "cancelled_by_therapist") {
        data.cancelled += 1;
      }
    });
    
    // Ordenar por data
    const sortedDates = Array.from(sessionsByDate.keys()).sort();
    let cumulative = 0;
    const chartPoints: ChartDataPoint[] = sortedDates.map(date => {
      const data = sessionsByDate.get(date)!;
      cumulative += data.revenue;
      return {
        date,
        day: new Date(date).getDate(),
        revenue: data.revenue,
        sessions: data.sessions,
        cancelled: data.cancelled,
        cumulative
      };
    });
    
    setChartData(chartPoints);
    
    // 🔥 Calcular resumo (com valores líquidos)
    const completed = filtered.filter(s => s.is_completed);
    const pending = filtered.filter(s => s.status === "confirmed" && !s.has_medical_record);
    const cancelled = filtered.filter(s => s.status === "cancelled_by_patient" || s.status === "cancelled_by_therapist");
    const noShow = filtered.filter(s => s.session_not_occurred && s.not_occurred_reason === "CLIENTE_NAO_COMPARECEU");
    const therapistCancelled = filtered.filter(s => s.status === "cancelled_by_therapist");
    
    const totalToReceive = completed.reduce((sum, s) => sum + s.net_amount, 0);
    const totalPendingValue = pending.reduce((sum, s) => sum + s.session_price, 0);
    const totalRefunded = therapistCancelled.reduce((sum, s) => sum + s.session_price, 0);
    const averageTicket = completed.length > 0 ? totalToReceive / completed.length : 0;
    
    setSummary({
      total_completed_sessions: completed.length,
      total_to_receive: totalToReceive,
      total_pending_sessions: pending.length,
      total_pending_value: totalPendingValue,
      total_cancelled_sessions: cancelled.length,
      total_no_show_sessions: noShow.length,
      average_ticket: averageTicket,
      total_refunded: totalRefunded
    });
    
    setFilteredSessions(filtered);
    setCurrentPage(1);
  }, [sessions, selectedMonths, selectedYears, customStartDate, customEndDate, useCustomPeriod, searchPatient, statusFilter]);
  
  // 🔥 PAGINAÇÃO
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSessions = filteredSessions.slice(startIndex, endIndex);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };
  
  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };
  
  const getStatusIcon = (status: string, isCompleted: boolean) => {
    if (isCompleted) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "cancelled_by_patient") 
      return <XCircle className="w-4 h-4 text-orange-500" />;
    if (status === "cancelled_by_therapist") 
      return <XCircle className="w-4 h-4 text-red-500" />;
    return <HelpCircle className="w-4 h-4 text-yellow-500" />;
  };
  
  const handleViewSession = (sessionId: number) => {
    openProntuario(sessionId, true);
  };
  
  const exportToCSV = () => {
    const headers = [
      "ID Sessão", "Data", "Hora", "Paciente", "Email", "Status", 
      "Valor Líquido (R$)", "Motivo", "Política Aplicada"
    ];
    
    const rows = filteredSessions.map(s => [
      s.appointment_id,
      s.date,
      s.time,
      s.patient_name,
      s.patient_email,
      getStatusLabel(s.status, s.has_medical_record, s.session_not_occurred),
      formatCurrency(s.net_amount),
      getReasonLabel(s.not_occurred_reason, s.status),
      getPolicyApplied(s.status, s.not_occurred_reason, s.has_medical_record)
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    
    let filename = "relatorio_financeiro";
    if (useCustomPeriod && customStartDate && customEndDate) {
      filename += `_${customStartDate}_a_${customEndDate}`;
    } else if (selectedMonths.length > 0 && selectedYears.length > 0) {
      const monthsStr = selectedMonths.map(m => MONTHS.find(mo => mo.value === m)?.label.substring(0, 3)).join('-');
      const yearsStr = selectedYears.join('-');
      filename += `_${monthsStr}_${yearsStr}`;
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
    setStatusFilter("todos");
    setCurrentPage(1);
  };
  
  // 🔥 OBTER LABEL DO PLANO
  const getPlanLabel = () => {
    if (subscriptionPlan === "profissional") return "Profissional";
    if (subscriptionPlan === "premium") return "Premium";
    return "Essencial";
  };
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
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
              Acompanhe seus recebimentos
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Plano: {getPlanLabel()}
              </span>
            </div>
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
              className="flex items-center gap-2 px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] transition-colors"
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
            <TrendingUp className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Evolução de Recebimentos</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setChartMetric("revenue")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "revenue" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Recebimentos
            </button>
            <button
              onClick={() => setChartMetric("sessions")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "sessions" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Sessões
            </button>
            <button
              onClick={() => setChartMetric("cumulative")}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "cumulative" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Acumulado
            </button>
          </div>
        </div>
        
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            <p>Nenhum dado disponível para o período selecionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={typeof window !== 'undefined' && window.innerWidth < 768 ? 220 : 350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="day" 
                label={{ value: 'Dia do mês', position: 'insideBottom', offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tickFormatter={(value) => chartMetric === "revenue" || chartMetric === "cumulative" ? `R$ ${value}` : value}
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (chartMetric === "revenue" || chartMetric === "cumulative") {
                    return [formatCurrency(value), name === "revenue" ? "Recebimentos do dia" : name === "cumulative" ? "Acumulado" : "Quantidade"];
                  }
                  return [value, name === "sessions" ? "Sessões realizadas" : "Cancelamentos"];
                }}
                labelFormatter={(label) => `Dia ${label}`}
              />
              <Legend />
              {chartMetric === "revenue" && (
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#E03673" 
                  strokeWidth={2}
                  dot={{ fill: '#E03673', r: 4 }}
                  name="Recebimentos do dia"
                />
              )}
              {chartMetric === "sessions" && (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="sessions" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={{ fill: '#10B981', r: 4 }}
                    name="Sessões realizadas"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cancelled" 
                    stroke="#EF4444" 
                    strokeWidth={2}
                    dot={{ fill: '#EF4444', r: 4 }}
                    name="Cancelamentos"
                  />
                </>
              )}
              {chartMetric === "cumulative" && (
                <Line 
                  type="monotone" 
                  dataKey="cumulative" 
                  stroke="#2F80D3" 
                  strokeWidth={2}
                  dot={{ fill: '#2F80D3', r: 4 }}
                  name="Acumulado"
                />
              )}
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 📊 CARDS DE RESUMO */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Recebido</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.total_to_receive)}</p>
          <p className="text-xs text-gray-400 mt-1">Valor líquido a receber</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sessões Realizadas</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_completed_sessions}</p>
          <p className="text-sm text-gray-500 mt-1">
            Ticket médio: {formatCurrency(summary.average_ticket)}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sessões Pendentes</span>
            <ClockIcon className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_pending_sessions}</p>
          <p className="text-sm text-gray-500 mt-1">
            {formatCurrency(summary.total_pending_value)} em confirmação
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Cancelamentos</span>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_cancelled_sessions}</p>
          <p className="text-sm text-gray-500 mt-1">
            Estornado: {formatCurrency(summary.total_refunded)}
          </p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Faltas</span>
            <AlertCircle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_no_show_sessions}</p>
          <p className="text-sm text-gray-500 mt-1">
            Pendentes de definição
          </p>
        </div>
      </div>
      
      {/* 🔥 PAINEL DE FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#E03673]" />
            Filtros
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setUseCustomPeriod(false)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${!useCustomPeriod ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Por mês/ano
            </button>
            <button
              onClick={() => setUseCustomPeriod(true)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${useCustomPeriod ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}
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
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
          </div>
        ) : (
          <>
            {/* ANOS */}
            {availableYears.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Anos disponíveis</label>
                  <div className="flex gap-2">
                    <button onClick={selectAllYears} className="text-xs text-[#E03673] hover:underline">
                      Selecionar todos
                    </button>
                    <button onClick={clearYears} className="text-xs text-gray-500 hover:underline">
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => toggleYear(year)}
                      className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                        selectedYears.includes(year)
                          ? 'bg-[#E03673] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* MESES */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Meses</label>
                <div className="flex gap-2">
                  <button onClick={selectAllMonths} className="text-xs text-[#E03673] hover:underline">
                    Selecionar todos
                  </button>
                  <button onClick={clearMonths} className="text-xs text-gray-500 hover:underline">
                    Limpar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {MONTHS.map((month) => (
                  <button
                    key={month.value}
                    onClick={() => toggleMonth(month.value)}
                    className={`p-2 text-sm rounded-lg transition-colors ${
                      selectedMonths.includes(month.value)
                        ? 'bg-[#E03673] text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {month.label.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        {/* Filtros adicionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
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
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
          </div>
        </div>
        
        {/* Indicador de filtros ativos */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              {selectedYears.length} ano(s)
            </span>
          )}
          {!useCustomPeriod && selectedMonths.length > 0 && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              {selectedMonths.length} mês(es)
            </span>
          )}
          {useCustomPeriod && customStartDate && customEndDate && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              {customStartDate} a {customEndDate}
            </span>
          )}
          {statusFilter !== "todos" && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}
            </span>
          )}
          {searchPatient && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              Paciente: {searchPatient}
            </span>
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
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor Líquido</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Política Aplicada</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Nenhuma sessão encontrada no período selecionado
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-sm text-gray-600">#{session.appointment_id}</td>
                    <td className="p-3">
                      <div className="text-sm font-medium text-gray-900">{session.date}</div>
                      <div className="text-xs text-gray-500">{session.time}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                          {session.patient_foto_url ? (
                            <img 
                              src={getFotoUrl(session.patient_foto_url)} 
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{session.patient_name}</div>
                          <div className="text-xs text-gray-500">{session.patient_email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(session.status, session.is_completed)}
                        <span className="text-sm text-gray-700">
                          {getStatusLabel(session.status, session.has_medical_record, session.session_not_occurred)}
                        </span>
                      </div>
                      {session.not_occurred_reason && (
                        <div className="text-xs text-gray-400 mt-1">
                          {getReasonLabel(session.not_occurred_reason, session.status)}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <span className={`text-sm font-semibold ${
                        session.status === "cancelled_by_therapist" ? 'text-red-600' : 
                        session.is_completed ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {session.status === "cancelled_by_therapist" 
                          ? `-${formatCurrency(session.net_amount)}`
                          : formatCurrency(session.net_amount)}
                      </span>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-xs text-gray-500">
                        {getPolicyApplied(session.status, session.not_occurred_reason, session.has_medical_record)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleViewSession(session.id)}
                        className="p-1.5 text-gray-400 hover:text-[#E03673] transition-colors"
                        title="Ver prontuário"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
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