"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Shield, Users, CheckCircle, XCircle, Loader2, AlertCircle,
  FileText, Eye, RefreshCw, Clock, RotateCcw, X, Download, Search,
  ChevronLeft, ChevronRight
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.meudivaonline.com";

interface Document {
  id: number;
  type: string;
  url: string;
  filename: string;
  validation_status: string;
  uploaded_at: string;
  rejection_reason?: string;
}

interface PendingTherapist {
  id: number;
  user_id: number;
  name: string;
  email: string;
  validation_status: string;
  documents: Document[];
}

const CORES = {
  azul: "#2F80D3", rosa: "#E03673", rosaClaro: "#FCE4EC",
  laranja: "#F59E0B", verde: "#10B981", vermelho: "#EF4444",
  cinza: "#F3F4F6", cinzaTexto: "#374151", branco: "#FFFFFF",
};

// ===== paginação, ordenação e datas (só visual; as chamadas ao servidor continuam as mesmas) =====
const TAMANHOS_PAGINA = [10, 20, 30, 50];
const CHAVE_TAMANHO_PAGINA = "admin_validation_page_size";
const COR_REENVIO = "#8B5CF6";
type OrdemLista = "padrao" | "nome" | "recentes";

function dataDoUltimoEnvio(t: PendingTherapist): number {
  let max = 0;
  (t.documents || []).forEach((d) => {
    const ms = Date.parse(d.uploaded_at);
    if (!isNaN(ms) && ms > max) max = ms;
  });
  return max;
}

function ordenarTerapeutas(lista: PendingTherapist[], ordem: OrdemLista): PendingTherapist[] {
  const copia = lista.slice();
  if (ordem === "nome") {
    copia.sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));
  } else if (ordem === "recentes") {
    copia.sort((a, b) => dataDoUltimoEnvio(b) - dataDoUltimoEnvio(a));
  }
  return copia;
}

function fatiarPagina<T>(lista: T[], pagina: number, tamanho: number): T[] {
  const ini = (pagina - 1) * tamanho;
  return lista.slice(ini, ini + tamanho);
}

function paginasVisiveis(atual: number, total: number): Array<number | string> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const conj = new Set<number>([1, total, atual - 1, atual, atual + 1]);
  if (atual <= 3) { conj.add(2); conj.add(3); conj.add(4); }
  if (atual >= total - 2) { conj.add(total - 1); conj.add(total - 2); conj.add(total - 3); }
  const nums = Array.from(conj).filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const saida: Array<number | string> = [];
  let anterior = 0;
  nums.forEach((n) => {
    if (n - anterior > 1) saida.push("…");
    saida.push(n);
    anterior = n;
  });
  return saida;
}

