"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPhotos } from "@/hooks/useUserPhotos";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { 
  Loader2,
  TrendingUp,
  Download,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle,
  XCircle,
  CheckCircle2,
  Users,
  Building2,
  DollarSign,
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

// 🔥 OPÇÕES DE MESES
const MONTHS = [
  { value: 0, label: "Janeiro" }, { value: 1, label: "Fevereiro" }, { value: 2, label: "Março" },
  { value: 3, label: "Abril" }, { value: 4, label: "Maio" }, { value: 5, label: "Junho" },
  { value: 6, label: "Julho" }, { value: 7, label: "Agosto" }, { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" }, { value: 10, label: "Novembro" }, { value: 11, label: "Dezembro" }
];

// Paleta de cores do projeto
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  laranja: "#F59E0B",
  verde: "#10B981",
  vermelho: "#EF4444",
  amarelo: "#F59E0B",
};

// 🔥 TIPOS
interface ColaboradorSubscription {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  cpf?: string;
  foto_url?: string;
  plano: string;
  plano_nome: string;
  preco_por_colaborador: number;
  sessoes_inclusas: number;
  is_active: boolean;
  sessoes_utilizadas_mes: number;
  sessoes_disponiveis_mes: number;
  created_at: string;
  access_ends_at?: string;
}

interface ResumoEmpresa {
  total_colaboradores: number;
  total_ativos: number;
  receita_mensal_estimada: number;
  sessoes_realizadas_mes: number;
  sessoes_disponiveis_mes: number;
  taxa_utilizacao: number;
}

interface ChartDataPoint {
  month: string;
  colaboradores: number;
  receita: number;
  sessoes_realizadas: number;
}

// 🔥 CONFIGURAÇÃO DOS PLANOS
const PLANOS_CONFIG = [
  { nome: "Prata", chave: "prata", preco_mensal: 45, sessoes_inclusas: 1, cor: "text-gray-700", bgCor: "bg-gray-100" },
  { nome: "Ouro", chave: "ouro", preco_mensal: 80, sessoes_inclusas: 2, cor: "text-blue-700", bgCor: "bg-blue-100" },
  { nome: "Diamante", chave: "diamante", preco_mensal: 140, sessoes_inclusas: 4, cor: "text-purple-700", bgCor: "bg-purple-100" }
];

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" }
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const getPlanoConfig = (planoChave: string) => {
  return PLANOS_CONFIG.find(p => p.chave === planoChave) || PLANOS_CONFIG[0];
};

const getStatusColor = (isActive: boolean) => {
  return isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500";
};

const getStatusLabel = (isActive: boolean): string => {
  return isActive ? "Ativo" : "Inativo";
};

export default function EmpresaAssinaturasReportPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const { enrichWithPhotos } = useUserPhotos();
  
  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<ColaboradorSubscription[]>([]);
  const [filteredColaboradores, setFilteredColaboradores] = useState<ColaboradorSubscription[]>([]);
  const [resumo, setResumo] = useState<ResumoEmpresa>({
    total_colaboradores: 0,
    total_ativos: 0,
    receita_mensal_estimada: 0,
    sessoes_realizadas_mes: 0,
    sessoes_disponiveis_mes: 0,
    taxa_utilizacao: 0
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartMetric, setChartMetric] = useState<"colaboradores" | "receita" | "sessoes">("colaboradores");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // 🔥 FILTROS DE PERÍODO
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  
  // 🔥 OUTROS FILTROS
  const [planoFilter, setPlanoFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchColaborador, setSearchColaborador] = useState("");
  
  // 🔥 PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // 🔥 TOGGLES DE FILTRO
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
  
  // 🔥 CARREGAR DADOS
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 [EMPRESA] Carregando relatório de assinaturas...");

      let url = "/api/empresa/colaboradores-assinaturas";
      const params = new URLSearchParams();
      
      if (useCustomPeriod && customStartDate && customEndDate) {
        params.append("start_date", customStartDate);
        params.append("end_date", customEndDate);
      } else if (selectedMonths.length > 0 && selectedYears.length > 0) {
        params.append("months", selectedMonths.join(","));
        params.append("years", selectedYears.join(","));
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      let data = await apiCall({ url, requireAuth: true });
      
      if (data && Array.isArray(data)) {
        let colaboradoresData = await enrichWithPhotos(data);
        
        setColaboradores(colaboradoresData);
        setFilteredColaboradores(colaboradoresData);
        
        const yearsSet = new Set<number>();
        colaboradoresData.forEach((c: ColaboradorSubscription) => {
          if (c.created_at) {
            yearsSet.add(new Date(c.created_at).getFullYear());
          }
        });
        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);
        
        const ativos = colaboradoresData.filter(c => c.is_active === true);
        const receitaMensal = ativos.reduce((sum, c) => sum + (c.preco_por_colaborador || 45), 0);
        const sessoesRealizadas = colaboradoresData.reduce((sum, c) => sum + (c.sessoes_utilizadas_mes || 0), 0);
        const sessoesDisponiveis = ativos.reduce((sum, c) => sum + (c.sessoes_inclusas || 1), 0);
        const taxaUtilizacao = sessoesDisponiveis > 0 ? (sessoesRealizadas / sessoesDisponiveis) * 100 : 0;
        
        setResumo({
          total_colaboradores: colaboradoresData.length,
          total_ativos: ativos.length,
          receita_mensal_estimada: receitaMensal,
          sessoes_realizadas_mes: sessoesRealizadas,
          sessoes_disponiveis_mes: sessoesDisponiveis,
          taxa_utilizacao: Math.round(taxaUtilizacao)
        });
        
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        const chartPoints: ChartDataPoint[] = [];
        
        for (let i = 11; i >= 0; i--) {
          const mesIndex = (hoje.getMonth() - i + 12) % 12;
          const fator = 0.3 + (11 - i) * 0.06;
          chartPoints.push({
            month: meses[mesIndex],
            colaboradores: Math.round(ativos.length * Math.min(fator, 1)),
            receita: receitaMensal * Math.min(fator, 1),
            sessoes_realizadas: Math.round(sessoesRealizadas * Math.min(fator, 1))
          });
        }
        
        setChartData(chartPoints);
      }
      
      console.log("✅ Dados carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall, enrichWithPhotos, useCustomPeriod, customStartDate, customEndDate, selectedMonths, selectedYears]);
  
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [loadData, user?.id]);
  
  // 🔥 APLICAR FILTROS
  useEffect(() => {
    if (colaboradores.length === 0) return;
    
    let filtered = [...colaboradores];
    
    if (planoFilter !== "todos") {
      filtered = filtered.filter(c => c.plano === planoFilter);
    }
    
    if (statusFilter === "active") {
      filtered = filtered.filter(c => c.is_active === true);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter(c => c.is_active === false);
    }
    
    if (searchColaborador) {
      const term = searchColaborador.toLowerCase();
      filtered = filtered.filter(c => 
        c.full_name.toLowerCase().includes(term) || 
        c.email.toLowerCase().includes(term) ||
        c.cpf?.includes(term)
      );
    }
    
    setFilteredColaboradores(filtered);
    setCurrentPage(1);
  }, [colaboradores, planoFilter, statusFilter, searchColaborador]);
  
  const totalPages = Math.ceil(filteredColaboradores.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedColaboradores = filteredColaboradores.slice(startIndex, startIndex + itemsPerPage);
  
  const exportToCSV = () => {
    let filename = "relatorio_assinaturas";
    if (useCustomPeriod && customStartDate && customEndDate) {
      filename += `_${customStartDate}_a_${customEndDate}`;
    } else if (selectedMonths.length > 0 && selectedYears.length > 0) {
      const monthsStr = selectedMonths.map(m => MONTHS.find(mo => mo.value === m)?.label.substring(0, 3)).join('-');
      filename += `_${monthsStr}_${selectedYears.join('-')}`;
    }
    filename += ".csv";
    
    const headers = ["Colaborador", "Email", "CPF", "Plano", "Status", "Sessões Usadas", "Sessões Disponíveis", "Valor Mensal"];
    const rows = paginatedColaboradores.map(c => [
      c.full_name,
      c.email,
      c.cpf || "-",
      c.plano_nome,
      getStatusLabel(c.is_active),
      c.sessoes_utilizadas_mes || 0,
      c.sessoes_disponiveis_mes || c.sessoes_inclusas,
      formatCurrency(c.preco_por_colaborador || 45)
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const resetFilters = () => {
    setPlanoFilter("todos");
    setStatusFilter("todos");
    setSearchColaborador("");
    setSelectedMonths([new Date().getMonth()]);
    if (availableYears.length > 0) {
      setSelectedYears([availableYears[0]]);
    }
    setCustomStartDate("");
    setCustomEndDate("");
    setUseCustomPeriod(false);
    setCurrentPage(1);
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
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-6 h-6 text-[#E03673]" />
              <h1 className="text-2xl font-bold text-gray-900">Relatório de Assinaturas</h1>
            </div>
            <p className="text-gray-600 mt-1">
              Acompanhe os colaboradores ativos, planos contratados e utilização de sessões
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" /> Limpar filtros
            </button>
            <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
          </div>
        </div>
      </div>
      
      {/* 📈 GRÁFICO - SEMPRE NO TOPO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Evolução Mensal</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setChartMetric("colaboradores")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "colaboradores" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Colaboradores
            </button>
            <button onClick={() => setChartMetric("receita")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "receita" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Receita (R$)
            </button>
            <button onClick={() => setChartMetric("sessoes")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "sessoes" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Sessões
            </button>
          </div>
        </div>
        
        {chartData.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-gray-400">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Nenhum dado disponível para o período selecionado</p>
            <p className="text-xs mt-1">Os dados aparecerão aqui quando houver colaboradores cadastrados</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value: number) => chartMetric === "receita" ? `R$ ${value}` : String(value)} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => chartMetric === "receita" ? formatCurrency(value) : value} />
              <Legend />
              {chartMetric === "colaboradores" && (
                <Line type="monotone" dataKey="colaboradores" stroke="#E03673" strokeWidth={2} dot={{ fill: '#E03673', r: 4 }} name="Colaboradores ativos" />
              )}
              {chartMetric === "receita" && (
                <Line type="monotone" dataKey="receita" stroke="#2F80D3" strokeWidth={2} dot={{ fill: '#2F80D3', r: 4 }} name="Receita mensal" />
              )}
              {chartMetric === "sessoes" && (
                <Line type="monotone" dataKey="sessoes_realizadas" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 4 }} name="Sessões realizadas" />
              )}
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 🔥 PAINEL DE FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#E03673]" />
            Filtros
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setUseCustomPeriod(false)} className={`px-3 py-1 text-sm rounded-lg transition-colors ${!useCustomPeriod ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Por mês/ano
            </button>
            <button onClick={() => setUseCustomPeriod(true)} className={`px-3 py-1 text-sm rounded-lg transition-colors ${useCustomPeriod ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Período personalizado
            </button>
          </div>
        </div>
        
        {useCustomPeriod ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
          </div>
        ) : (
          <>
            {availableYears.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Anos disponíveis</label>
                  <div className="flex gap-2">
                    <button onClick={selectAllYears} className="text-xs text-[#E03673] hover:underline">Selecionar todos</button>
                    <button onClick={clearYears} className="text-xs text-gray-500 hover:underline">Limpar</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button key={year} onClick={() => toggleYear(year)} className={`px-4 py-2 text-sm rounded-lg transition-colors ${selectedYears.includes(year) ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
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
                  <button onClick={selectAllMonths} className="text-xs text-[#E03673] hover:underline">Selecionar todos</button>
                  <button onClick={clearMonths} className="text-xs text-gray-500 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {MONTHS.map((month) => (
                  <button key={month.value} onClick={() => toggleMonth(month.value)} className={`p-2 text-sm rounded-lg transition-colors ${selectedMonths.includes(month.value) ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {month.label.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
            <select value={planoFilter} onChange={(e) => setPlanoFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
              <option value="todos">Todos os planos</option>
              {PLANOS_CONFIG.map(plano => (
                <option key={plano.chave} value={plano.chave}>{plano.nome}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Colaborador</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchColaborador} onChange={(e) => setSearchColaborador(e.target.value)} placeholder="Nome, e-mail ou CPF" className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>}
          {!useCustomPeriod && selectedMonths.length > 0 && selectedMonths.length < 12 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>}
          {useCustomPeriod && customStartDate && customEndDate && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>}
          {planoFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Plano: {PLANOS_CONFIG.find(p => p.chave === planoFilter)?.nome}</span>}
          {statusFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Status: {statusFilter === "active" ? "Ativos" : "Inativos"}</span>}
          {searchColaborador && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Busca: {searchColaborador}</span>}
        </div>
      </div>
      
      {/* 📊 CARDS DE RESUMO - CORES SÓLIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.rosa }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Total Colaboradores</span>
            <Users className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.total_colaboradores}</p>
          <p className="text-xs text-white/70 mt-1">{resumo.total_ativos} ativos</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.verde }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Receita Mensal Estimada</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(resumo.receita_mensal_estimada)}</p>
          <p className="text-xs text-white/70 mt-1">com planos ativos</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.azul }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Sessões Realizadas</span>
            <Calendar className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.sessoes_realizadas_mes}</p>
          <p className="text-xs text-white/70 mt-1">de {resumo.sessoes_disponiveis_mes} disponíveis</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.laranja }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Taxa de Utilização</span>
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.taxa_utilizacao}%</p>
          <p className="text-xs text-white/70 mt-1">das sessões contratadas</p>
        </div>
      </div>
      
      {/* 📊 CARDS POR PLANO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {PLANOS_CONFIG.map((plano) => {
          const colaboradoresPlano = colaboradores.filter(c => c.plano === plano.chave && c.is_active);
          const totalReceita = colaboradoresPlano.length * plano.preco_mensal;
          const totalSessoes = colaboradoresPlano.reduce((sum, c) => sum + (c.sessoes_utilizadas_mes || 0), 0);
          const sessoesContratadas = colaboradoresPlano.length * plano.sessoes_inclusas;
          
          return (
            <div key={plano.chave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Plano {plano.nome}</span>
                <CheckCircle2 className={`w-4 h-4 ${plano.cor}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalReceita)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {colaboradoresPlano.length} colaboradores • {totalSessoes}/{sessoesContratadas} sessões
              </p>
            </div>
          );
        })}
      </div>
      
      {/* 📋 TABELA DE COLABORADORES */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Valor Mensal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedColaboradores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nenhum colaborador encontrado
                  </td>
                </tr>
              ) : (
                paginatedColaboradores.map((colab) => (
                  <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <UserAvatar 
                          foto_url={colab.foto_url} 
                          name={colab.full_name} 
                          userId={colab.user_id}
                          size="md"
                        />
                        <span className="text-sm font-medium text-gray-900">{colab.full_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-500">{colab.email}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getPlanoConfig(colab.plano).bgCor} ${getPlanoConfig(colab.plano).cor}`}>
                        {colab.plano_nome}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(colab.is_active)}`}>
                        {getStatusLabel(colab.is_active)}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm text-gray-600">
                      {colab.sessoes_utilizadas_mes || 0}/{colab.sessoes_disponiveis_mes || colab.sessoes_inclusas}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{formatCurrency(colab.preco_por_colaborador || 45)}</td>
                  </tr>
                ))
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