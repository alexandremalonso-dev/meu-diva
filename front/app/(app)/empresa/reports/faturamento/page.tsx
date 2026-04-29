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
  Building2,
  Users,
  Receipt,
  FileText,
  Upload,
  Eye,
  AlertCircle,
  Clock,
  History
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
interface Invoice {
  id: number;
  empresa_id: number;
  empresa_nome: string;
  invoice_number: string;
  reference_month: string;
  total_amount: number;
  status: "pending" | "invoiced" | "paid";
  invoice_url: string;
  filename: string;
  due_date: string;
  paid_at?: string;
  created_at: string;
}

interface EmpresaCobranca {
  id: number;
  user_id: number;
  nome: string;
  razao_social: string;
  cnpj: string;
  email: string;
  foto_url?: string;
  plano: string;
  plano_nome: string;
  preco_por_colaborador: number;
  colaboradores_ativos: number;
  sessoes_realizadas_periodo: number;
  sessoes_disponiveis_periodo: number;
  valor_a_faturar: number;
  status: "active" | "inactive" | "suspended";
}

interface ResumoCobranca {
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("pt-BR");
};

const getStatusInvoiceBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Paga</span>;
    case "invoiced":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><FileText className="w-3 h-3" /> Faturada</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3" /> Pendente</span>;
  }
};

function getFileUrl(url: string) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

// ============================================================
// MODAL DE VISUALIZAÇÃO DE PDF
// ============================================================

interface ModalVisualizarPDFProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

