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
  Calendar,
  Timer,
  Zap,
  AlertTriangle,
  Check
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
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 🔥 TIPOS
interface SessionDuration {
  id: number;
  appointment_id: number;
  date: string;
  time: string;
  patient_name: string;
  patient_email: string;
  patient_foto_url?: string;
  therapist_name: string;
  therapist_id: number;
  therapist_foto_url?: string;
  status: string;
  session_price: number;
  therapist_joined_at?: string;
  therapist_left_at?: string;
  therapist_duration_seconds: number;
  patient_joined_at?: string;
  patient_left_at?: string;
  patient_duration_seconds: number;
  effective_duration_seconds: number;
  effective_duration_minutes: number;
}

interface DurationSummary {
  total_sessions: number;
  avg_effective_duration_minutes: number;
  avg_therapist_duration_minutes: number;
  avg_patient_duration_minutes: number;
  total_effective_hours: number;
  sessions_under_15min: number;
  sessions_zero_duration: number;
  sessions_over_60min: number;
  completion_rate: number;
}

interface ChartDataPoint {
  date: string;
  day: number;
  avg_duration: number;
  sessions_count: number;
  zero_sessions: number;
}

// 🔥 OPÇÕES
const MONTHS = [
  { value: 0, label: "Janeiro" }, { value: 1, label: "Fevereiro" }, { value: 2, label: "Março" },
  { value: 3, label: "Abril" }, { value: 4, label: "Maio" }, { value: 5, label: "Junho" },
  { value: 6, label: "Julho" }, { value: 7, label: "Agosto" }, { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" }, { value: 10, label: "Novembro" }, { value: 11, label: "Dezembro" }
];

const getFotoUrl = (fotoUrl?: string) => {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('http')) return fotoUrl;
  return getFotoSrc(fotoUrl) ?? "";
};

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0 min";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds > 0) {
    return `${minutes}min ${remainingSeconds}s`;
  }
  return `${minutes} min`;
};

