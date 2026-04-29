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
  DollarSign,
  Users,
  FileText,
  Receipt
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
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  branco: "#FFFFFF",
};

// 🔥 TIPOS
interface ColaboradorFinanceiro {
  id: number;
  user_id: number;
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
  foto_url?: string;
  plano: string;
  plano_nome: string;
  valor_plano_mensal: number;
  sessoes_inclusas: number;
  sessoes_realizadas: number;
  sessoes_realizadas_periodo?: number;
  status: "active" | "inactive";
  created_at: string;
  ultima_sessao?: string;
}

interface ResumoFinanceiro {
  total_colaboradores: number;
  total_colaboradores_ativos: number;
  total_sessoes_realizadas: number;
  total_sessoes_disponiveis: number;
  taxa_utilizacao: number;
  receita_mensal_estimada: number;
  total_a_faturar: number;
  total_faturado: number;
  total_pago: number;
}

interface ChartDataPoint {
  mes: string;
  receita: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const getPlanoColor = (plano: string): string => {
  const map: Record<string, string> = {
    prata: "bg-gray-100 text-gray-700",
    ouro: "bg-blue-100 text-blue-700",
    diamante: "bg-purple-100 text-purple-700"
  };
  return map[plano] ?? "bg-gray-100 text-gray-700";
};

export default function EmpresaFinancialReportPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const { enrichWithPhotos } = useUserPhotos();
  
  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [colaboradores, setColaboradores] = useState<ColaboradorFinanceiro[]>([]);
  const [filteredColaboradores, setFilteredColaboradores] = useState<ColaboradorFinanceiro[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [resumo, setResumo] = useState<ResumoFinanceiro>({
    total_colaboradores: 0,
    total_colaboradores_ativos: 0,
    total_sessoes_realizadas: 0,
    total_sessoes_disponiveis: 0,
    taxa_utilizacao: 0,
    receita_mensal_estimada: 0,
    total_a_faturar: 0,
    total_faturado: 0,
    total_pago: 0
  });
  
  // 🔥 FILTROS DE PERÍODO
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  
  // 🔥 OUTROS FILTROS
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [planoFilter, setPlanoFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<string>("nome");
  
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
      console.log("📥 [EMPRESA] Carregando relatório financeiro...");

      let url = "/api/empresa/reports/financeiro";
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
      
      if (data && data.colaboradores) {
        let colaboradoresData = await enrichWithPhotos(data.colaboradores);
        
        setColaboradores(colaboradoresData);
        setFilteredColaboradores(colaboradoresData);
        
        const yearsSet = new Set<number>();
        colaboradoresData.forEach((c: ColaboradorFinanceiro) => {
          if (c.created_at) {
            yearsSet.add(new Date(c.created_at).getFullYear());
          }
        });
        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);
        
        setResumo({
          total_colaboradores: data.resumo?.total_colaboradores || 0,
          total_colaboradores_ativos: data.resumo?.total_colaboradores_ativos || 0,
          total_sessoes_realizadas: data.resumo?.total_sessoes_realizadas || 0,
          total_sessoes_disponiveis: data.resumo?.total_sessoes_disponiveis || 0,
          taxa_utilizacao: data.resumo?.taxa_utilizacao || 0,
          receita_mensal_estimada: data.resumo?.receita_mensal_estimada || 0,
          total_a_faturar: data.resumo?.total_a_faturar || 0,
          total_faturado: data.resumo?.total_faturado || 0,
          total_pago: data.resumo?.total_pago || 0
        });
        
        setChartData(data.chart_data || []);
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
  
  // 🔥 APLICAR FILTROS DE BUSCA, STATUS, PLANO
  useEffect(() => {
    let filtered = [...colaboradores];
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.nome.toLowerCase().includes(term) || 
        c.email.toLowerCase().includes(term) ||
        c.cpf?.includes(term)
      );
    }
    
    if (statusFilter !== "todos") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    
    if (planoFilter !== "todos") {
      filtered = filtered.filter(c => c.plano === planoFilter);
    }
    
    switch (sortBy) {
      case "nome":
        filtered.sort((a, b) => a.nome.localeCompare(b.nome));
        break;
      case "sessoes":
        filtered.sort((a, b) => (b.sessoes_realizadas_periodo || b.sessoes_realizadas) - (a.sessoes_realizadas_periodo || a.sessoes_realizadas));
        break;
      case "valor":
        filtered.sort((a, b) => b.valor_plano_mensal - a.valor_plano_mensal);
        break;
      default:
        filtered.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    
    setFilteredColaboradores(filtered);
    setCurrentPage(1);
  }, [colaboradores, searchTerm, statusFilter, planoFilter, sortBy]);
  
  // 🔥 PAGINAÇÃO
  const totalPages = Math.ceil(filteredColaboradores.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedColaboradores = filteredColaboradores.slice(startIndex, startIndex + itemsPerPage);
  
  const exportToCSV = () => {
    let filename = "relatorio_financeiro_empresa";
    if (useCustomPeriod && customStartDate && customEndDate) {
      filename += `_${customStartDate}_a_${customEndDate}`;
    } else if (selectedMonths.length > 0 && selectedYears.length > 0) {
      const monthsStr = selectedMonths.map(m => MONTHS.find(mo => mo.value === m)?.label.substring(0, 3)).join('-');
      filename += `_${monthsStr}_${selectedYears.join('-')}`;
    }
    filename += ".csv";
    
    const headers = ["Colaborador", "Email", "CPF", "Plano", "Valor Mensal", "Sessões Realizadas", "Sessões Inclusas", "Status"];
    const rows = filteredColaboradores.map(c => [
      c.nome,
      c.email,
      c.cpf || "-",
      c.plano_nome,
      formatCurrency(c.valor_plano_mensal),
      c.sessoes_realizadas_periodo || c.sessoes_realizadas,
      c.sessoes_inclusas,
      c.status === "active" ? "Ativo" : "Inativo"
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
    setSearchTerm("");
    setStatusFilter("todos");
    setPlanoFilter("todos");
    setSortBy("nome");
    setSelectedMonths([new Date().getMonth()]);
    setSelectedYears([new Date().getFullYear()]);
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
            <h1 className="text-2xl font-bold text-gray-900">Relatório Financeiro</h1>
            <p className="text-gray-600 mt-1">
              Acompanhe o faturamento e gestão financeira da sua empresa
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
      
      {/* 📈 GRÁFICO DE RECEITA MENSAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Evolução do Faturamento Mensal</h3>
          </div>
        </div>
        
        {!chartData || chartData.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-gray-400">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Nenhum dado disponível para o período selecionado</p>
            <p className="text-xs mt-1">Os dados aparecerão aqui quando houver colaboradores ativos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="receita" 
                stroke="#2F80D3" 
                strokeWidth={3} 
                dot={{ fill: '#2F80D3', r: 5 }} 
                name="Despesa Mensal" 
              />
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
        {chartData && chartData.length > 0 && chartData.every(d => d.receita === 0) && (
          <div className="text-center text-gray-400 text-sm mt-2">
            Nenhuma receita registrada no período. Adicione colaboradores ativos para ver os valores.
          </div>
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Colaborador</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, email ou CPF"
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="todos">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
            <select
              value={planoFilter}
              onChange={(e) => setPlanoFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="todos">Todos os planos</option>
              <option value="prata">Prata</option>
              <option value="ouro">Ouro</option>
              <option value="diamante">Diamante</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="nome">Nome</option>
              <option value="sessoes">Mais sessões</option>
              <option value="valor">Maior valor</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>}
          {!useCustomPeriod && selectedMonths.length > 0 && selectedMonths.length < 12 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>}
          {useCustomPeriod && customStartDate && customEndDate && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>}
          {statusFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Status: {statusFilter === "active" ? "Ativos" : "Inativos"}</span>}
          {planoFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Plano: {planoFilter === "prata" ? "Prata" : planoFilter === "ouro" ? "Ouro" : "Diamante"}</span>}
          {searchTerm && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Busca: {searchTerm}</span>}
        </div>
      </div>
      
      {/* 📊 CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5" style={{ borderTop: `4px solid ${CORES.rosa}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Total Colaboradores</span>
            <Users className="w-5 h-5 text-[#E03673]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{resumo.total_colaboradores}</p>
          <p className="text-sm text-gray-500 mt-1">{resumo.total_colaboradores_ativos} ativos</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5" style={{ borderTop: `4px solid ${CORES.verde}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Sessões Realizadas</span>
            <Calendar className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{resumo.total_sessoes_realizadas}</p>
          <p className="text-sm text-gray-500 mt-1">de {resumo.total_sessoes_disponiveis} disponíveis</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5" style={{ borderTop: `4px solid ${CORES.azul}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Taxa de Utilização</span>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{resumo.taxa_utilizacao}%</p>
          <p className="text-sm text-gray-500 mt-1">das sessões contratadas</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5" style={{ borderTop: `4px solid ${CORES.laranja}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">Receita Mensal Estimada</span>
            <DollarSign className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(resumo.receita_mensal_estimada)}</p>
          <p className="text-sm text-gray-500 mt-1">com planos ativos</p>
        </div>
      </div>
      
      {/* 📊 CARDS DE FATURAMENTO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl shadow-sm p-5 text-center" style={{ backgroundColor: CORES.amarelo, color: CORES.branco }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Receipt className="w-5 h-5" />
            <span className="text-sm font-medium">A Faturar</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(resumo.total_a_faturar)}</p>
          <p className="text-xs mt-1 opacity-80">Valor mensal dos colaboradores ativos</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-center" style={{ backgroundColor: CORES.azul, color: CORES.branco }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <FileText className="w-5 h-5" />
            <span className="text-sm font-medium">Faturado</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(resumo.total_faturado)}</p>
          <p className="text-xs mt-1 opacity-80">Notas fiscais emitidas</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-center" style={{ backgroundColor: CORES.verde, color: CORES.branco }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Pago</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(resumo.total_pago)}</p>
          <p className="text-xs mt-1 opacity-80">Valores já recebidos</p>
        </div>
      </div>
      
      {/* 📋 TABELA DE COLABORADORES */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Valor/Mês</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedColaboradores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhum colaborador encontrado no período selecionado
                  </td>
                </tr>
              ) : (
                paginatedColaboradores.map((colab) => (
                  <tr key={colab.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar 
                          foto_url={colab.foto_url} 
                          name={colab.nome} 
                          userId={colab.user_id}
                          size="md"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{colab.nome}</p>
                          <p className="text-xs text-gray-500">{colab.email}</p>
                          {colab.cpf && <p className="text-xs text-gray-400">CPF: {colab.cpf}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${getPlanoColor(colab.plano)}`}>
                        {colab.plano_nome} ({colab.sessoes_inclusas} sessão{colab.sessoes_inclusas > 1 ? 'ões' : ''})
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-sm font-semibold text-green-600">{formatCurrency(colab.valor_plano_mensal)}</span>
                    </td>
                    <td className="p-3 text-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{colab.sessoes_realizadas_periodo || colab.sessoes_realizadas}</p>
                        <p className="text-xs text-gray-400">de {colab.sessoes_inclusas} por mês</p>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {colab.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                          <XCircle className="w-3 h-3" /> Inativo
                        </span>
                      )}
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