function ModalVisualizarPDF({ isOpen, onClose, invoice }: ModalVisualizarPDFProps) {
  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b text-white" style={{ background: `linear-gradient(135deg, ${CORES.azul} 0%, ${CORES.azul}80 100%)` }}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Nota Fiscal - {invoice.invoice_number}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:text-white/80 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Empresa:</span> <p className="font-medium">{invoice.empresa_nome}</p></div>
              <div><span className="text-gray-500">Mês Referência:</span> <p className="font-medium">{invoice.reference_month}</p></div>
              <div><span className="text-gray-500">Valor:</span> <p className="font-medium text-green-600">{formatCurrency(invoice.total_amount)}</p></div>
              <div><span className="text-gray-500">Status:</span> <p>{getStatusInvoiceBadge(invoice.status)}</p></div>
            </div>
          </div>
          <iframe 
            src={getFileUrl(invoice.invoice_url)} 
            className="w-full h-[60vh] border rounded-lg"
            title={`Nota Fiscal ${invoice.invoice_number}`}
          />
        </div>
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          {invoice.invoice_url && (
            <a
              href={getFileUrl(invoice.invoice_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm text-white rounded-lg transition-colors"
              style={{ backgroundColor: CORES.azul }}
            >
              Abrir em nova janela
            </a>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmpresaCobrancaPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  
  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<EmpresaCobranca | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [resumo, setResumo] = useState<ResumoCobranca>({
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
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  // 🔥 MODAIS
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // 🔥 CARREGAR DADOS
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 [EMPRESA] Carregando relatório de cobrança...");

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
      
      const data = await apiCall({ url, requireAuth: true });
      
      if (data && data.colaboradores && data.colaboradores.length > 0) {
        const empresaData = data.colaboradores[0];
        
        setEmpresa({
          id: empresaData.id,
          user_id: empresaData.user_id,
          nome: empresaData.nome,
          razao_social: empresaData.razao_social || "",
          cnpj: empresaData.cnpj || "",
          email: empresaData.email,
          foto_url: empresaData.foto_url,
          plano: empresaData.plano,
          plano_nome: empresaData.plano_nome,
          preco_por_colaborador: empresaData.valor_plano_mensal,
          colaboradores_ativos: data.resumo?.total_colaboradores_ativos || 0,
          sessoes_realizadas_periodo: data.resumo?.total_sessoes_realizadas || 0,
          sessoes_disponiveis_periodo: data.resumo?.total_sessoes_disponiveis || 0,
          valor_a_faturar: data.resumo?.total_a_faturar || 0,
          status: "active"
        });
        
        setResumo({
          total_colaboradores: data.resumo?.total_colaboradores || 0,
          total_colaboradores_ativos: data.resumo?.total_colaboradores_ativos || 0,
          total_sessoes_realizadas: data.resumo?.total_sessoes_realizadas || 0,
          total_sessoes_disponiveis: data.resumo?.total_sessoes_disponiveis || 0,
          taxa_utilizacao: data.resumo?.taxa_utilizacao || 0,
          receita_mensal_estimada: data.resumo?.receita_mensal_estimada || 0,
          total_a_faturar: data.resumo?.total_a_faturar || 0,
          total_faturado: 0,
          total_pago: 0
        });
        
        setChartData(data.chart_data || []);
        
        const yearsSet = new Set<number>();
        if (data.chart_data) {
          yearsSet.add(new Date().getFullYear());
        }
        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);
      }
      
      const invoicesData = await apiCall({ 
        url: "/api/empresa/reports/cobranca/invoices", 
        requireAuth: true 
      }).catch(() => []);
      
      if (Array.isArray(invoicesData)) {
        setInvoices(invoicesData);
        
        const totalFaturado = invoicesData.reduce((sum, inv) => sum + inv.total_amount, 0);
        const totalPago = invoicesData.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + inv.total_amount, 0);
        
        setResumo(prev => ({
          ...prev,
          total_faturado: totalFaturado,
          total_pago: totalPago
        }));
      }
      
      console.log("✅ Dados carregados com sucesso");
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall, useCustomPeriod, customStartDate, customEndDate, selectedMonths, selectedYears]);
  
  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [loadData, user?.id]);
  
  const abrirModalPdf = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPdfModal(true);
  };
  
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }
  
  // 🔥 PROCESSAR DADOS DA TABELA DE FATURAMENTO POR MÊS
  const processarDadosMensais = () => {
    const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    
    // Criar array de meses de 1 a 12
    const mesesOrdenados = [];
    for (let i = 0; i <= mesAtual; i++) {
      mesesOrdenados.push({
        mes: mesesNomes[i],
        mesNumero: i + 1
      });
    }
    
    return mesesOrdenados.map((item, idx) => {
      const chartItem = chartData.find(c => c.mes === item.mes);
      const invoiceForMonth = invoices.find(inv => inv.reference_month.includes(item.mes));
      
      return {
        mes: item.mes,
        mesNumero: item.mesNumero,
        receita: chartItem?.receita || 0,
        colaboradores: Math.round(resumo.total_colaboradores_ativos * (0.3 + idx * 0.06)),
        sessoes: Math.round(resumo.total_sessoes_realizadas * (0.3 + idx * 0.06)),
        invoice: invoiceForMonth
      };
    });
  };
  
  const dadosMensaisProcessados = processarDadosMensais();
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-6 h-6 text-[#E03673]" />
              <h1 className="text-2xl font-bold text-gray-900">Cobrança e Notas Fiscais</h1>
            </div>
            <p className="text-gray-600 mt-1">
              Acompanhe seu faturamento e visualize as notas fiscais emitidas
            </p>
          </div>
        </div>
      </div>
      
      {/* 📈 GRÁFICO - ALTERADO PARA "FATURAMENTO" */}
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
                stroke="#E03673" 
                strokeWidth={3} 
                dot={{ fill: '#E03673', r: 5 }} 
                name="Faturamento Mensal" 
              />
              <ReferenceLine y={0} stroke="#ccc" />
            </ReLineChart>
          </ResponsiveContainer>
        )}
      </div>
      
      {/* 🔥 PAINEL DE FILTROS DE PERÍODO */}
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
                    <button onClick={() => setSelectedYears([...availableYears])} className="text-xs text-[#E03673] hover:underline">Selecionar todos</button>
                    <button onClick={() => setSelectedYears([])} className="text-xs text-gray-500 hover:underline">Limpar</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableYears.map((year) => (
                    <button key={year} onClick={() => setSelectedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year])} className={`px-4 py-2 text-sm rounded-lg transition-colors ${selectedYears.includes(year) ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
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
                  <button onClick={() => setSelectedMonths(MONTHS.map(m => m.value))} className="text-xs text-[#E03673] hover:underline">Selecionar todos</button>
                  <button onClick={() => setSelectedMonths([])} className="text-xs text-gray-500 hover:underline">Limpar</button>
                </div>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
                {MONTHS.map((month) => (
                  <button key={month.value} onClick={() => setSelectedMonths(prev => prev.includes(month.value) ? prev.filter(m => m !== month.value) : [...prev, month.value])} className={`p-2 text-sm rounded-lg transition-colors ${selectedMonths.includes(month.value) ? 'bg-[#E03673] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                    {month.label.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* 📊 CARDS DE RESUMO - CORES SÓLIDAS COM TEXTO BRANCO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.rosa }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Colaboradores Ativos</span>
            <Users className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.total_colaboradores_ativos}</p>
          <p className="text-xs text-white/70 mt-1">de {resumo.total_colaboradores} totais</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.verde }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Sessões Realizadas</span>
            <Calendar className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.total_sessoes_realizadas}</p>
          <p className="text-xs text-white/70 mt-1">de {resumo.total_sessoes_disponiveis} disponíveis</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.azul }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Taxa de Utilização</span>
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.taxa_utilizacao}%</p>
          <p className="text-xs text-white/70 mt-1">das sessões contratadas</p>
        </div>
        
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.laranja }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Valor a Faturar</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(resumo.total_a_faturar)}</p>
          <p className="text-xs text-white/70 mt-1">do período selecionado</p>
        </div>
      </div>
      
      {/* 📋 TABELA DE FATURAMENTO POR MÊS - ORDENADO 1-12, APENAS MESES PASSADOS/VIGENTE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Faturamento por Mês</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Mês</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Colaboradores</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Status NF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dadosMensaisProcessados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhum dado disponível
                  </td>
                </tr>
              ) : (
                dadosMensaisProcessados.map((item) => (
                  <tr key={item.mesNumero} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-sm font-medium text-gray-900">{item.mes}</td>
                    <td className="p-3 text-center text-sm text-gray-600">{item.colaboradores}</td>
                    <td className="p-3 text-center text-sm text-gray-600">{item.sessoes}</td>
                    <td className="p-3 text-right text-sm font-semibold text-green-600">{formatCurrency(item.receita)}</td>
                    <td className="p-3 text-center">
                      {item.invoice ? (
                        <button
                          onClick={() => abrirModalPdf(item.invoice!)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> Ver NF
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Aguardando NF</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 📋 HISTÓRICO DE NOTAS FISCAIS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <History className="w-5 h-5 text-[#E03673]" />
          <h3 className="font-semibold text-gray-900">Histórico de Notas Fiscais</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Nº Nota Fiscal</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Mês Referência</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Data Emissão</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Nenhuma nota fiscal emitida ainda</p>
                    <p className="text-xs mt-1">As notas fiscais aparecerão aqui quando forem emitidas pelo administrador</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-sm font-medium text-gray-900">{inv.invoice_number}</td>
                    <td className="p-3 text-sm text-gray-600">{inv.reference_month}</td>
                    <td className="p-3 text-right text-sm font-semibold text-green-600">{formatCurrency(inv.total_amount)}</td>
                    <td className="p-3">{getStatusInvoiceBadge(inv.status)}</td>
                    <td className="p-3 text-sm text-gray-600">{formatDate(inv.created_at)}</td>
                    <td className="p-3 text-sm text-gray-600">{formatDate(inv.due_date)}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => abrirModalPdf(inv)}
                        className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors"
                        title="Visualizar PDF"
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
      </div>
      
      {/* MODAL DE VISUALIZAÇÃO DE PDF */}
      <ModalVisualizarPDF
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        invoice={selectedInvoice}
      />
    </div>
  );
}