const formatDurationMinutes = (seconds: number): string => {
  if (!seconds || seconds <= 0) return "0 min";
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min`;
};

const getDurationColor = (minutes: number): string => {
  if (minutes === 0) return "text-red-500";
  if (minutes < 15) return "text-orange-500";
  if (minutes < 30) return "text-yellow-500";
  if (minutes < 50) return "text-blue-500";
  return "text-green-500";
};

const getDurationBadge = (minutes: number) => {
  if (minutes === 0) return { bg: "bg-red-100", text: "text-red-700", label: "⚠️ Sessão zerada" };
  if (minutes < 15) return { bg: "bg-orange-100", text: "text-orange-700", label: "⚠️ Muito curta (<15min)" };
  if (minutes < 30) return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Curta" };
  if (minutes < 50) return { bg: "bg-blue-100", text: "text-blue-700", label: "Ideal" };
  return { bg: "bg-green-100", text: "text-green-700", label: "✓ Duração adequada" };
};

// 🔥 DADOS MOCKADOS PARA TESTE
const generateMockData = (): SessionDuration[] => {
  const mockSessions: SessionDuration[] = [];
  const therapists = [
    { id: 1, name: "Dra. Ana Silva", foto_url: null },
    { id: 2, name: "Dr. Carlos Oliveira", foto_url: null },
    { id: 3, name: "Dra. Mariana Santos", foto_url: null }
  ];
  const patients = [
    { name: "João Pereira", email: "joao@email.com", foto_url: null },
    { name: "Maria Souza", email: "maria@email.com", foto_url: null },
    { name: "Pedro Costa", email: "pedro@email.com", foto_url: null },
    { name: "Ana Clara", email: "ana@email.com", foto_url: null },
    { name: "Lucas Lima", email: "lucas@email.com", foto_url: null }
  ];
  const statuses = ["completed", "confirmed", "scheduled", "cancelled_by_patient"];
  
  const startDate = new Date(2026, 3, 1);
  const endDate = new Date(2026, 3, 30);
  
  for (let i = 1; i <= 45; i++) {
    const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    const therapist = therapists[Math.floor(Math.random() * therapists.length)];
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    let effectiveDuration = 0;
    let therapistDuration = 0;
    let patientDuration = 0;
    
    if (status === "completed") {
      effectiveDuration = Math.floor(Math.random() * 20) + 40;
      therapistDuration = effectiveDuration + Math.floor(Math.random() * 10);
      patientDuration = effectiveDuration + Math.floor(Math.random() * 10);
    } else if (status === "confirmed" || status === "scheduled") {
      const hasDuration = Math.random() > 0.3;
      if (hasDuration) {
        effectiveDuration = Math.floor(Math.random() * 30) + 15;
        therapistDuration = effectiveDuration + Math.floor(Math.random() * 5);
        patientDuration = effectiveDuration + Math.floor(Math.random() * 5);
      }
    }
    
    if (Math.random() < 0.1) {
      effectiveDuration = 0;
      therapistDuration = 0;
      patientDuration = 0;
    }
    
    if (Math.random() < 0.15 && effectiveDuration > 0 && effectiveDuration < 30) {
      effectiveDuration = Math.floor(Math.random() * 10) + 2;
    }
    
    mockSessions.push({
      id: i,
      appointment_id: 1000 + i,
      date: randomDate.toISOString().split('T')[0],
      time: `${String(randomDate.getHours()).padStart(2, '0')}:${String(randomDate.getMinutes()).padStart(2, '0')}`,
      patient_name: patient.name,
      patient_email: patient.email,
      patient_foto_url: patient.foto_url,
      therapist_name: therapist.name,
      therapist_id: therapist.id,
      therapist_foto_url: therapist.foto_url,
      status: status,
      session_price: 70.00,
      therapist_joined_at: therapistDuration > 0 ? `2026-04-${String(randomDate.getDate()).padStart(2, '0')}T${String(randomDate.getHours()).padStart(2, '0')}:${String(randomDate.getMinutes()).padStart(2, '0')}:00` : undefined,
      therapist_left_at: therapistDuration > 0 ? `2026-04-${String(randomDate.getDate()).padStart(2, '0')}T${String(randomDate.getHours() + 1).padStart(2, '0')}:${String(randomDate.getMinutes()).padStart(2, '0')}:00` : undefined,
      therapist_duration_seconds: therapistDuration * 60,
      patient_joined_at: patientDuration > 0 ? `2026-04-${String(randomDate.getDate()).padStart(2, '0')}T${String(randomDate.getHours()).padStart(2, '0')}:${String(randomDate.getMinutes() + 2).padStart(2, '0')}:00` : undefined,
      patient_left_at: patientDuration > 0 ? `2026-04-${String(randomDate.getDate()).padStart(2, '0')}T${String(randomDate.getHours() + 1).padStart(2, '0')}:${String(randomDate.getMinutes() - 2).padStart(2, '0')}:00` : undefined,
      patient_duration_seconds: patientDuration * 60,
      effective_duration_seconds: effectiveDuration * 60,
      effective_duration_minutes: effectiveDuration
    });
  }
  
  mockSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return mockSessions;
};

export default function AdminDuracaoSessoesReportPage() {
  const { user } = useAuth();
  const { openProntuario } = useSidebar();
  const { execute: apiCall } = useApi();
  
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionDuration[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SessionDuration[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [therapists, setTherapists] = useState<{ id: number; name: string }[]>([]);
  const [summary, setSummary] = useState<DurationSummary>({
    total_sessions: 0, avg_effective_duration_minutes: 0, avg_therapist_duration_minutes: 0,
    avg_patient_duration_minutes: 0, total_effective_hours: 0, sessions_under_15min: 0,
    sessions_zero_duration: 0, sessions_over_60min: 0, completion_rate: 0
  });
  
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  const [searchPatient, setSearchPatient] = useState("");
  const [searchTherapist, setSearchTherapist] = useState("");
  const [selectedTherapistId, setSelectedTherapistId] = useState<string>("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
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

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 [ADMIN] Carregando relatório de duração de sessões (MOCK)...");
      
      const mockSessions = generateMockData();
      console.log(`📊 Sessões mockadas geradas: ${mockSessions.length}`);
      
      const processedSessions: SessionDuration[] = mockSessions.map((s: any) => ({
        ...s,
        effective_duration_minutes: Math.round(s.effective_duration_seconds / 60)
      }));

      const yearsSet = new Set<number>();
      processedSessions.forEach(s => yearsSet.add(new Date(s.date).getFullYear()));
      const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
      setAvailableYears(sortedYears);

      if (sortedYears.length > 0 && selectedYears.length === 0) {
        setSelectedYears([sortedYears[0]]);
      }

      setSessions(processedSessions);
      
      const uniqueTherapists = Array.from(
        new Map(processedSessions.map(s => [s.therapist_id, { id: s.therapist_id, name: s.therapist_name }])).values()
      );
      setTherapists(uniqueTherapists);

      console.log("✅ Dados mockados carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
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
    
    const sessionsByDate = new Map<string, { total_duration: number; count: number; zero_count: number }>();
    
    filtered.forEach(s => {
      const date = s.date;
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, { total_duration: 0, count: 0, zero_count: 0 });
      }
      const d = sessionsByDate.get(date)!;
      d.total_duration += s.effective_duration_seconds;
      d.count += 1;
      if (s.effective_duration_seconds === 0) d.zero_count += 1;
    });
    
    const sortedDates = Array.from(sessionsByDate.keys()).sort();
    const chartPoints: ChartDataPoint[] = sortedDates.map(date => {
      const d = sessionsByDate.get(date)!;
      const avg_duration = d.count > 0 ? d.total_duration / d.count / 60 : 0;
      return {
        date,
        day: new Date(date).getDate(),
        avg_duration: Math.round(avg_duration * 10) / 10,
        sessions_count: d.count,
        zero_sessions: d.zero_count
      };
    });
    
    setChartData(chartPoints);
    
    const totalSessions = filtered.length;
    const totalEffectiveSeconds = filtered.reduce((sum, s) => sum + s.effective_duration_seconds, 0);
    const totalTherapistSeconds = filtered.reduce((sum, s) => sum + s.therapist_duration_seconds, 0);
    const totalPatientSeconds = filtered.reduce((sum, s) => sum + s.patient_duration_seconds, 0);
    
    const avgEffective = totalSessions > 0 ? totalEffectiveSeconds / totalSessions / 60 : 0;
    const avgTherapist = totalSessions > 0 ? totalTherapistSeconds / totalSessions / 60 : 0;
    const avgPatient = totalSessions > 0 ? totalPatientSeconds / totalSessions / 60 : 0;
    
    const sessionsUnder15min = filtered.filter(s => s.effective_duration_seconds > 0 && s.effective_duration_seconds < 15 * 60).length;
    const sessionsZero = filtered.filter(s => s.effective_duration_seconds === 0).length;
    const sessionsOver60min = filtered.filter(s => s.effective_duration_seconds > 60 * 60).length;
    
    const completionRate = totalSessions > 0 ? ((totalSessions - sessionsZero) / totalSessions) * 100 : 0;
    
    setSummary({
      total_sessions: totalSessions,
      avg_effective_duration_minutes: Math.round(avgEffective * 10) / 10,
      avg_therapist_duration_minutes: Math.round(avgTherapist * 10) / 10,
      avg_patient_duration_minutes: Math.round(avgPatient * 10) / 10,
      total_effective_hours: Math.round(totalEffectiveSeconds / 3600),
      sessions_under_15min: sessionsUnder15min,
      sessions_zero_duration: sessionsZero,
      sessions_over_60min: sessionsOver60min,
      completion_rate: Math.round(completionRate)
    });
    
    setFilteredSessions(filtered);
    setCurrentPage(1);
  }, [sessions, selectedMonths, selectedYears, customStartDate, customEndDate, useCustomPeriod, searchPatient, selectedTherapistId, searchTherapist]);
  
  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSessions = filteredSessions.slice(startIndex, startIndex + itemsPerPage);
  
  const getStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "confirmed") return <CheckCircle className="w-4 h-4 text-blue-500" />;
    if (status === "scheduled") return <ClockIcon className="w-4 h-4 text-yellow-500" />;
    if (status === "cancelled_by_patient") return <XCircle className="w-4 h-4 text-orange-500" />;
    if (status === "cancelled_by_therapist") return <XCircle className="w-4 h-4 text-red-500" />;
    return <HelpCircle className="w-4 h-4 text-gray-500" />;
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
  
  const handleViewSession = (sessionId: number) => {
    openProntuario(sessionId, true);
  };
  
  const exportToCSV = () => {
    const headers = [
      "ID Sessão", "Data", "Hora", "Paciente", "Terapeuta", "Status",
      "Duração Terapeuta", "Duração Paciente", "Duração Efetiva (min)", "Alerta"
    ];
    
    const rows = filteredSessions.map(s => [
      s.appointment_id, s.date, s.time, s.patient_name, s.therapist_name,
      getStatusLabel(s.status),
      formatDuration(s.therapist_duration_seconds),
      formatDuration(s.patient_duration_seconds),
      s.effective_duration_minutes,
      s.effective_duration_minutes === 0 ? "Sessão zerada" : (s.effective_duration_minutes < 15 ? "Menos de 15min" : "OK")
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    
    let filename = "relatorio_duracao_sessoes";
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
    setCurrentPage(1);
  };
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#2F80D3] animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Duração das Sessões</h1>
            <p className="text-gray-600 mt-1">
              Análise da duração efetiva das sessões (tempo que terapeuta e paciente ficaram online)
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
              className="flex items-center gap-2 px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] transition-colors"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>
      </div>
      
      {/* 📈 GRÁFICO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#2F80D3]" />
          <h3 className="font-semibold text-gray-900">Evolução da Duração Média das Sessões</h3>
        </div>
        
        {chartData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            <p>Nenhum dado disponível para o período selecionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" label={{ value: 'Dia do mês', position: 'insideBottom', offset: -5 }} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `${value} min`} tick={{ fontSize: 12 }} domain={[0, 'auto']} />
              <Tooltip formatter={(value: number) => [`${value} minutos`, "Duração média"]} labelFormatter={(label) => `Dia ${label}`} />
              <Legend />
              <Line type="monotone" dataKey="avg_duration" stroke="#2F80D3" strokeWidth={2} dot={{ fill: '#2F80D3', r: 4 }} name="Duração média (min)" />
              <ReferenceLine y={50} stroke="#10B981" strokeDasharray="5 5" label={{ value: 'Ideal (50min)', position: 'right', fill: '#10B981', fontSize: 12 }} />
              <ReferenceLine y={15} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: 'Mínimo (15min)', position: 'right', fill: '#F59E0B', fontSize: 12 }} />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 📊 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Duração Efetiva Média</span>
            <Timer className="w-5 h-5 text-[#2F80D3]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.avg_effective_duration_minutes} min</p>
          <p className="text-sm text-gray-500 mt-1">tempo de sobreposição</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Taxa de Conclusão</span>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.completion_rate}%</p>
          <p className="text-sm text-gray-500 mt-1">sessões com duração &gt; 0</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sessões &lt; 15min</span>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.sessions_under_15min}</p>
          <p className="text-sm text-gray-500 mt-1">atenção: duração reduzida</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sessões Zeradas</span>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.sessions_zero_duration}</p>
          <p className="text-sm text-gray-500 mt-1">terapeuta/paciente não conectou</p>
        </div>
      </div>
      
      {/* SEGUNDA LINHA DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Terapeuta (médio)</p>
          <p className="text-xl font-bold text-gray-900">{formatDurationMinutes(summary.avg_therapist_duration_minutes * 60)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Paciente (médio)</p>
          <p className="text-xl font-bold text-gray-900">{formatDurationMinutes(summary.avg_patient_duration_minutes * 60)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Total horas efetivas</p>
          <p className="text-xl font-bold text-gray-900">{summary.total_effective_hours} h</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500">Sessões &gt; 60min</p>
          <p className="text-xl font-bold text-gray-900">{summary.sessions_over_60min}</p>
        </div>
      </div>
      
      {/* PAINEL DE FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#2F80D3]" />
            Filtros
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setUseCustomPeriod(false)} className={`px-3 py-1 text-sm rounded-lg transition-colors ${!useCustomPeriod ? 'bg-[#2F80D3] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Por mês/ano
            </button>
            <button onClick={() => setUseCustomPeriod(true)} className={`px-3 py-1 text-sm rounded-lg transition-colors ${useCustomPeriod ? 'bg-[#2F80D3] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Período personalizado
            </button>
          </div>
        </div>
        
        {useCustomPeriod ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2F80D3] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2F80D3] outline-none" />
            </div>
          </div>
        ) : (
          <>
            {availableYears.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Anos disponíveis</label>
                  <div className="flex gap-2">
                    <button onClick={selectAllYears} className="text-xs text-[#2F80D3] hover:underline">Selecionar todos</button>
                    <button onClick={clearYears} className="text-xs text-gray-500 hover:underline">Limpar</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button key={year} onClick={() => toggleYear(year)} className={`px-4 py-2 text-sm rounded-lg transition-colors ${selectedYears.includes(year) ? 'bg-[#2F80D3] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
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
                  <button onClick={selectAllMonths} className="text-xs text-[#2F80D3] hover:underline">Selecionar todos</button>
                  <button onClick={clearMonths} className="text-xs text-gray-500 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {MONTHS.map((month) => (
                  <button key={month.value} onClick={() => toggleMonth(month.value)} className={`p-2 text-sm rounded-lg transition-colors ${selectedMonths.includes(month.value) ? 'bg-[#2F80D3] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {month.label.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
            <select value={selectedTherapistId} onChange={(e) => setSelectedTherapistId(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2F80D3] outline-none">
              <option value="">Todos os terapeutas</option>
              {therapists.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Terapeuta</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTherapist} onChange={(e) => setSearchTherapist(e.target.value)} placeholder="Nome do terapeuta" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2F80D3] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchPatient} onChange={(e) => setSearchPatient(e.target.value)} placeholder="Nome ou e-mail" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2F80D3] outline-none" />
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>}
          {!useCustomPeriod && selectedMonths.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>}
          {useCustomPeriod && customStartDate && customEndDate && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>}
          {selectedTherapistId && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Terapeuta selecionado</span>}
          {searchTherapist && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Terapeuta: {searchTherapist}</span>}
          {searchPatient && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Paciente: {searchPatient}</span>}
        </div>
      </div>
      
      {/* TABELA */}
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
              <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Duração Efetiva</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Alerta</th>
              <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">Nenhuma sessão encontrada no período selecionado</td>
                </tr>
              ) : (
                paginatedSessions.map((session) => {
                  const patientFotoUrl = getFotoUrl(session.patient_foto_url);
                  const therapistFotoUrl = getFotoUrl(session.therapist_foto_url);
                  const durationBadge = getDurationBadge(session.effective_duration_minutes);
                  const durationColor = getDurationColor(session.effective_duration_minutes);
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
                              <img src={patientFotoUrl} alt={session.patient_name} className="w-full h-full object-cover" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.parentElement) {
                                  e.currentTarget.parentElement.innerHTML = session.patient_name?.charAt(0).toUpperCase() || "P";
                                  e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                }
                              }} />
                            ) : (
                              <span className="text-white text-xs font-bold">{session.patient_name?.charAt(0).toUpperCase() || "P"}</span>
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
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center flex-shrink-0">
                            {therapistFotoUrl ? (
                              <img src={therapistFotoUrl} alt={session.therapist_name} className="w-full h-full object-cover" onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.parentElement) {
                                  e.currentTarget.parentElement.innerHTML = session.therapist_name?.charAt(0).toUpperCase() || "T";
                                  e.currentTarget.parentElement.className = "w-8 h-8 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-xs font-bold flex-shrink-0";
                                }
                              }} />
                            ) : (
                              <span className="text-white text-xs font-bold">{session.therapist_name?.charAt(0).toUpperCase() || "T"}</span>
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
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-lg font-bold ${durationColor}`}>
                            {session.effective_duration_minutes}
                          </span>
                          <span className="text-xs text-gray-400">min</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${durationBadge.bg} ${durationBadge.text}`}>
                          {session.effective_duration_minutes === 0 ? <AlertCircle className="w-3 h-3" /> : 
                           session.effective_duration_minutes < 15 ? <AlertTriangle className="w-3 h-3" /> : 
                           <Check className="w-3 h-3" />}
                          {durationBadge.label}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleViewSession(session.appointment_id)} className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors" title="Ver prontuário">
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
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}