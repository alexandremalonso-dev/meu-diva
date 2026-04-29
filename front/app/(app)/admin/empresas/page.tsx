"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { CORES } from "@/lib/colors";
import { 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  Building2,
  Users,
  Edit,
  Ban,
  RefreshCw,
  Clock,
  Search,
  Building,
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

// 🔥 TIPOS
interface Empresa {
  id: number;
  user_id: number;
  nome: string;
  razao_social: string;
  cnpj: string;
  email: string;
  telefone: string;
  plano_atual: string;
  plano_nome: string;
  preco_por_colaborador: number;
  sessoes_inclusas: number;
  status: "active" | "inactive" | "suspended";
  total_colaboradores: number;
  colaboradores_ativos: number;
  data_cadastro: string;
  foto_url?: string;
}

interface HistoricoPlano {
  id: number;
  empresa_id: number;
  plano: string;
  plano_nome: string;
  data_inicio: string;
  data_fim: string | null;
  motivo: string | null;
}

interface ChartDataPoint {
  mes: string;
  receita: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

const formatDateInput = (date: Date) => {
  return date.toISOString().split('T')[0];
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "active":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Ativa</span>;
    case "suspended":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Suspensa</span>;
    case "inactive":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500"><Ban className="w-3 h-3" /> Inativa</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Desconhecido</span>;
  }
};

function getFileUrl(url: string) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

// 🔥 COMPONENTE DE AVATAR COM FOTO (SIMPLIFICADO - SEM useUserPhotos para empresas)
function EmpresaAvatar({ fotoUrl, nome }: { fotoUrl?: string; nome: string }) {
  const [imgError, setImgError] = useState(false);
  
  if (fotoUrl && !imgError) {
    return (
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
        <img 
          src={fotoUrl} 
          alt={nome}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }
  
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
      {nome?.charAt(0).toUpperCase() || "E"}
    </div>
  );
}

export default function AdminEmpresasPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();

  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<Empresa[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // 🔥 FILTROS DE PERÍODO
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);
  
  // 🔥 OUTROS FILTROS
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🔥 MODAIS
  const [showPlanoModal, setShowPlanoModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [novoPlano, setNovoPlano] = useState("");
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [motivo, setMotivo] = useState("");
  const [historicoPlanos, setHistoricoPlanos] = useState<HistoricoPlano[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  
  const [stats, setStats] = useState({
    total: 0,
    ativas: 0,
    suspensas: 0,
    inativas: 0,
    total_colaboradores: 0,
    colaboradores_ativos: 0,
    receita_mensal_estimada: 0
  });

  // ============================================================
  // FUNÇÕES DE FILTRO DE PERÍODO
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
      const data = await apiCall({ url: "/api/admin/empresas", requireAuth: true });
      if (data && Array.isArray(data)) {
        setEmpresas(data);
        setFilteredEmpresas(data);
        
        // Extrair anos disponíveis
        const yearsSet = new Set<number>();
        data.forEach((e: any) => {
          if (e.data_cadastro) {
            yearsSet.add(new Date(e.data_cadastro).getFullYear());
          }
        });
        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);
        
        const ativas = data.filter((e: any) => e.status === "active");
        const suspensas = data.filter((e: any) => e.status === "suspended");
        const inativas = data.filter((e: any) => e.status === "inactive");
        const totalColaboradores = data.reduce((sum: number, e: any) => sum + (e.total_colaboradores || 0), 0);
        const colaboradoresAtivos = data.reduce((sum: number, e: any) => sum + (e.colaboradores_ativos || 0), 0);
        const receitaMensal = ativas.reduce((sum: number, e: any) => sum + (e.colaboradores_ativos * e.preco_por_colaborador), 0);
        
        setStats({
          total: data.length,
          ativas: ativas.length,
          suspensas: suspensas.length,
          inativas: inativas.length,
          total_colaboradores: totalColaboradores,
          colaboradores_ativos: colaboradoresAtivos,
          receita_mensal_estimada: receitaMensal
        });
        
        // 🔥 DADOS DO GRÁFICO (últimos 12 meses baseado na receita real)
        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const chartPoints: ChartDataPoint[] = [];
        
        for (let i = 0; i <= mesAtual; i++) {
          chartPoints.push({
            mes: mesesNomes[i],
            receita: receitaMensal * ((i + 1) / (mesAtual + 1))
          });
        }
        setChartData(chartPoints);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);
  
  useEffect(() => { loadData(); }, [loadData]);
  
  // ============================================================
  // APLICAR FILTROS
  // ============================================================
  
  useEffect(() => {
    let filtered = [...empresas];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        (e.nome?.toLowerCase().includes(term)) || 
        (e.razao_social?.toLowerCase().includes(term)) ||
        (e.cnpj?.includes(term)) ||
        (e.email?.toLowerCase().includes(term))
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    setFilteredEmpresas(filtered);
    setCurrentPage(1);
  }, [empresas, searchTerm, statusFilter]);
  
  // ============================================================
  // HANDLERS
  // ============================================================
  
  const loadHistoricoPlanos = async (empresaId: number) => {
    try {
      const data = await apiCall({ url: `/api/admin/empresas/${empresaId}/historico-planos`, requireAuth: true });
      setHistoricoPlanos(data || []);
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
      setHistoricoPlanos([]);
    }
  };
  
  const handleAlterarPlano = async () => {
    if (!selectedEmpresa || !novoPlano) {
      setUploadError("Selecione um plano");
      return;
    }
    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      await apiCall({
        url: `/api/admin/empresas/${selectedEmpresa.id}/alterar-plano`,
        method: "POST",
        body: { novo_plano: novoPlano, data_inicio: dataInicio, motivo: motivo || "Alteração de plano" },
        requireAuth: true
      });
      setUploadSuccess(`Plano alterado com sucesso!`);
      setTimeout(() => {
        setShowPlanoModal(false);
        resetPlanoForm();
        loadData();
      }, 1500);
    } catch (err: any) {
      setUploadError(err.message || "Erro ao alterar plano");
    } finally {
      setUploading(false);
    }
  };
  
  const handleAlterarStatus = async (empresa: Empresa, novoStatus: string) => {
    const confirmMsg = novoStatus === "active" ? "ativar" : novoStatus === "suspended" ? "suspender" : "inativar";
    if (!confirm(`Deseja ${confirmMsg} a empresa ${empresa.nome}?`)) return;
    try {
      await apiCall({
        url: `/api/admin/empresas/${empresa.id}/alterar-status`,
        method: "POST",
        body: { status: novoStatus },
        requireAuth: true
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Erro ao alterar status");
    }
  };
  
  const resetPlanoForm = () => {
    setSelectedEmpresa(null);
    setNovoPlano("");
    setDataInicio(new Date().toISOString().split('T')[0]);
    setMotivo("");
    setUploadError("");
    setUploadSuccess("");
    setHistoricoPlanos([]);
    setShowHistorico(false);
  };
  
  const abrirModalPlano = async (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setNovoPlano(empresa.plano_atual);
    await loadHistoricoPlanos(empresa.id);
    setShowPlanoModal(true);
  };
  
  const getPlanoLabel = (plano: string) => {
    if (!plano) return "Não definido";
    const map: Record<string, string> = {
      prata: "Prata",
      ouro: "Ouro",
      diamante: "Diamante"
    };
    return map[plano] || plano;
  };
  
  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSelectedMonths([new Date().getMonth()]);
    setSelectedYears([new Date().getFullYear()]);
    setCustomStartDate("");
    setCustomEndDate("");
    setUseCustomPeriod(false);
    setCurrentPage(1);
  };
  
  const totalPages = Math.ceil(filteredEmpresas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEmpresas = filteredEmpresas.slice(startIndex, startIndex + itemsPerPage);
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: CORES.rosa }} />
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
              <Building2 className="w-6 h-6" style={{ color: CORES.rosa }} />
              <h1 className="text-2xl font-bold text-gray-900">Gestão de Empresas</h1>
            </div>
            <p className="text-gray-600">Gerencie os planos, status e colaboradores das empresas clientes</p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" /> Limpar filtros
            </button>
          </div>
        </div>
      </div>
      
      {/* 📈 GRÁFICO */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Evolução da Receita Mensal</h3>
          </div>
        </div>
        
        {chartData.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-gray-400">
            <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-sm">Nenhum dado disponível para o período selecionado</p>
            <p className="text-xs mt-1">Os dados aparecerão aqui quando houver faturamento</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <ReLineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(value)} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="#2F80D3" strokeWidth={3} dot={{ fill: '#2F80D3', r: 5 }} name="Receita Mensal" />
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 🔥 PAINEL DE FILTROS DE PERÍODO */}
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
                        selectedYears.includes(year) ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                      selectedMonths.includes(month.value) ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Empresa</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, razão social, CNPJ ou email"
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
                style={{ focusRingColor: CORES.rosa }}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
              style={{ focusRingColor: CORES.rosa }}
            >
              <option value="all">Todos</option>
              <option value="active">Ativas</option>
              <option value="suspended">Suspensas</option>
              <option value="inactive">Inativas</option>
            </select>
          </div>
        </div>
        
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {!useCustomPeriod && selectedYears.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>}
          {!useCustomPeriod && selectedMonths.length > 0 && selectedMonths.length < 12 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>}
          {useCustomPeriod && customStartDate && customEndDate && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>}
          {statusFilter !== "all" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Status: {statusFilter === "active" ? "Ativas" : statusFilter === "suspended" ? "Suspensas" : "Inativas"}</span>}
          {searchTerm && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Busca: {searchTerm}</span>}
        </div>
      </div>
      
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.rosa }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Total Empresas</span>
            <Building2 className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-white/70 mt-1">{stats.ativas} ativas | {stats.suspensas} suspensas</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.verde }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Colaboradores</span>
            <Users className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{stats.colaboradores_ativos}</p>
          <p className="text-xs text-white/70 mt-1">de {stats.total_colaboradores} totais</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.azul }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Receita Mensal Estimada</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(stats.receita_mensal_estimada)}</p>
          <p className="text-xs text-white/70 mt-1">com planos ativos</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.amarelo }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Taxa de Ocupação</span>
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">
            {stats.total_colaboradores > 0 
              ? Math.round((stats.colaboradores_ativos / stats.total_colaboradores) * 100) 
              : 0}%
          </p>
          <p className="text-xs text-white/70 mt-1">colaboradores ativos</p>
        </div>
      </div>
      
      {/* Tabela de Empresas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Empresa</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Plano</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Colaboradores</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Receita</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEmpresas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              ) : (
                paginatedEmpresas.map((empresa) => {
                  const receitaMensal = (empresa.colaboradores_ativos || 0) * (empresa.preco_por_colaborador || 45);
                  return (
                    <tr key={empresa.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <EmpresaAvatar 
                            fotoUrl={empresa.foto_url} 
                            nome={empresa.nome || empresa.razao_social} 
                          />
                          <div>
                            <p className="font-medium text-gray-900">{empresa.nome || empresa.razao_social}</p>
                            <p className="text-xs text-gray-500">{empresa.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600">{empresa.cnpj || "-"}</td>
                      <td className="p-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          empresa.plano_atual === "diamante" ? "bg-purple-100 text-purple-700" :
                          empresa.plano_atual === "ouro" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {getPlanoLabel(empresa.plano_atual)}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatCurrency(empresa.preco_por_colaborador || 45)}/colaborador
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{empresa.colaboradores_ativos || 0}</p>
                          <p className="text-xs text-gray-400">de {empresa.total_colaboradores || 0}</p>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(receitaMensal)}</p>
                        <p className="text-xs text-gray-400">/mês</p>
                      </td>
                      <td className="p-3 text-center">
                        {getStatusBadge(empresa.status)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => abrirModalPlano(empresa)}
                            className="p-1.5 text-gray-400 transition-colors duration-200"
                            onMouseEnter={(e) => e.currentTarget.style.color = CORES.rosa}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                            title="Alterar plano"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {empresa.status === "active" && (
                            <button
                              onClick={() => handleAlterarStatus(empresa, "suspended")}
                              className="p-1.5 text-gray-400 transition-colors duration-200"
                              onMouseEnter={(e) => e.currentTarget.style.color = CORES.vermelho}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                              title="Suspender"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {empresa.status === "suspended" && (
                            <button
                              onClick={() => handleAlterarStatus(empresa, "active")}
                              className="p-1.5 text-gray-400 transition-colors duration-200"
                              onMouseEnter={(e) => e.currentTarget.style.color = CORES.verde}
                              onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                              title="Reativar"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
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
      
      {/* Modal de Alteração de Plano */}
      {showPlanoModal && selectedEmpresa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b text-white" style={{ background: `linear-gradient(135deg, ${CORES.rosa} 0%, ${CORES.rosa}80 100%)` }}>
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Alterar Plano</h3>
              </div>
              <button onClick={() => setShowPlanoModal(false)} className="p-1.5 hover:text-white/80 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Empresa: <span className="font-medium">{selectedEmpresa.nome || selectedEmpresa.razao_social}</span></p>
                <p className="text-sm text-gray-600">Plano atual: <span className="font-medium">{getPlanoLabel(selectedEmpresa.plano_atual)}</span></p>
                <p className="text-sm text-gray-600">Preço atual: <span className="font-medium">{formatCurrency(selectedEmpresa.preco_por_colaborador)}/colaborador</span></p>
                <p className="text-sm text-gray-600">Colaboradores ativos: <span className="font-medium">{selectedEmpresa.colaboradores_ativos}</span></p>
                <p className="text-sm text-gray-600">Receita atual: <span className="font-medium">{formatCurrency(selectedEmpresa.colaboradores_ativos * selectedEmpresa.preco_por_colaborador)}/mês</span></p>
              </div>
              
              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> {uploadSuccess}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Novo Plano *</label>
                <select
                  value={novoPlano}
                  onChange={(e) => setNovoPlano(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
                  style={{ focusRingColor: CORES.rosa }}
                >
                  <option value="">Selecione...</option>
                  <option value="prata">Prata (R$ 45/colaborador)</option>
                  <option value="ouro">Ouro (R$ 80/colaborador)</option>
                  <option value="diamante">Diamante (R$ 140/colaborador)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Início *</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
                  style={{ focusRingColor: CORES.rosa }}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Alteração</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
                  rows={2}
                  placeholder="Ex: Upgrade contratado, downgrade, renovação, etc."
                  style={{ focusRingColor: CORES.rosa }}
                />
              </div>
              
              <div className="border-t pt-3">
                <button
                  onClick={() => setShowHistorico(!showHistorico)}
                  className="text-sm hover:underline flex items-center gap-1 transition-colors"
                  style={{ color: CORES.rosa }}
                >
                  <Clock className="w-4 h-4" />
                  {showHistorico ? "Ocultar histórico" : "Ver histórico de planos"}
                </button>
                
                {showHistorico && (
                  <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                    {historicoPlanos.length === 0 ? (
                      <p className="text-xs text-gray-500">Nenhum histórico encontrado</p>
                    ) : (
                      historicoPlanos.map((h) => (
                        <div key={h.id} className="text-xs p-2 bg-gray-50 rounded">
                          <span className="font-medium">{h.plano_nome}</span>
                          <span className="text-gray-500"> de {formatDate(h.data_inicio)}</span>
                          {h.data_fim && <span className="text-gray-500"> até {formatDate(h.data_fim)}</span>}
                          {h.motivo && <p className="text-gray-400 mt-1">Motivo: {h.motivo}</p>}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowPlanoModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleAlterarPlano}
                disabled={uploading || !novoPlano}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
                style={{ backgroundColor: CORES.rosa }}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}