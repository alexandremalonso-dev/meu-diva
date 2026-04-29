"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Loader2,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  X,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 🔥 TIPO CORRETO: Período mensal com base em sessões realizadas
interface MonthlyPeriod {
  year: number;
  month: number;
  monthLabel: string;
  total_net_amount: number;
  sessions_count: number;
  invoice?: {
    id: number;
    invoice_number: string;
    invoice_url: string;
    status: 'pending' | 'approved' | 'rejected';
    admin_notes?: string;
    uploaded_at?: string;
  };
}

// 🔥 OPÇÕES DE FILTRO
const MONTHS = [
  { value: 0, label: "Janeiro" }, { value: 1, label: "Fevereiro" }, { value: 2, label: "Março" },
  { value: 3, label: "Abril" }, { value: 4, label: "Maio" }, { value: 5, label: "Junho" },
  { value: 6, label: "Julho" }, { value: 7, label: "Agosto" }, { value: 8, label: "Setembro" },
  { value: 9, label: "Outubro" }, { value: 10, label: "Novembro" }, { value: 11, label: "Dezembro" }
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonthYear(year: number, month: number): string {
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  return `${monthNames[month]} ${year}`;
}

function getFileUrl(url: string) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BACKEND_URL}${url}`;
}

export default function TherapistInvoicesPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();

  const [loading, setLoading] = useState(true);
  const [monthlyPeriods, setMonthlyPeriods] = useState<MonthlyPeriod[]>([]);
  const [filteredPeriods, setFilteredPeriods] = useState<MonthlyPeriod[]>([]);
  
  // 🔥 FILTROS
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]);
  const [selectedYears, setSelectedYears] = useState<number[]>([new Date().getFullYear()]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  
  // Modal de envio
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<MonthlyPeriod | null>(null);
  
  // Dados do formulário
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  // Modal de visualização
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    invoice_number: string;
    invoice_url: string;
    amount: number;
    status: string;
    admin_notes?: string;
    period: string;
  } | null>(null);

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

  // 🔥 FUNÇÃO PRINCIPAL: Buscar sessões e calcular valores por mês
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log("📥 Carregando sessões para calcular valores por mês...");
      
      // 1. Buscar appointments do terapeuta
      const appointmentsData = await apiCall({ 
        url: "/api/appointments/me/details", 
        requireAuth: true 
      });
      
      // 2. Buscar comissões (para ter net_amount)
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
        console.log("⚠️ Nenhuma comissão encontrada - usando valores brutos");
      }
      
      // 3. Buscar invoices já enviadas (para saber status)
      let existingInvoicesMap = new Map<string, any>();
      try {
        const invoicesData = await apiCall({
          url: "/api/therapist/invoices",
          requireAuth: true
        }).catch(() => ({}));
        
        const invoices = invoicesData.invoices || [];
        invoices.forEach((inv: any) => {
          const key = `${inv.year}-${inv.month}`;
          existingInvoicesMap.set(key, inv);
        });
      } catch (err) {
        console.log("⚠️ Nenhuma nota fiscal encontrada");
      }
      
      // 4. Filtrar apenas sessões realizadas
      // REGRA DE NEGÓCIO: Sessão é considerada realizada se:
      // - status === "completed" OU
      // - status === "confirmed" E tem prontuário registrado E não foi marcada como "não ocorreu"
      const therapistAppointments = appointmentsData.filter((apt: any) => apt.therapist_user_id === user?.id);
      
      // 5. Agrupar por mês/ano
      const monthlyMap = new Map<string, { net_amount: number; sessions_count: number }>();
      
      for (const apt of therapistAppointments) {
        const sessionDate = new Date(apt.starts_at);
        const year = sessionDate.getFullYear();
        const month = sessionDate.getMonth();
        const key = `${year}-${month}`;
        
        // Verificar se a sessão foi realizada (conforme regra de negócio)
        let hasMedicalRecord = false;
        let sessionNotOccurred = false;
        
        try {
          const record = await apiCall({
            url: `/api/appointments/${apt.id}/medical-record`,
            requireAuth: true
          });
          if (record && record.id) {
            hasMedicalRecord = true;
            sessionNotOccurred = record.session_not_occurred || false;
          }
        } catch (err) {
          // Sem prontuário - sessão não é considerada realizada
        }
        
        // 🔥 REGRA DE NEGÓCIO CORRETA:
        // Sessão é realizada se (status completed) OU (status confirmed E tem prontuário E não ocorreu não foi marcado)
        const isCompleted = apt.status === "completed" || (apt.status === "confirmed" && hasMedicalRecord && !sessionNotOccurred);
        
        // Só contar sessões realizadas
        if (isCompleted) {
          const netAmount = netAmountMap.get(apt.id) ?? (apt.session_price || 0);
          
          if (!monthlyMap.has(key)) {
            monthlyMap.set(key, { net_amount: 0, sessions_count: 0 });
          }
          const data = monthlyMap.get(key)!;
          data.net_amount += netAmount;
          data.sessions_count += 1;
        }
      }
      
      // 6. Converter para array e adicionar dados das invoices
      const periods: MonthlyPeriod[] = [];
      const yearsSet = new Set<number>();
      
      for (const [key, data] of monthlyMap.entries()) {
        const [yearStr, monthStr] = key.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        yearsSet.add(year);
        
        const existingInvoice = existingInvoicesMap.get(key);
        
        periods.push({
          year,
          month,
          monthLabel: formatMonthYear(year, month),
          total_net_amount: data.net_amount,
          sessions_count: data.sessions_count,
          invoice: existingInvoice ? {
            id: existingInvoice.id,
            invoice_number: existingInvoice.invoice_number,
            invoice_url: existingInvoice.invoice_url,
            status: existingInvoice.status,
            admin_notes: existingInvoice.admin_notes,
            uploaded_at: existingInvoice.created_at
          } : undefined
        });
      }
      
      // Ordenar por ano e mês decrescente (mais recente primeiro)
      periods.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
      
      setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a));
      setMonthlyPeriods(periods);
      
      // Inicializar filtros com o ano mais recente
      if (yearsSet.size > 0 && selectedYears.length === 0) {
        setSelectedYears([Math.max(...yearsSet)]);
      }
      
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall]);

  useEffect(() => { loadData(); }, [loadData]);

  // 🔥 APLICAR FILTROS
  useEffect(() => {
    let filtered = [...monthlyPeriods];
    
    // Filtro por mês/ano
    if (selectedMonths.length > 0 && selectedYears.length > 0) {
      filtered = filtered.filter(period => 
        selectedMonths.includes(period.month) && selectedYears.includes(period.year)
      );
    }
    
    // Filtro por status
    if (statusFilter !== "all") {
      filtered = filtered.filter(period => {
        if (statusFilter === "pending") return !period.invoice || period.invoice.status === "pending";
        if (statusFilter === "approved") return period.invoice?.status === "approved";
        if (statusFilter === "rejected") return period.invoice?.status === "rejected";
        if (statusFilter === "not_sent") return !period.invoice;
        return true;
      });
    }
    
    setFilteredPeriods(filtered);
    setCurrentPage(1);
  }, [monthlyPeriods, selectedMonths, selectedYears, statusFilter]);

  // 🔥 UPLOAD DA NOTA FISCAL
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const handleUpload = async () => {
    if (!invoiceFile) {
      setUploadError("Selecione um arquivo PDF");
      return;
    }
    if (!invoiceNumber.trim()) {
      setUploadError("Informe o número da nota fiscal");
      return;
    }
    if (!selectedPeriod) return;

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", invoiceFile);
      formData.append("invoice_number", invoiceNumber);
      formData.append("invoice_date", invoiceDate);
      formData.append("year", selectedPeriod.year.toString());
      formData.append("month", selectedPeriod.month.toString());
      formData.append("amount", selectedPeriod.total_net_amount.toString());

      const token = localStorage.getItem("access_token");
      const response = await fetch(`${BACKEND_URL}/api/therapist/invoices/upload`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Erro ao enviar nota fiscal");
      }

      setUploadSuccess("Nota fiscal enviada com sucesso!");
      setTimeout(() => {
        setShowUploadModal(false);
        resetForm();
        loadData();
      }, 2000);
      
    } catch (error: any) {
      setUploadError(error.message || "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setInvoiceNumber("");
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceFile(null);
    setSelectedPeriod(null);
    setUploadError("");
    setUploadSuccess("");
  };

  const getStatusBadge = (status?: string) => {
    if (!status) {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Não enviada</span>;
    }
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> Aprovada</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> Rejeitada</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3" /> Pendente</span>;
    }
  };

  const resetFilters = () => {
    if (availableYears.length > 0) {
      setSelectedYears([availableYears[0]]);
    }
    setSelectedMonths([new Date().getMonth()]);
    setStatusFilter("all");
    setCurrentPage(1);
  };

  // 🔥 RESUMO (cards)
  const summary = {
    total_pending_amount: filteredPeriods
      .filter(p => !p.invoice || p.invoice.status === "pending")
      .reduce((sum, p) => sum + p.total_net_amount, 0),
    total_approved_amount: filteredPeriods
      .filter(p => p.invoice?.status === "approved")
      .reduce((sum, p) => sum + p.total_net_amount, 0),
    pending_count: filteredPeriods.filter(p => !p.invoice || p.invoice.status === "pending").length,
    approved_count: filteredPeriods.filter(p => p.invoice?.status === "approved").length,
    total_sessions: filteredPeriods.reduce((sum, p) => sum + p.sessions_count, 0),
    average_ticket: filteredPeriods.length > 0 
      ? filteredPeriods.reduce((sum, p) => sum + p.total_net_amount, 0) / filteredPeriods.length 
      : 0
  };

  // Paginação
  const totalPages = Math.ceil(filteredPeriods.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPeriods = filteredPeriods.slice(startIndex, startIndex + itemsPerPage);

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
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#E03673]" />
              <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
            </div>
            <p className="text-gray-600 mt-1">
              Envie suas notas fiscais para receber os pagamentos das sessões realizadas
            </p>
          </div>
        </div>
      </div>

      {/* 📊 CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Aguardando NF</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.total_pending_amount)}</p>
          <p className="text-xs text-white/70 mt-1">{summary.pending_count} períodos pendentes</p>
        </div>

        <div className="bg-gradient-to-r from-[#10B981] to-[#10B981]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Já Aprovado</span>
            <CheckCircle className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.total_approved_amount)}</p>
          <p className="text-xs text-white/70 mt-1">{summary.approved_count} notas aprovadas</p>
        </div>

        <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Sessões Realizadas</span>
            <Calendar className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{summary.total_sessions}</p>
          <p className="text-xs text-white/70 mt-1">no período selecionado</p>
        </div>

        <div className="bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Ticket Médio Mensal</span>
            <TrendingUp className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.average_ticket)}</p>
          <p className="text-xs text-white/70 mt-1">por período</p>
        </div>
      </div>

      {/* 🔥 PAINEL DE FILTROS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#E03673]" />
            Filtros
          </h3>
          <button onClick={resetFilters} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        </div>

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

        <div className="pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status da Nota</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="all">Todos os status</option>
              <option value="not_sent">Não enviada</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Rejeitada</option>
            </select>
          </div>
        </div>

        {/* Indicador de filtros ativos */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500">Filtros ativos:</span>
          {selectedYears.length > 0 && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              {selectedYears.length} ano(s)
            </span>
          )}
          {selectedMonths.length > 0 && selectedMonths.length < 12 && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              {selectedMonths.length} mês(es)
            </span>
          )}
          {statusFilter !== "all" && (
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
              Status: {statusFilter === "not_sent" ? "Não enviada" : statusFilter === "pending" ? "Pendente" : statusFilter === "approved" ? "Aprovada" : "Rejeitada"}
            </span>
          )}
        </div>
      </div>

      {/* 📋 TABELA DE PERÍODOS */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Período</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Sessões</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor Líquido</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status da NF</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedPeriods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhum período com sessões realizadas encontrado
                  </td>
                </tr>
              ) : (
                paginatedPeriods.map((period) => (
                  <tr key={`${period.year}-${period.month}`} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3">
                      <span className="text-sm font-medium text-gray-900">
                        {period.monthLabel}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-sm text-gray-600">
                        {period.sessions_count} sessão{period.sessions_count !== 1 ? 'ões' : ''}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-sm font-bold text-green-600">
                        {formatCurrency(period.total_net_amount)}
                      </span>
                    </td>
                    <td className="p-3">
                      {getStatusBadge(period.invoice?.status)}
                      {period.invoice?.admin_notes && period.invoice.status === "rejected" && (
                        <p className="text-xs text-red-500 mt-1">{period.invoice.admin_notes}</p>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {(!period.invoice || period.invoice.status === "pending") ? (
                        <button
                          onClick={() => {
                            setSelectedPeriod(period);
                            setShowUploadModal(true);
                          }}
                          className="px-3 py-1.5 bg-[#E03673] text-white rounded-lg text-xs font-medium hover:bg-[#c02c5e] transition-colors flex items-center gap-1 mx-auto"
                        >
                          <Upload className="w-3 h-3" />
                          {period.invoice ? "Reenviar NF" : "Enviar NF"}
                        </button>
                      ) : period.invoice?.invoice_url ? (
                        <button
                          onClick={() => {
                            setSelectedInvoice({
                              invoice_number: period.invoice!.invoice_number,
                              invoice_url: period.invoice!.invoice_url,
                              amount: period.total_net_amount,
                              status: period.invoice!.status,
                              admin_notes: period.invoice!.admin_notes,
                              period: period.monthLabel
                            });
                            setShowViewModal(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors"
                          title="Visualizar NF"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
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

      {/* 📤 MODAL DE UPLOAD */}
      {showUploadModal && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Enviar Nota Fiscal</h3>
              </div>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }} 
                className="p-1.5 hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Período: <span className="font-medium">{selectedPeriod.monthLabel}</span></p>
                <p className="text-sm text-gray-600">Valor líquido a receber: <span className="font-medium text-green-600">{formatCurrency(selectedPeriod.total_net_amount)}</span></p>
                <p className="text-xs text-gray-500 mt-1">{selectedPeriod.sessions_count} sessões realizadas</p>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {uploadError}
                </div>
              )}
              
              {uploadSuccess && (
                <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {uploadSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número da Nota Fiscal *</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: 12345"
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data da Nota Fiscal *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo PDF *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#E03673] transition-colors">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="invoice-file"
                  />
                  <label htmlFor="invoice-file" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      {invoiceFile ? invoiceFile.name : "Clique para selecionar o PDF"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF até 5MB</p>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 text-sm bg-[#E03673] hover:bg-[#c02c5e] text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👁️ MODAL DE VISUALIZAÇÃO */}
      {showViewModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h3 className="text-lg font-semibold">Nota Fiscal</h3>
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-1.5 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Período:</span>
                    <span className="ml-2 font-medium">{selectedInvoice.period}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Valor:</span>
                    <span className="ml-2 font-medium">{formatCurrency(selectedInvoice.amount)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Nº da Nota:</span>
                    <span className="ml-2">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className="ml-2">{getStatusBadge(selectedInvoice.status)}</span>
                  </div>
                </div>
                {selectedInvoice.admin_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-gray-500">Observações do Admin:</span>
                    <p className="text-sm text-gray-700 mt-1">{selectedInvoice.admin_notes}</p>
                  </div>
                )}
              </div>
              <iframe 
                src={getFileUrl(selectedInvoice.invoice_url)} 
                className="w-full h-[60vh] border rounded-lg"
                title="Nota Fiscal"
              />
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setShowViewModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}