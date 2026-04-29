"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { CORES } from "@/lib/colors";
import { 
  Loader2,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  X,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  Building2,
  Users,
  Calendar,
  Search,
  Clock,
  Receipt,
  Download
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
// CONSTANTES
// ============================================================

const MONTHS = [
  { value: 0, label: "Janeiro" }, { value: 1, label: "Fevereiro" }, { value: 2, label: "Março" },
  { value: 3, label: "Abril" }, { value: 4, label: "Maio" }, { value: 5, label: "Junho" },
  { value: 6, label: "Julho" }, { value: 7, label: "Agosto" }, { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" }, { value: 10, label: "Novembro" }, { value: 11, label: "Dezembro" }
];

// ============================================================
// TIPOS
// ============================================================

interface EmpresaFaturamento {
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
  foto_url?: string;
}

interface FaturamentoPeriodo {
  empresa_id: number;
  empresa_nome: string;
  empresa_email: string;
  empresa_cnpj: string;
  colaboradores_ativos: number;
  valor_a_faturar: number;
  plano: string;
  plano_nome: string;
  preco_por_colaborador: number;
}

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

interface ResumoFaturamento {
  total_empresas: number;
  total_empresas_ativas: number;
  total_colaboradores: number;
  total_valor_a_faturar: number;
}

interface ChartDataPoint {
  mes: string;
  receita: number;
}

// ============================================================
// HELPERS
// ============================================================

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
// COMPONENTE DE AVATAR COM FOTO
// ============================================================

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

// ============================================================
// COMPONENTES DE MODAL (mantidos iguais)
// ============================================================

interface ModalUploadNFProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: EmpresaFaturamento | null;
  onSuccess: () => void;
}

function ModalUploadNF({ isOpen, onClose, empresa, onSuccess }: ModalUploadNFProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(formatDateInput(new Date()));
  const [referenceMonth, setReferenceMonth] = useState(formatDateInput(new Date()).substring(0, 7));
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  if (!isOpen || !empresa) return null;

  const handleUpload = async () => {
    if (!invoiceFile) { setUploadError("Selecione um arquivo PDF"); return; }
    if (!invoiceNumber.trim()) { setUploadError("Informe o número da nota fiscal"); return; }
    if (!referenceMonth) { setUploadError("Selecione o mês de referência"); return; }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", invoiceFile);
      formData.append("invoice_number", invoiceNumber);
      formData.append("invoice_date", invoiceDate);
      formData.append("reference_month", referenceMonth);
      formData.append("amount", invoiceAmount);
      formData.append("empresa_id", empresa.id.toString());

      const token = localStorage.getItem("access_token");
      const response = await fetch(`${BACKEND_URL}/api/admin/empresas/invoices/upload`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Erro ao enviar nota fiscal");
      }

      setUploadSuccess("Nota fiscal enviada com sucesso!");
      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 1500);
    } catch (error: any) {
      setUploadError(error.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setInvoiceNumber("");
    setInvoiceDate(formatDateInput(new Date()));
    setReferenceMonth(formatDateInput(new Date()).substring(0, 7));
    setInvoiceAmount("");
    setInvoiceFile(null);
    setUploadError("");
    setUploadSuccess("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b text-white" style={{ background: `linear-gradient(135deg, ${CORES.azul} 0%, ${CORES.azul}80 100%)` }}>
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Enviar Nota Fiscal</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:text-white/80 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Empresa: <span className="font-medium">{empresa.nome}</span></p>
            <p className="text-sm text-gray-600">Plano: <span className="font-medium">{empresa.plano_nome}</span></p>
            <p className="text-sm text-gray-600">Preço por colaborador: <span className="font-medium">{formatCurrency(empresa.preco_por_colaborador)}</span></p>
            <p className="text-sm text-gray-600">Colaboradores ativos: <span className="font-medium">{empresa.colaboradores_ativos}</span></p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Número da Nota Fiscal *</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ex: NF-2025-001"
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
              style={{ focusRingColor: CORES.azul }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data da Nota Fiscal *</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
              style={{ focusRingColor: CORES.azul }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mês de Referência *</label>
            <input
              type="month"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
              style={{ focusRingColor: CORES.azul }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Nota (R$)</label>
            <input
              type="number"
              step="0.01"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
              placeholder={`Sugerido: ${formatCurrency(empresa.colaboradores_ativos * empresa.preco_por_colaborador)}`}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
              style={{ focusRingColor: CORES.azul }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF *</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.type !== 'application/pdf') {
                      setUploadError("Apenas arquivos PDF são permitidos");
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setUploadError("O arquivo deve ter no máximo 5MB");
                      return;
                    }
                    setUploadError("");
                    setInvoiceFile(file);
                  }
                }}
                className="hidden"
                id="invoice-file-upload"
              />
              <label htmlFor="invoice-file-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">{invoiceFile ? invoiceFile.name : "Clique para selecionar o PDF"}</p>
                <p className="text-xs text-gray-400 mt-1">PDF até 5MB</p>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2 transition-colors"
            style={{ backgroundColor: CORES.azul }}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModalListaNFProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: EmpresaFaturamento | null;
  invoices: Invoice[];
  onVisualizar: (invoice: Invoice) => void;
}

function ModalListaNF({ isOpen, onClose, empresa, invoices, onVisualizar }: ModalListaNFProps) {
  if (!isOpen || !empresa) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b text-white" style={{ background: `linear-gradient(135deg, ${CORES.verde} 0%, ${CORES.verde}80 100%)` }}>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Notas Fiscais - {empresa.nome}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:text-white/80 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhuma nota fiscal enviada para esta empresa</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="font-medium text-gray-900">{inv.invoice_number}</span>
                      {getStatusInvoiceBadge(inv.status)}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div><span className="text-gray-500">Mês Ref.:</span> <span className="ml-1">{inv.reference_month}</span></div>
                      <div><span className="text-gray-500">Valor:</span> <span className="ml-1 font-medium text-green-600">{formatCurrency(inv.total_amount)}</span></div>
                      <div><span className="text-gray-500">Vencimento:</span> <span className="ml-1">{formatDate(inv.due_date)}</span></div>
                      <div><span className="text-gray-500">Envio:</span> <span className="ml-1">{formatDate(inv.created_at)}</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => onVisualizar(inv)}
                    className="p-2 text-gray-400 transition-colors"
                    onMouseEnter={(e) => e.currentTarget.style.color = CORES.azul}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                    title="Visualizar PDF"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

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

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function AdminEmpresasFaturamentoPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();

  // 🔥 ESTADOS
  const [loading, setLoading] = useState(true);
  const [empresas, setEmpresas] = useState<EmpresaFaturamento[]>([]);
  const [filteredEmpresas, setFilteredEmpresas] = useState<EmpresaFaturamento[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [resumo, setResumo] = useState<ResumoFaturamento>({
    total_empresas: 0,
    total_empresas_ativas: 0,
    total_colaboradores: 0,
    total_valor_a_faturar: 0
  });

  // 🔥 FILTROS DE PERÍODO
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [useCustomPeriod, setUseCustomPeriod] = useState(false);

  // 🔥 OUTROS FILTROS
  const [searchTerm, setSearchTerm] = useState("");
  const [planoFilter, setPlanoFilter] = useState<string>("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 🔥 MODAIS
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showListaModal, setShowListaModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaFaturamento | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [empresaInvoices, setEmpresaInvoices] = useState<Invoice[]>([]);

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
  // CARREGAR EMPRESAS
  // ============================================================

  const loadEmpresas = useCallback(async () => {
    try {
      const data = await apiCall({ url: "/api/admin/empresas", requireAuth: true });
      if (data && Array.isArray(data)) {
        const empresasComDados = data.map((emp: any) => ({
          id: emp.id,
          user_id: emp.user_id,
          nome: emp.nome,
          razao_social: emp.razao_social,
          cnpj: emp.cnpj,
          email: emp.email,
          telefone: emp.telefone,
          plano_atual: emp.plano_atual,
          plano_nome: emp.plano_nome,
          preco_por_colaborador: emp.preco_por_colaborador || 45,
          sessoes_inclusas: emp.sessoes_inclusas || 1,
          status: emp.status,
          total_colaboradores: emp.total_colaboradores,
          colaboradores_ativos: emp.colaboradores_ativos,
          foto_url: emp.foto_url,
          data_cadastro: emp.data_cadastro
        }));
        setEmpresas(empresasComDados);
        setFilteredEmpresas(empresasComDados);

        // Extrair anos disponíveis
        const yearsSet = new Set<number>();
        empresasComDados.forEach((e: any) => {
          if (e.data_cadastro) {
            yearsSet.add(new Date(e.data_cadastro).getFullYear());
          }
        });
        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);

        // Calcular resumo
        const ativas = empresasComDados.filter((e: any) => e.status === "active" && e.colaboradores_ativos > 0);
        const totalColaboradores = empresasComDados.reduce((sum: number, e: any) => sum + (e.colaboradores_ativos || 0), 0);
        const totalValor = ativas.reduce((sum: number, e: any) => sum + (e.colaboradores_ativos * e.preco_por_colaborador), 0);

        setResumo({
          total_empresas: empresasComDados.length,
          total_empresas_ativas: ativas.length,
          total_colaboradores: totalColaboradores,
          total_valor_a_faturar: totalValor
        });

        // Dados para o gráfico (últimos 12 meses)
        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const chartPoints: ChartDataPoint[] = [];
        
        for (let i = 0; i <= mesAtual; i++) {
          chartPoints.push({
            mes: mesesNomes[i],
            receita: totalValor * ((i + 1) / (mesAtual + 1))
          });
        }
        setChartData(chartPoints);
      }
    } catch (error) {
      console.error("❌ Erro ao carregar empresas:", error);
    }
  }, [apiCall]);

  // ============================================================
  // APLICAR FILTROS
  // ============================================================

  useEffect(() => {
    let filtered = [...empresas];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.nome.toLowerCase().includes(term) ||
        e.razao_social?.toLowerCase().includes(term) ||
        e.cnpj?.includes(term) ||
        e.email?.toLowerCase().includes(term)
      );
    }

    if (planoFilter !== "todos") {
      filtered = filtered.filter(e => e.plano_atual === planoFilter);
    }

    setFilteredEmpresas(filtered);
    setCurrentPage(1);
  }, [empresas, searchTerm, planoFilter]);

  const loadEmpresaInvoices = async (empresaId: number) => {
    try {
      const data = await apiCall({ url: `/api/admin/empresas/${empresaId}/invoices`, requireAuth: true });
      setEmpresaInvoices(data || []);
    } catch (err) {
      console.error("Erro ao carregar notas fiscais:", err);
      setEmpresaInvoices([]);
    }
  };

  const loadAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    await loadEmpresas();
    setLoading(false);
  }, [user?.id, loadEmpresas]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const abrirModalUpload = (empresa: EmpresaFaturamento) => {
    setSelectedEmpresa(empresa);
    setShowUploadModal(true);
  };

  const abrirModalLista = async (empresa: EmpresaFaturamento) => {
    setSelectedEmpresa(empresa);
    await loadEmpresaInvoices(empresa.id);
    setShowListaModal(true);
  };

  const abrirModalPdf = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPdfModal(true);
  };

  const handleUploadSuccess = () => {
    if (selectedEmpresa) {
      loadEmpresaInvoices(selectedEmpresa.id);
    }
  };

  const exportToCSV = () => {
    const headers = ["Empresa", "CNPJ", "Plano", "Colaboradores Ativos", "Valor a Faturar"];
    const rows = filteredEmpresas.map(e => [
      e.nome,
      e.cnpj || "-",
      e.plano_nome,
      e.colaboradores_ativos,
      formatCurrency(e.colaboradores_ativos * e.preco_por_colaborador)
    ]);
    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "faturamento_empresas.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setPlanoFilter("todos");
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
              <Receipt className="w-6 h-6" style={{ color: CORES.rosa }} />
              <h1 className="text-2xl font-bold text-gray-900">Faturamento Empresarial</h1>
            </div>
            <p className="text-gray-600">
              Envie notas fiscais e acompanhe o faturamento das empresas
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={resetFilters} className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4" /> Limpar filtros
            </button>
            <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors" style={{ backgroundColor: CORES.verde }}>
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
            <h3 className="font-semibold text-gray-900">Evolução do Faturamento</h3>
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
              <Line type="monotone" dataKey="receita" stroke="#2F80D3" strokeWidth={3} dot={{ fill: '#2F80D3', r: 5 }} name="Faturamento" />
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Empresa</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome, CNPJ ou email"
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
                style={{ focusRingColor: CORES.rosa }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
            <select
              value={planoFilter}
              onChange={(e) => setPlanoFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 outline-none"
              style={{ focusRingColor: CORES.rosa }}
            >
              <option value="todos">Todos os planos</option>
              {[...new Set(empresas.map(e => e.plano_atual))].filter(Boolean).map(plano => (
                <option key={plano} value={plano}>
                  {empresas.find(e => e.plano_atual === plano)?.plano_nome || plano}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(searchTerm || planoFilter !== "todos" || !useCustomPeriod && (selectedYears.length > 0 || selectedMonths.length > 0)) && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Filtros ativos:</span>
            {!useCustomPeriod && selectedYears.length > 0 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedYears.length} ano(s)</span>}
            {!useCustomPeriod && selectedMonths.length > 0 && selectedMonths.length < 12 && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{selectedMonths.length} mês(es)</span>}
            {useCustomPeriod && customStartDate && customEndDate && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{customStartDate} a {customEndDate}</span>}
            {planoFilter !== "todos" && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Plano: {empresas.find(e => e.plano_atual === planoFilter)?.plano_nome || planoFilter}</span>}
            {searchTerm && <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">Busca: {searchTerm}</span>}
          </div>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.rosa }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Empresas Ativas</span>
            <Building2 className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.total_empresas_ativas}</p>
          <p className="text-xs text-white/70 mt-1">de {resumo.total_empresas} totais</p>
        </div>

        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.azul }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Colaboradores</span>
            <Users className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{resumo.total_colaboradores}</p>
          <p className="text-xs text-white/70 mt-1">ativos no período</p>
        </div>

        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.verde }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Total a Faturar</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(resumo.total_valor_a_faturar)}</p>
          <p className="text-xs text-white/70 mt-1">no período selecionado</p>
        </div>

        <div className="rounded-xl shadow-sm p-5 text-white" style={{ backgroundColor: CORES.amarelo }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Ticket Médio</span>
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">
            {resumo.total_empresas_ativas > 0 
              ? formatCurrency(resumo.total_valor_a_faturar / resumo.total_empresas_ativas)
              : formatCurrency(0)}
          </p>
          <p className="text-xs text-white/70 mt-1">por empresa ativa</p>
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
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor a Faturar</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedEmpresas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nenhuma empresa encontrada
                  </td>
                </tr>
              ) : (
                paginatedEmpresas.map((empresa) => {
                  const valorAFaturar = empresa.colaboradores_ativos * empresa.preco_por_colaborador;
                  return (
                    <tr key={empresa.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <EmpresaAvatar
                            fotoUrl={empresa.foto_url}
                            nome={empresa.nome}
                          />
                          <div>
                            <p className="font-medium text-gray-900">{empresa.nome}</p>
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
                          {empresa.plano_nome}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatCurrency(empresa.preco_por_colaborador)}/colaborador
                        </p>
                      </td>
                      <td className="p-3 text-center">
                        <p className="text-sm font-semibold text-gray-900">{empresa.colaboradores_ativos}</p>
                        <p className="text-xs text-gray-400">de {empresa.total_colaboradores}</p>
                      </td>
                      <td className="p-3 text-right">
                        <p className="text-sm font-bold text-green-600">{formatCurrency(valorAFaturar)}</p>
                        <p className="text-xs text-gray-400">/mês</p>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => abrirModalUpload(empresa)}
                            className="p-1.5 text-gray-400 transition-colors duration-200"
                            onMouseEnter={(e) => e.currentTarget.style.color = CORES.azul}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                            title="Enviar nota fiscal"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => abrirModalLista(empresa)}
                            className="p-1.5 text-gray-400 transition-colors duration-200"
                            onMouseEnter={(e) => e.currentTarget.style.color = CORES.verde}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#9CA3AF'}
                            title="Ver notas fiscais"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
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

      {/* Modais */}
      <ModalUploadNF
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        empresa={selectedEmpresa}
        onSuccess={handleUploadSuccess}
      />

      <ModalListaNF
        isOpen={showListaModal}
        onClose={() => setShowListaModal(false)}
        empresa={selectedEmpresa}
        invoices={empresaInvoices}
        onVisualizar={abrirModalPdf}
      />

      <ModalVisualizarPDF
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        invoice={selectedInvoice}
      />
    </div>
  );
}