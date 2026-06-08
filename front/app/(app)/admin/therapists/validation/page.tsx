"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Shield, Users, CheckCircle, XCircle, Loader2, AlertCircle,
  FileText, Eye, RefreshCw, Clock, RotateCcw, X, Download, Search
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

  const loadTherapists = async () => {
    setLoading(true);
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
      loadTherapists();
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
    rejected: therapists.filter(t => t.validation_status === "rejected").length
  };

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

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[{ label: "Total", value: stats.total, color: CORES.azul },
          { label: "Pendentes", value: stats.pending, color: CORES.laranja },
          { label: "Aprovados", value: stats.approved, color: CORES.verde },
          { label: "Reprovados", value: stats.rejected, color: CORES.rosa }
        ].map(s => (
          <div key={s.label} className="rounded-xl shadow-sm p-4 text-center" style={{ backgroundColor: s.color, color: CORES.branco }}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm opacity-90">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
            </div>
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-48 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
            <option value="all">Todos os status</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Reprovados</option>
          </select>
          <button onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 flex items-center gap-2">
            <X className="w-4 h-4" /> Limpar filtros
          </button>
          <button onClick={loadTherapists}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2 ml-auto">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>

      {filteredTherapists.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Nenhum terapeuta encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTherapists.map((therapist) => (
            <div key={therapist.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-5 border-b border-gray-100" style={{ backgroundColor: CORES.cinza }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{therapist.name}</h3>
                    <p className="text-sm text-gray-500">{therapist.email}</p>
                  </div>
                  {getStatusBadge(therapist.validation_status)}
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {["diploma", "registration"].map((docType) => {
                    const doc = therapist.documents.find(d => d.type === docType);
                    const isLoading = processing?.docId === doc?.id;
                    const label = docType === "diploma" ? "🎓 Diploma / Formação" : "📋 Registro Profissional";
                    const bgColor = docType === "diploma" ? `${CORES.azul}10` : `${CORES.rosa}10`;

                    return (
                      <div key={docType} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100" style={{ backgroundColor: bgColor }}>
                          <h4 className="font-medium text-gray-800">{label}</h4>
                        </div>
                        <div className="p-4">
                          {doc ? (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-[#E03673]" />
                                  <span className="text-sm text-gray-600 truncate max-w-[200px]">{doc.filename}</span>
                                </div>
                                <button onClick={() => openPdfModal(doc, therapist.name)}
                                  className="p-1.5 text-gray-500 hover:text-[#2F80D3] transition-colors" title="Visualizar">
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="mb-3">{getStatusBadge(doc.validation_status)}</div>
                              {doc.rejection_reason && (
                                <p className="text-xs text-red-600 mb-3 p-2 bg-red-50 rounded">Motivo: {doc.rejection_reason}</p>
                              )}
                              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
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
                          ) : (
                            <div className="text-center py-6 text-gray-400">
                              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">Documento não enviado</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
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