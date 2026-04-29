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
  Calendar,
  CheckCircle2,
  Users,
  Building2,
  DollarSign,
  Clock,
  Eye,
  Ban,
  RefreshCw
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

// ============================================================
// TIPOS
// ============================================================

interface EmpresaSubscription {
  id: number;
  empresa_id: number;
  empresa_name: string;
  empresa_email: string;
  empresa_cnpj?: string;
  empresa_foto_url?: string;
  empresa_user_id?: number;
  plano: string;
  plano_nome: string;
  preco_por_colaborador: number;
  sessoes_inclusas: number;
  status: "active" | "inactive" | "suspended";
  total_colaboradores: number;
  colaboradores_ativos: number;
  sessoes_realizadas: number;
  sessoes_disponiveis: number;
  receita_mensal: number;
  created_at: string;
}

interface SummaryReport {
  total_empresas: number;
  total_ativas: number;
  total_suspensas: number;
  total_canceladas: number;
  total_colaboradores: number;
  total_colaboradores_ativos: number;
  receita_total_mensal: number;
  receita_total_anual: number;
}

interface ChartDataPoint {
  month: string;
  empresas: number;
  receita: number;
  colaboradores: number;
}

// ============================================================
// CONSTANTES
// ============================================================

const MONTHS = [
  { value: 0, label: "Janeiro" }, { value: 1, label: "Fevereiro" }, { value: 2, label: "Março" },
  { value: 3, label: "Abril" }, { value: 4, label: "Maio" }, { value: 5, label: "Junho" },
  { value: 6, label: "Julho" }, { value: 7, label: "Agosto" }, { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" }, { value: 10, label: "Novembro" }, { value: 11, label: "Dezembro" }
];

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "active", label: "Ativas" },
  { value: "suspended", label: "Suspensas" },
  { value: "inactive", label: "Canceladas" }
];

// ============================================================
// HELPERS
// ============================================================

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "active": return "bg-green-100 text-green-700";
    case "suspended": return "bg-red-100 text-red-700";
    case "inactive": return "bg-gray-100 text-gray-500";
    default: return "bg-gray-100 text-gray-500";
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "active": return "Ativa";
    case "suspended": return "Suspensa";
    case "inactive": return "Cancelada";
    default: return status;
  }
};