function formatarData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export default function AdminTherapistValidationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [therapists, setTherapists] = useState<PendingTherapist[]>([]);
  const [filteredTherapists, setFilteredTherapists] = useState<PendingTherapist[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<{docId: number, action: string} | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // paginação e ordenação (só visual)
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [ordem, setOrdem] = useState<OrdemLista>("padrao");

  useEffect(() => {
    try {
      const salvo = Number(window.localStorage.getItem(CHAVE_TAMANHO_PAGINA));
      if (TAMANHOS_PAGINA.indexOf(salvo) >= 0) setPorPagina(salvo);
    } catch {}
  }, []);

  useEffect(() => { setPagina(1); }, [searchTerm, statusFilter, ordem, porPagina]);

  const mudarPorPagina = (n: number) => {
    setPorPagina(n);
    try { window.localStorage.setItem(CHAVE_TAMANHO_PAGINA, String(n)); } catch {}
  };

  const irParaPagina = (n: number) => {
    setPagina(n);
    const el = document.getElementById("lista-validacao");
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // 🔥 PDF Modal state
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{filename: string, type: string, therapistName: string, docId: number} | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectDocument, setRejectDocument] = useState<{id: number, type: string, therapistName: string} | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") router.push("/admin/dashboard");
  }, [user, router]);

  const loadTherapists = async (silencioso: boolean = false) => {
    if (!silencioso) setLoading(true);
    setError("");
    try {
      const data = await apiCall({ url: "/api/admin/therapists/pending-validation", requireAuth: true });
      setTherapists(data);
      setFilteredTherapists(data);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar lista");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTherapists(); }, []);

  useEffect(() => {
    let filtered = [...therapists];
    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.validation_status === statusFilter);
    }
    setFilteredTherapists(filtered);
  }, [searchTerm, statusFilter, therapists]);

  const handleValidateDocument = async (documentId: number, status: string, reason?: string) => {
    setProcessing({ docId: documentId, action: status });
    setError("");
    setSuccess("");
    try {
      const body: any = { status };
      if (reason) body.rejection_reason = reason;
      await apiCall({
        url: `/api/admin/therapists/validate-document/${documentId}`,
        method: "POST",
        body,
        requireAuth: true
      });
      const statusMessages: Record<string, string> = { approved: "aprovado", rejected: "reprovado", need_reupload: "reenvio solicitado" };
      setSuccess(`Documento ${statusMessages[status]} com sucesso!`);
      loadTherapists(true);
      setShowRejectModal(false);
      setRejectDocument(null);
      setRejectionReason("");
    } catch (err: any) {
      setError(err.message || "Erro ao processar validação");
    } finally {
      setProcessing(null);
    }
  };

  // 🔥 Abre modal e busca PDF como blob via endpoint autenticado
  const openPdfModal = async (doc: Document, therapistName: string) => {
    setSelectedDocument({ filename: doc.filename, type: doc.type, therapistName, docId: doc.id });
    setShowPdfModal(true);
    setPdfLoading(true);
    setPdfBlobUrl(null);
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(
        `${BACKEND_URL}/api/admin/therapists/document-file/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Erro ao carregar arquivo");
      const blob = await response.blob();
      setPdfBlobUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Erro ao carregar PDF:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const closePdfModal = () => {
    setShowPdfModal(false);
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    setSelectedDocument(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Aprovado</span>;
      case "rejected": return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Reprovado</span>;
      case "need_reupload": return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><RotateCcw className="w-3 h-3" /> Reenviar</span>;
      default: return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Clock className="w-3 h-3" /> Pendente</span>;
    }
  };

  const ActionBadge = ({ label, icon: Icon, color, onClick, isLoading, isActive }: {
    label: string; icon: React.ElementType; color: string;
    onClick: () => void; isLoading?: boolean; isActive?: boolean;
  }) => {
    const getActiveColor = () => {
      if (color === CORES.verde) return "bg-green-100 text-green-700";
      if (color === CORES.vermelho) return "bg-red-100 text-red-700";
      if (color === CORES.laranja) return "bg-yellow-100 text-yellow-700";
      return "bg-gray-100 text-gray-500";
    };
    return (
      <button onClick={onClick} disabled={isLoading || isActive}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50 ${isActive ? getActiveColor() : "bg-gray-100 text-gray-500"}`}>
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
        {label}
      </button>
    );
  };

  const getDocumentTypeName = (type: string) => type === "diploma" ? "Diploma / Formação" : "Registro Profissional";

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  const stats = {
    total: therapists.length,
    pending: therapists.filter(t => t.validation_status === "pending").length,
    approved: therapists.filter(t => t.validation_status === "approved").length,
    rejected: therapists.filter(t => t.validation_status === "rejected").length,
    reupload: therapists.filter(t => t.validation_status === "need_reupload").length
  };

  const ordenados = ordenarTerapeutas(filteredTherapists, ordem);
  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = fatiarPagina(ordenados, paginaAtual, porPagina);
  const inicio = ordenados.length === 0 ? 0 : (paginaAtual - 1) * porPagina + 1;
  const fim = Math.min(paginaAtual * porPagina, ordenados.length);
  const filtrosAtivos = searchTerm !== "" || statusFilter !== "all" || ordem !== "padrao";
  const cartoesResumo = [
    { chave: "all", label: "Total", value: stats.total, color: CORES.azul },
    { chave: "pending", label: "Pendentes", value: stats.pending, color: CORES.laranja },
    { chave: "approved", label: "Aprovados", value: stats.approved, color: CORES.verde },
    { chave: "rejected", label: "Reprovados", value: stats.rejected, color: CORES.rosa },
    { chave: "need_reupload", label: "Reenvio", value: stats.reupload, color: COR_REENVIO },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Validação de Terapeutas</h1>
        </div>
        <p className="text-gray-500">Gerencie a validação de documentos enviados por terapeutas.</p>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</div>}

      {/* Resumo: cada cartão filtra a lista ao clicar (clicar de novo limpa o filtro) */}
      <div data-testid="resumo" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        {cartoesResumo.map(s => {
          const ativo = statusFilter === s.chave;
          return (
            <button key={s.chave} type="button" aria-pressed={ativo}
              onClick={() => setStatusFilter(s.chave === "all" || ativo ? "all" : s.chave)}
              title={s.chave === "all" ? "Mostrar todos" : ativo ? "Clique para limpar o filtro" : `Filtrar: ${s.label}`}
              className={`rounded-xl shadow-sm p-3 text-center transition-all cursor-pointer hover:shadow-md ${ativo ? "ring-4 ring-offset-2 ring-gray-800/30" : "opacity-90 hover:opacity-100"}`}
              style={{ backgroundColor: s.color, color: CORES.branco }}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm opacity-90">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-44 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
            <option value="all">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Reprovados</option>
            <option value="need_reupload">Reenvio solicitado</option>
          </select>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value as OrdemLista)}
            className="w-44 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
            <option value="padrao">Ordem padrão</option>
            <option value="nome">Nome (A–Z)</option>
            <option value="recentes">Envio mais recente</option>
          </select>
          <button onClick={() => { setSearchTerm(""); setStatusFilter("all"); setOrdem("padrao"); }} disabled={!filtrosAtivos}
            className="px-3 py-2 text-gray-500 hover:text-gray-700 flex items-center gap-2 disabled:opacity-40">
            <X className="w-4 h-4" /> Limpar filtros
          </button>
          <button onClick={() => loadTherapists()}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 ml-auto">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>

      {ordenados.length > 0 && (
        <div id="lista-validacao" className="flex flex-wrap items-center justify-between gap-3 mb-3 text-sm text-gray-600">
          <span data-testid="resumo-lista">Mostrando <strong>{inicio}–{fim}</strong> de <strong>{ordenados.length}</strong>{ordenados.length !== stats.total ? ` (filtrado de ${stats.total})` : ""}</span>
          <label className="flex items-center gap-2">Por página:
            <select data-testid="por-pagina" value={porPagina} onChange={(e) => mudarPorPagina(Number(e.target.value))}
              className="p-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
              {TAMANHOS_PAGINA.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      )}

      {ordenados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Nenhum terapeuta encontrado</p>
        </div>
      ) : (
        <div data-testid="grade" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visiveis.map((therapist) => (
            <div key={therapist.id} data-testid="card-terapeuta" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2" style={{ backgroundColor: CORES.cinza }}>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 truncate" title={therapist.name}>{therapist.name}</h3>
                  <p className="text-xs text-gray-500 truncate" title={therapist.email}>{therapist.email}</p>
                </div>
                <div className="shrink-0">{getStatusBadge(therapist.validation_status)}</div>
              </div>

              <div className="divide-y divide-gray-100">
                {["diploma", "registration"].map((docType) => {
                  const doc = therapist.documents.find(d => d.type === docType);
                  const isLoading = processing?.docId === doc?.id;
                  const label = docType === "diploma" ? "🎓 Diploma / Formação" : "📋 Registro Profissional";

                  return (
                    <div key={docType} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold" style={{ color: docType === "diploma" ? CORES.azul : CORES.rosa }}>{label}</span>
                        {doc ? getStatusBadge(doc.validation_status) : <span className="text-xs text-gray-400">Não enviado</span>}
                      </div>
                      {doc ? (
                        <>
                          <div className="flex items-center justify-between gap-2 mt-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="w-4 h-4 text-[#E03673] shrink-0" />
                              <span className="text-xs text-gray-600 truncate" title={doc.filename}>{doc.filename}</span>
                            </div>
                            <button onClick={() => openPdfModal(doc, therapist.name)}
                              className="p-1.5 text-gray-500 hover:text-[#2F80D3] transition-colors shrink-0" title="Visualizar">
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                          {formatarData(doc.uploaded_at) && <p className="text-[11px] text-gray-400">Enviado em {formatarData(doc.uploaded_at)}</p>}
                          {doc.rejection_reason && (
                            <p className="text-xs text-red-600 mt-1.5 p-1.5 bg-red-50 rounded">Motivo: {doc.rejection_reason}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <ActionBadge label="Aprovar" icon={CheckCircle} color={CORES.verde}
                              isLoading={isLoading && processing?.action === "approved"}
                              isActive={doc.validation_status === "approved"}
                              onClick={() => handleValidateDocument(doc.id, "approved")} />
                            <ActionBadge label="Reprovar" icon={XCircle} color={CORES.vermelho}
                              isLoading={isLoading && processing?.action === "rejected"}
                              isActive={doc.validation_status === "rejected"}
                              onClick={() => { setRejectDocument({ id: doc.id, type: docType, therapistName: therapist.name }); setShowRejectModal(true); }} />
                            <ActionBadge label="Reenviar" icon={RotateCcw} color={CORES.laranja}
                              isLoading={isLoading && processing?.action === "need_reupload"}
                              isActive={doc.validation_status === "need_reupload"}
                              onClick={() => handleValidateDocument(doc.id, "need_reupload")} />
                          </div>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {ordenados.length > 0 && totalPaginas > 1 && (
        <nav data-testid="paginacao" aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-1.5 mt-6">
          <button type="button" onClick={() => irParaPagina(paginaAtual - 1)} disabled={paginaAtual <= 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1 disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          {paginasVisiveis(paginaAtual, totalPaginas).map((n, i) => typeof n === "number" ? (
            <button key={`p${n}`} type="button" onClick={() => irParaPagina(n)} aria-current={n === paginaAtual ? "page" : undefined}
              className={`min-w-[2rem] px-2 py-1.5 text-sm rounded-lg ${n === paginaAtual ? "bg-[#E03673] text-white font-semibold" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {n}
            </button>
          ) : (
            <span key={`e${i}`} className="px-1 text-gray-400">…</span>
          ))}
          <button type="button" onClick={() => irParaPagina(paginaAtual + 1)} disabled={paginaAtual >= totalPaginas}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1 disabled:opacity-40">
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </nav>
      )}

      {/* 🔥 Modal PDF com blob URL */}
      {showPdfModal && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200"
              style={{ background: `linear-gradient(135deg, ${CORES.azul}, ${CORES.rosa})`, color: CORES.branco }}>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <div>
                  <h3 className="font-semibold">{getDocumentTypeName(selectedDocument.type)}</h3>
                  <p className="text-xs text-white/80">{selectedDocument.therapistName}</p>
                </div>
              </div>
              <button onClick={closePdfModal} className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Área do PDF */}
            <div className="flex-1 overflow-hidden bg-gray-100 p-4 flex items-center justify-center" style={{ minHeight: "60vh" }}>
              {pdfLoading ? (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-[#E03673]" />
                  <p className="text-sm">Carregando documento...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full rounded-lg shadow-md"
                  style={{ height: "65vh", border: "none" }}
                  title={selectedDocument.filename}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <FileText className="w-12 h-12 opacity-40" />
                  <p className="text-sm">Não foi possível carregar o documento</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
              <span className="text-sm text-gray-500">{selectedDocument.filename}</span>
              <div className="flex gap-3">
                <a href={pdfBlobUrl || "#"} download={selectedDocument.filename}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${!pdfBlobUrl ? "opacity-50 pointer-events-none" : ""}`}
                  style={{ backgroundColor: CORES.azul, color: CORES.branco }}>
                  <Download className="w-4 h-4" /> Baixar PDF
                </a>
                <button onClick={closePdfModal} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reprovação */}
      {showRejectModal && rejectDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-200">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Reprovar documento</h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-gray-700 mb-2">Documento: <strong>{getDocumentTypeName(rejectDocument.type)}</strong></p>
              <p className="text-gray-700 mb-4">Terapeuta: <strong>{rejectDocument.therapistName}</strong></p>
              <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da reprovação</label>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                rows={3} placeholder="Informe o motivo da reprovação..." />
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectDocument(null); setRejectionReason(""); }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancelar</button>
              <button onClick={() => handleValidateDocument(rejectDocument.id, "rejected", rejectionReason)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Confirmar reprovação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}