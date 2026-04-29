"use client";

import { useEffect, useState, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { getFotoSrc } from '@/lib/utils';
import { 
  Loader2,
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
  Search,
  TrendingUp,
  FileText,
  User,
  Send
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 🔥 TIPOS
interface InvoicePeriod {
  year: number;
  month: number;
  month_label: string;
  total_net_amount: number;
  total_commission: number;
  sessions_count: number;
  invoice_status: string;
  invoice_id?: number;
  invoice_number?: string;
  invoice_url?: string;
  admin_notes?: string;
}

interface TherapistWithPayments {
  therapist_id: number;
  therapist_name: string;
  therapist_email: string;
  therapist_phone?: string;
  therapist_foto_url?: string;
  plan?: string;
  pix_key_type?: string;
  pix_key?: string;
  total_pending_amount: number;
  total_approved_amount: number;
  periods: InvoicePeriod[];
}

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

function getFotoUrl(fotoUrl?: string) {
  if (!fotoUrl) return null;
  if (fotoUrl.startsWith('http')) return fotoUrl;
  return getFotoSrc(fotoUrl) ?? "";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "approved":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> Aprovada</span>;
    case "rejected":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><XCircle className="w-3 h-3" /> Rejeitada</span>;
    case "pending":
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertCircle className="w-3 h-3" /> Pendente</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><FileText className="w-3 h-3" /> Não enviada</span>;
  }
}

export default function AdminPaymentsReportPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();

  const [loading, setLoading] = useState(true);
  const [therapists, setTherapists] = useState<TherapistWithPayments[]>([]);
  const [filteredTherapists, setFilteredTherapists] = useState<TherapistWithPayments[]>([]);
  
  // 🔥 FILTROS
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTherapist, setSearchTherapist] = useState("");

  // Modal de aprovação/rejeição
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<{ period: InvoicePeriod; therapist: TherapistWithPayments } | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);

  // Modal de visualização da NF
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<{
    invoice_url: string;
    invoice_number: string;
    period: string;
    amount: number;
    status: string;
    admin_notes?: string;
    therapist_name: string;
  } | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      
      let url = "/api/admin/reports/payments-summary";
      const params = new URLSearchParams();
      if (selectedYear) params.append("year", selectedYear.toString());
      if (selectedMonth !== undefined && selectedMonth !== null) params.append("month", (selectedMonth + 1).toString());
      if (statusFilter !== "all") params.append("status_filter", statusFilter);
      
      if (params.toString()) url += `?${params.toString()}`;
      
      const data = await apiCall({ url, requireAuth: true }).catch(() => ({ payments: [] }));
      
      const paymentsData = data.payments || [];
      
      const yearsSet = new Set<number>();
      paymentsData.forEach((t: TherapistWithPayments) => {
        t.periods?.forEach((period: InvoicePeriod) => yearsSet.add(period.year));
      });
      if (yearsSet.size === 0) yearsSet.add(new Date().getFullYear());
      setAvailableYears(Array.from(yearsSet).sort((a, b) => b - a));
      
      setTherapists(paymentsData);
      
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiCall, selectedYear, selectedMonth, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Aplicar filtros adicionais
  useEffect(() => {
    if (therapists.length === 0) return;
    let filtered = [...therapists];
    if (searchTherapist) {
      const term = searchTherapist.toLowerCase();
      filtered = filtered.filter(t => 
        t.therapist_name.toLowerCase().includes(term) || 
        t.therapist_email.toLowerCase().includes(term)
      );
    }
    setFilteredTherapists(filtered);
    setCurrentPage(1);
  }, [therapists, searchTherapist]);

  // Aprovar nota fiscal
  const handleApprove = async () => {
    if (!selectedPeriod || !selectedPeriod.period.invoice_id) return;
    setReviewLoading(true);
    try {
      await apiCall({
        url: `/api/admin/invoices/${selectedPeriod.period.invoice_id}/approve`,
        method: "POST",
        body: { admin_notes: reviewNotes || null },
        requireAuth: true
      });
      setShowReviewModal(false);
      setReviewNotes("");
      loadData();
    } catch (error) {
      console.error("Erro ao aprovar:", error);
      alert("Erro ao aprovar nota fiscal");
    } finally {
      setReviewLoading(false);
    }
  };

  // Rejeitar nota fiscal
  const handleReject = async () => {
    if (!selectedPeriod || !selectedPeriod.period.invoice_id) return;
    if (!reviewNotes.trim()) {
      alert("Informe o motivo da rejeição");
      return;
    }
    setReviewLoading(true);
    try {
      await apiCall({
        url: `/api/admin/invoices/${selectedPeriod.period.invoice_id}/reject`,
        method: "POST",
        body: { admin_notes: reviewNotes },
        requireAuth: true
      });
      setShowReviewModal(false);
      setReviewNotes("");
      loadData();
    } catch (error) {
      console.error("Erro ao rejeitar:", error);
      alert("Erro ao rejeitar nota fiscal");
    } finally {
      setReviewLoading(false);
    }
  };

  // Abrir modal de revisão
  const openReviewModal = (period: InvoicePeriod, therapist: TherapistWithPayments, action: "approve" | "reject") => {
    if (!period.invoice_id) {
      alert("Nota fiscal não encontrada");
      return;
    }
    setSelectedPeriod({ period, therapist });
    setReviewAction(action);
    setReviewNotes("");
    setShowReviewModal(true);
  };

  // Visualizar nota fiscal
  const viewInvoice = (period: InvoicePeriod, therapistName: string) => {
    if (period.invoice_url) {
      setViewingInvoice({
        invoice_url: period.invoice_url,
        invoice_number: period.invoice_number || "N/A",
        period: period.month_label,
        amount: period.total_net_amount,
        status: period.invoice_status,
        admin_notes: period.admin_notes,
        therapist_name: therapistName
      });
      setShowViewModal(true);
    }
  };

  const resetFilters = () => {
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(new Date().getMonth());
    setStatusFilter("all");
    setSearchTherapist("");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredTherapists.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTherapists = filteredTherapists.slice(startIndex, startIndex + itemsPerPage);

  // Calcular resumo
  const summary = {
    total_pending_all: therapists.reduce((sum, t) => sum + t.total_pending_amount, 0),
    total_approved_all: therapists.reduce((sum, t) => sum + t.total_approved_amount, 0),
    total_therapists: therapists.length,
    therapists_with_pending: therapists.filter(t => t.total_pending_amount > 0).length
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
            <div className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#E03673]" />
              <h1 className="text-2xl font-bold text-gray-900">Gestão de Notas Fiscais</h1>
            </div>
            <p className="text-gray-600 mt-1">
              Aprove ou rejeite as notas fiscais enviadas pelos terapeutas
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Total Pendente</span>
            <DollarSign className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.total_pending_all)}</p>
          <p className="text-xs text-white/70 mt-1">{summary.therapists_with_pending} terapeutas</p>
        </div>

        <div className="bg-gradient-to-r from-[#10B981] to-[#10B981]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Total Aprovado</span>
            <CheckCircle className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(summary.total_approved_all)}</p>
          <p className="text-xs text-white/70 mt-1">Notas aprovadas</p>
        </div>

        <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Terapeutas</span>
            <User className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{filteredTherapists.length}</p>
          <p className="text-xs text-white/70 mt-1">Com períodos no filtro</p>
        </div>

        <div className="bg-gradient-to-r from-[#F59E0B] to-[#F59E0B]/80 rounded-xl shadow-sm p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/80">Período</span>
            <Calendar className="w-5 h-5 text-white/80" />
          </div>
          <p className="text-2xl font-bold">{MONTHS[selectedMonth]?.label.substring(0, 3)} {selectedYear}</p>
          <p className="text-xs text-white/70 mt-1">Filtro aplicado</p>
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#E03673]" />
            Filtros
          </h3>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
          <div className="flex flex-wrap gap-2">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  selectedYear === year ? 'bg-[#2F80D3] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Mês</label>
          <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {MONTHS.map((month) => (
              <button
                key={month.value}
                onClick={() => setSelectedMonth(month.value)}
                className={`p-2 text-sm rounded-lg transition-colors ${
                  selectedMonth === month.value ? 'bg-[#2F80D3] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {month.label.substring(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status da Nota</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="all">Todos</option>
              <option value="not_sent">Não enviada</option>
              <option value="pending">Pendente</option>
              <option value="approved">Aprovada</option>
              <option value="rejected">Rejeitada</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Terapeuta</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTherapist}
                onChange={(e) => setSearchTherapist(e.target.value)}
                placeholder="Nome ou e-mail"
                className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de Terapeutas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Terapeuta</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">PIX</th>
                <th className="text-right p-3 text-xs font-medium text-gray-500 uppercase">Valor do Mês</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status NF</th>
                <th className="text-center p-3 text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedTherapists.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Nenhum período encontrado para o filtro selecionado
                  </td>
                </tr>
              ) : (
                paginatedTherapists.map((therapist) => {
                  const fotoUrl = getFotoUrl(therapist.therapist_foto_url);
                  const currentPeriod = therapist.periods?.find(p => p.year === selectedYear && p.month === selectedMonth);
                  
                  return (
                    <tr key={therapist.therapist_id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#E03673] to-[#E03673]/80 flex items-center justify-center flex-shrink-0">
                            {fotoUrl ? (
                              <img src={fotoUrl} alt={therapist.therapist_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-white text-xs font-bold">{therapist.therapist_name?.charAt(0).toUpperCase() || "T"}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{therapist.therapist_name}</div>
                            <div className="text-xs text-gray-500">{therapist.therapist_email}</div>
                            {therapist.plan && (
                              <span className="text-xs text-gray-400">Plano: {therapist.plan}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {therapist.pix_key ? (
                          <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded" title={therapist.pix_key_type}>
                            {therapist.pix_key.length > 20 ? therapist.pix_key.substring(0, 20) + "..." : therapist.pix_key}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Não informada</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-sm font-bold text-green-600">
                          {formatCurrency(currentPeriod?.total_net_amount || 0)}
                        </span>
                        {currentPeriod && currentPeriod.sessions_count > 0 && (
                          <div className="text-xs text-gray-400">{currentPeriod.sessions_count} sessões</div>
                        )}
                      </td>
                      <td className="p-3">
                        {currentPeriod ? getStatusBadge(currentPeriod.invoice_status) : (
                          <span className="text-xs text-gray-400">Sem sessões</span>
                        )}
                        {currentPeriod?.admin_notes && currentPeriod.invoice_status === "rejected" && (
                          <p className="text-xs text-[#FB8811] mt-1">{currentPeriod.admin_notes}</p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Botões de aprovação/rejeição - apenas para status pending */}
                          {currentPeriod && currentPeriod.invoice_status === "pending" && currentPeriod.invoice_id && (
                            <>
                              <button
                                onClick={() => openReviewModal(currentPeriod, therapist, "approve")}
                                className="p-1.5 bg-[#2F80D3] hover:bg-[#236bb3] text-white rounded-lg transition-colors"
                                title="Aprovar NF"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openReviewModal(currentPeriod, therapist, "reject")}
                                className="p-1.5 bg-[#FB8811] hover:bg-[#e07a0f] text-white rounded-lg transition-colors"
                                title="Rejeitar NF"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {/* Botão de visualizar - se tiver URL */}
                          {currentPeriod && currentPeriod.invoice_url && (
                            <button
                              onClick={() => viewInvoice(currentPeriod, therapist.therapist_name)}
                              className="p-1.5 text-gray-400 hover:text-[#2F80D3] transition-colors"
                              title="Visualizar NF"
                            >
                              <Eye className="w-4 h-4" />
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

      {/* Modal de Aprovação/Rejeição */}
      {showReviewModal && selectedPeriod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header com cores da paleta */}
            <div className={`flex justify-between items-center p-4 border-b ${
              reviewAction === "approve" 
                ? 'bg-[#2F80D3]' 
                : 'bg-[#FB8811]'
            } text-white`}>
              <div className="flex items-center gap-2">
                {reviewAction === "approve" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                <h3 className="text-lg font-semibold">{reviewAction === "approve" ? "Aprovar Nota Fiscal" : "Rejeitar Nota Fiscal"}</h3>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-1.5 hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Terapeuta: <span className="font-medium">{selectedPeriod.therapist.therapist_name}</span></p>
                <p className="text-sm text-gray-600">Período: <span className="font-medium">{selectedPeriod.period.month_label}</span></p>
                <p className="text-sm text-gray-600">Valor: <span className="font-medium text-green-600">{formatCurrency(selectedPeriod.period.total_net_amount)}</span></p>
                <p className="text-sm text-gray-600">Nº da Nota: <span className="font-medium">{selectedPeriod.period.invoice_number || "N/A"}</span></p>
              </div>

              {reviewAction === "reject" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Rejeição *</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#FB8811] outline-none"
                    placeholder="Informe o motivo da rejeição..."
                  />
                </div>
              )}

              {reviewAction === "approve" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={2}
                    className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2F80D3] outline-none"
                    placeholder="Observações sobre a aprovação..."
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Cancelar
              </button>
              <button
                onClick={reviewAction === "approve" ? handleApprove : handleReject}
                disabled={reviewLoading}
                className={`px-4 py-2 text-sm text-white rounded-lg flex items-center gap-2 ${
                  reviewAction === "approve" 
                    ? 'bg-[#2F80D3] hover:bg-[#236bb3]' 
                    : 'bg-[#FB8811] hover:bg-[#e07a0f]'
                } disabled:opacity-50`}
              >
                {reviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (reviewAction === "approve" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />)}
                {reviewAction === "approve" ? "Aprovar" : "Rejeitar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização da NF */}
      {showViewModal && viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-[#2F80D3] text-white">
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
                  <div><span className="text-gray-500">Terapeuta:</span> <span className="font-medium">{viewingInvoice.therapist_name}</span></div>
                  <div><span className="text-gray-500">Período:</span> <span className="font-medium">{viewingInvoice.period}</span></div>
                  <div><span className="text-gray-500">Valor:</span> <span className="font-medium text-green-600">{formatCurrency(viewingInvoice.amount)}</span></div>
                  <div><span className="text-gray-500">Nº da Nota:</span> <span className="font-medium">{viewingInvoice.invoice_number}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Status:</span> {getStatusBadge(viewingInvoice.status)}</div>
                </div>
                {viewingInvoice.admin_notes && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <span className="text-gray-500">Observações:</span>
                    <p className="text-sm text-gray-700 mt-1">{viewingInvoice.admin_notes}</p>
                  </div>
                )}
              </div>
              <iframe src={getFileUrl(viewingInvoice.invoice_url)} className="w-full h-[60vh] border rounded-lg" title="Nota Fiscal" />
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