const getPlanoColor = (plano: string) => {
  switch (plano) {
    case "diamante":
      return "bg-purple-100 text-purple-700";
    case "ouro":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function AdminEmpresasAssinaturasPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const { enrichWithPhotos } = useUserPhotos();
  
  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<EmpresaSubscription[]>([]);
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<EmpresaSubscription[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [summary, setSummary] = useState<SummaryReport>({
    total_empresas: 0,
    total_ativas: 0,
    total_suspensas: 0,
    total_canceladas: 0,
    total_colaboradores: 0,
    total_colaboradores_ativos: 0,
    receita_total_mensal: 0,
    receita_total_anual: 0
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [chartMetric, setChartMetric] = useState<"empresas" | "receita" | "colaboradores">("empresas");
  
  // 🔥 FILTROS DE PERÍODO
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  
  // 🔥 OUTROS FILTROS
  const [planoFilter, setPlanoFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [searchEmpresa, setSearchEmpresa] = useState("");
  
  // 🔥 PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // ============================================================
  // FUNÇÕES DE FILTRO
  // ============================================================
  
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
  
  // ============================================================
  // CARREGAR DADOS
  // ============================================================
  
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 [ADMIN] Carregando relatório de assinaturas empresariais...");

      let empresasData = await apiCall({ 
        url: "/api/admin/reports/empresas-assinaturas", 
        requireAuth: true 
      });
      
      if (empresasData && Array.isArray(empresasData)) {
        // 🔥 ENRIQUECER COM FOTOS
        empresasData = await enrichWithPhotos(empresasData);
        
        console.log("📸 Empresas com fotos:", empresasData.map((e: any) => ({ nome: e.empresa_name, foto: e.empresa_foto_url })));
        
        setSubscriptions(empresasData);
        setFilteredSubscriptions(empresasData);
        
        // Extrair anos disponíveis
        const yearsSet = new Set<number>();
        empresasData.forEach((s: any) => {
          if (s.created_at) {
            yearsSet.add(new Date(s.created_at).getFullYear());
          }
        });
        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);
        
        if (sortedYears.length > 0 && selectedYears.length === 0) {
          setSelectedYears([sortedYears[0]]);
        }
        
        // 🔥 CALCULAR RESUMO
        const ativas = empresasData.filter((s: any) => s.status === "active");
        const suspensas = empresasData.filter((s: any) => s.status === "suspended");
        const canceladas = empresasData.filter((s: any) => s.status === "inactive");
        const totalColaboradores = empresasData.reduce((sum: number, s: any) => sum + (s.total_colaboradores || 0), 0);
        const totalColaboradoresAtivos = empresasData.reduce((sum: number, s: any) => sum + (s.colaboradores_ativos || 0), 0);
        const receitaTotalMensal = empresasData.reduce((sum: number, s: any) => sum + (s.receita_mensal || 0), 0);
        
        setSummary({
          total_empresas: empresasData.length,
          total_ativas: ativas.length,
          total_suspensas: suspensas.length,
          total_canceladas: canceladas.length,
          total_colaboradores: totalColaboradores,
          total_colaboradores_ativos: totalColaboradoresAtivos,
          receita_total_mensal: receitaTotalMensal,
          receita_total_anual: receitaTotalMensal * 12
        });
        
        // 🔥 DADOS DO GRÁFICO
        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        
        const chartPoints: ChartDataPoint[] = [];
        for (let i = 0; i <= mesAtual; i++) {
          const mesNome = mesesNomes[i];
          const fator = (i + 1) / (mesAtual + 1);
          
          chartPoints.push({
            month: mesNome,
            empresas: Math.round(ativas.length * fator),
            receita: receitaTotalMensal * fator,
            colaboradores: Math.round(totalColaboradoresAtivos * fator)
          });
        }
        
        setChartData(chartPoints);
      }
      
      console.log("✅ Dados carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
      const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const emptyChartPoints: ChartDataPoint[] = mesesNomes.map(month => ({
        month,
        empresas: 0,
        receita: 0,
        colaboradores: 0
      }));
      setChartData(emptyChartPoints);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall, enrichWithPhotos]);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // ============================================================
  // APLICAR FILTROS
  // ============================================================
  
  useEffect(() => {
    if (subscriptions.length === 0) return;
    
    let filtered = [...subscriptions];
    
    if (planoFilter !== "todos") {
      filtered = filtered.filter(s => s.plano === planoFilter);
    }
    
    if (statusFilter !== "todos") {
      filtered = filtered.filter(s => s.status === statusFilter);
    }
    
    if (searchEmpresa) {
      const term = searchEmpresa.toLowerCase();
      filtered = filtered.filter(s => 
        s.empresa_name.toLowerCase().includes(term) || 
        s.empresa_email.toLowerCase().includes(term) ||
        s.empresa_cnpj?.includes(term)
      );
    }
    
    setFilteredSubscriptions(filtered);
    setCurrentPage(1);
  }, [subscriptions, planoFilter, statusFilter, searchEmpresa]);
  
  // ============================================================
  // HANDLERS
  // ============================================================
  
  const exportToCSV = () => {
    const headers = ["ID", "Empresa", "CNPJ", "Plano", "Status", "Colaboradores", "Ativos", "Receita Mensal", "Preço/Colaborador"];
    const rows = filteredSubscriptions.map(s => [
      s.empresa_id,
      s.empresa_name,
      s.empresa_cnpj || "-",
      s.plano_nome,
      getStatusLabel(s.status),
      s.total_colaboradores,
      s.colaboradores_ativos,
      formatCurrency(s.receita_mensal),
      formatCurrency(s.preco_por_colaborador)
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "relatorio_empresas_assinaturas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const resetFilters = () => {
    setPlanoFilter("todos");
    setStatusFilter("todos");
    setSearchEmpresa("");
    setSelectedMonths([new Date().getMonth()]);
    if (availableYears.length > 0) {
      setSelectedYears([availableYears[0]]);
    }
    setCustomStartDate("");
    setCustomEndDate("");
    setUseCustomPeriod(false);
    setCurrentPage(1);
  };
  
  const handleToggleSuspension = async (empresaId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    if (!confirm(`Deseja ${newStatus === "active" ? "reativar" : "suspender"} o acesso desta empresa?`)) return;
    
    try {
      await apiCall({
        url: `/api/admin/empresas/${empresaId}/alterar-status`,
        method: "POST",
        body: { status: newStatus },
        requireAuth: true
      });
      loadData();
    } catch (err) {
      console.error("Erro ao alterar status:", err);
      alert("Erro ao alterar status da empresa");
    }
  };
  
  // ============================================================
  // PAGINAÇÃO
  // ============================================================
  
  const totalPages = Math.ceil(filteredSubscriptions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + itemsPerPage);
  
  // ============================================================
  // RENDER
  // ============================================================
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
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
            <h1 className="text-2xl font-bold text-gray-900">Assinaturas Empresariais</h1>
            <p className="text-gray-600 mt-1">
              Acompanhe o faturamento e gestão financeira de planos empresariais
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
      
      {/* 📈 GRÁFICO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Evolução</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setChartMetric("empresas")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "empresas" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Empresas
            </button>
            <button onClick={() => setChartMetric("colaboradores")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "colaboradores" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Colaboradores
            </button>
            <button onClick={() => setChartMetric("receita")} className={`px-3 py-1 text-sm rounded-lg transition-colors ${chartMetric === "receita" ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700'}`}>
              Receita (R$)
            </button>
          </div>
        </div>
        
        {chartData.length === 0 || chartData.every(d => d.empresas === 0 && d.receita === 0 && d.colaboradores === 0) ? (
          <div className="h-80 flex flex-col items-center justify-center text-gray-400">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Nenhum dado disponível para o período selecionado</p>
            <p className="text-xs mt-1">Os dados aparecerão aqui quando houver empresas cadastradas</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={(value: number) => String(value)} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(value: number) => formatCurrency(value)} />
              <Tooltip formatter={(value: number, name: string) => {
                if (name === "Empresas Ativas") return [value, "Empresas Ativas"];
                if (name === "Receita") return [formatCurrency(value), "Receita"];
                return [value, name];
              }} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="empresas" stroke="#E03673" strokeWidth={2} dot={{ fill: '#E03673', r: 4 }} name="Empresas Ativas" />
              <Line yAxisId="right" type="monotone" dataKey="receita" stroke="#2F80D3" strokeWidth={2} dot={{ fill: '#2F80D3', r: 4 }} name="Receita" />
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 📊 CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Empresas</span>
            <Building2 className="w-5 h-5 text-[#E03673]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_empresas}</p>
          <p className="text-sm text-gray-500 mt-1">{summary.total_ativas} ativas</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Colaboradores</span>
            <Users className="w-5 h-5 text-[#2F80D3]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summary.total_colaboradores_ativos}</p>
          <p className="text-sm text-gray-500 mt-1">de {summary.total_colaboradores} totais</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Receita Mensal</span>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.receita_total_mensal)}</p>
          <p className="text-sm text-gray-500 mt-1">{formatCurrency(summary.receita_total_anual)}/ano</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Ticket Médio</span>
            <TrendingUp className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {subscriptions.length > 0 && summary.total_empresas_ativas > 0
              ? formatCurrency(summary.receita_total_mensal / summary.total_empresas_ativas)
              : formatCurrency(0)}
          </p>
          <p className="text-sm text-gray-500 mt-1">por empresa ativa</p>
        </div>
      </div>
      
      {/* 🔥 CARDS POR PLANO - SEMPRE VISÍVEIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[
          { chave: "prata", nome: "Prata", precoPadrao: 45, cor: "text-gray-700", bg: "bg-gray-100" },
          { chave: "ouro", nome: "Ouro", precoPadrao: 80, cor: "text-blue-700", bg: "bg-blue-100" },
          { chave: "diamante", nome: "Diamante", precoPadrao: 140, cor: "text-purple-700", bg: "bg-purple-100" }
        ].map((plano) => {
          // Buscar dados reais das empresas com este plano
          const empresasPlano = subscriptions.filter(s => s.plano === plano.chave && s.status === "active");
          const totalReceita = empresasPlano.reduce((sum, e) => sum + (e.receita_mensal || 0), 0);
          const totalColaboradores = empresasPlano.reduce((sum, e) => sum + (e.colaboradores_ativos || 0), 0);
          const quantidadeEmpresas = empresasPlano.length;
          
          // Preço real (do banco) ou padrão
          const precoReal = empresasPlano.length > 0 && empresasPlano[0].preco_por_colaborador 
            ? empresasPlano[0].preco_por_colaborador 
            : plano.precoPadrao;
          
          return (
            <div key={plano.chave} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Plano {plano.nome}</span>
                <CheckCircle2 className={`w-4 h-4 ${plano.cor}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalReceita)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {quantidadeEmpresas} empresas • {totalColaboradores} colaboradores
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatCurrency(precoReal)}/colaborador
              </p>
            </div>
          );
        })}
      </div>
      
      {/* 🔥 PAINEL DE FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#E03673]" /> Filtros
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
            
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Meses</label>
                <div className="flex gap-2">
                  <button onClick={selectAllMonths} className="text-xs text-[#E03673] hover:underline">Selecionar todos</button>
                  <button onClick={clearMonths} className="text-xs text-gray-500 hover:underline">Limpar</button>
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
            <select value={planoFilter} onChange={(e) => setPlanoFilter(e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
              <option value="todos">Todos os planos</option>
              {[...new Set(subscriptions.map(s => s.plano))].filter(Boolean).map(plano => (
                <option key={plano} value={plano}>
                  {subscriptions.find(s => s.plano === plano)?.plano_nome || plano}
                </option>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Empresa</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={searchEmpresa} 
                onChange={(e) => setSearchEmpresa(e.target.value)} 
                placeholder="Nome, email ou CNPJ" 
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" 
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>}
          {!useCustomPeriod && selectedMonths.length > 0 && selectedMonths.length < 12 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>}
          {useCustomPeriod && customStartDate && customEndDate && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>}
          {planoFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Plano: {subscriptions.find(s => s.plano === planoFilter)?.plano_nome || planoFilter}</span>}
          {statusFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Status: {STATUS_OPTIONS.find(o => o.value === statusFilter)?.label}</span>}
          {searchEmpresa && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Empresa: {searchEmpresa}</span>}
        </div>
      </div>
      
      {/* 📋 TABELA */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Empresa</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Colaboradores</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Receita</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              ) : (
                paginatedSubscriptions.map((sub) => (
                  <tr key={sub.empresa_id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar 
                          foto_url={sub.empresa_foto_url} 
                          name={sub.empresa_name} 
                          userId={sub.empresa_user_id}
                          size="md"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{sub.empresa_name}</p>
                          <p className="text-xs text-gray-500">{sub.empresa_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{sub.empresa_cnpj || "-"}</td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${getPlanoColor(sub.plano)}`}>
                        {sub.plano_nome}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatCurrency(sub.preco_por_colaborador)}/colaborador
                      </p>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(sub.status)}`}>
                        {getStatusLabel(sub.status)}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{sub.colaboradores_ativos}</p>
                        <p className="text-xs text-gray-400">de {sub.total_colaboradores}</p>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <p className="text-sm font-semibold text-green-600">{formatCurrency(sub.receita_mensal)}</p>
                      <p className="text-xs text-gray-400">/mês</p>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => window.open(`/admin/empresas/${sub.empresa_id}`, '_blank')}
                          className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleToggleSuspension(sub.empresa_id, sub.status)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title={sub.status === "active" ? "Suspender acesso" : "Reativar acesso"}
                        >
                          {sub.status === "active" ? <Ban className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      </div>
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
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">Página {currentPage} de {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages} 
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}