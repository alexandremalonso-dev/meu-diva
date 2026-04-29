"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  Shield, 
  Users, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertCircle,
  FileText,
  Eye,
  RefreshCw,
  Clock,
  RotateCcw,
  X,
  Download,
  Search
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

// Cores da paleta do projeto
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaClaro: "#FCE4EC",
  laranja: "#F59E0B",
  verde: "#10B981",
  vermelho: "#EF4444",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  branco: "#FFFFFF",
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
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{url: string, filename: string, type: string, therapistName: string} | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectDocument, setRejectDocument] = useState<{id: number, type: string, therapistName: string} | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/admin/dashboard");
    }
  }, [user, router]);

  const loadTherapists = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiCall({
        url: "/api/admin/therapists/pending-validation",
        requireAuth: true
      });
      setTherapists(data);
      setFilteredTherapists(data);
    } catch (err: any) {
      console.error("Erro ao carregar terapeutas:", err);
      setError(err.message || "Erro ao carregar lista");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTherapists();
  }, []);

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
      if (reason) {
        body.rejection_reason = reason;
      }
      
      const result = await apiCall({
        url: `/api/admin/therapists/validate-document/${documentId}`,
        method: "POST",
        body: body,
        requireAuth: true
      });
      
      const statusMessages = {
        approved: "aprovado",
        rejected: "reprovado",
        need_reupload: "reenvio solicitado"
      };
      setSuccess(`Documento ${statusMessages[status as keyof typeof statusMessages]} com sucesso!`);
      loadTherapists();
      setShowRejectModal(false);
      setRejectDocument(null);
      setRejectionReason("");
    } catch (err: any) {
      console.error("Erro ao validar documento:", err);
      setError(err.message || "Erro ao processar validação");
    } finally {
      setProcessing(null);
    }
  };

  const openPdfModal = (doc: Document, therapistName: string) => {
    const fullUrl = `${BACKEND_URL}${doc.url}`;
    setSelectedDocument({
      url: fullUrl,
      filename: doc.filename,
      type: doc.type,
      therapistName: therapistName
    });
    setShowPdfModal(true);
  };

  // Badge de status atual
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Aprovado</span>;
      case "rejected":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Reprovado</span>;
      case "need_reupload":
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><RotateCcw className="w-3 h-3" /> Reenviar</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Clock className="w-3 h-3" /> Pendente</span>;
    }
  };

  // Badge de ação - sempre cinza, muda após ação
  const ActionBadge = ({ 
    label, 
    icon: Icon, 
    color, 
    onClick, 
    isLoading, 
    isActive 
  }: { 
    label: string; 
    icon: React.ElementType; 
    color: string; 
    onClick: () => void; 
    isLoading?: boolean;
    isActive?: boolean;
  }) => {
    const getActiveColor = () => {
      if (color === CORES.verde) return "bg-green-100 text-green-700";
      if (color === CORES.vermelho) return "bg-red-100 text-red-700";
      if (color === CORES.laranja) return "bg-yellow-100 text-yellow-700";
      return "bg-gray-100 text-gray-500";
    };
    
    return (
      <button
        onClick={onClick}
        disabled={isLoading || isActive}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80 disabled:opacity-50 ${
          isActive ? getActiveColor() : "bg-gray-100 text-gray-500"
        }`}
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
        {label}
      </button>
    );
  };

  const getDocumentTypeName = (type: string) => {
    return type === "diploma" ? "Diploma / Formação" : "Registro Profissional";
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

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
        <p className="text-gray-500">
          Gerencie a validação de documentos enviados por terapeutas.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl shadow-sm p-4 text-center" style={{ backgroundColor: CORES.azul, color: CORES.branco }}>
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm opacity-90">Total</p>
        </div>
        <div className="rounded-xl shadow-sm p-4 text-center" style={{ backgroundColor: CORES.laranja, color: CORES.branco }}>
          <p className="text-2xl font-bold">{stats.pending}</p>
          <p className="text-sm opacity-90">Pendentes</p>
        </div>
        <div className="rounded-xl shadow-sm p-4 text-center" style={{ backgroundColor: CORES.verde, color: CORES.branco }}>
          <p className="text-2xl font-bold">{stats.approved}</p>
          <p className="text-sm opacity-90">Aprovados</p>
        </div>
        <div className="rounded-xl shadow-sm p-4 text-center" style={{ backgroundColor: CORES.rosa, color: CORES.branco }}>
          <p className="text-2xl font-bold">{stats.rejected}</p>
          <p className="text-sm opacity-90">Reprovados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
              />
            </div>
          </div>
          <div className="w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
            >
              <option value="all">Todos os status</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovados</option>
              <option value="rejected">Reprovados</option>
            </select>
          </div>
          <button
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
            }}
            className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Limpar filtros
          </button>
          <button
            onClick={loadTherapists}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 ml-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {filteredTherapists.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Nenhum terapeuta encontrado</p>
          <p className="text-sm text-gray-300 mt-1">Tente ajustar os filtros</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTherapists.map((therapist) => (
            <div key={therapist.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Cabeçalho do terapeuta */}
              <div className="p-5 border-b border-gray-100" style={{ backgroundColor: CORES.cinza }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{therapist.name}</h3>
                    <p className="text-sm text-gray-500">{therapist.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(therapist.validation_status)}
                  </div>
                </div>
              </div>

              {/* Documentos em duas colunas */}
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Diploma */}
                  {(() => {
                    const diploma = therapist.documents.find(d => d.type === "diploma");
                    const isLoading = processing?.docId === diploma?.id;
                    
                    return (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100" style={{ backgroundColor: `${CORES.azul}10` }}>
                          <h4 className="font-medium text-gray-800">🎓 Diploma / Formação</h4>
                        </div>
                        <div className="p-4">
                          {diploma ? (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-[#E03673]" />
                                  <span className="text-sm text-gray-600 truncate max-w-[200px]">{diploma.filename}</span>
                                </div>
                                <button
                                  onClick={() => openPdfModal(diploma, therapist.name)}
                                  className="p-1.5 text-gray-500 hover:text-[#2F80D3] transition-colors"
                                  title="Visualizar"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="mb-3">
                                {getStatusBadge(diploma.validation_status)}
                              </div>
                              {diploma.rejection_reason && (
                                <p className="text-xs text-red-600 mb-3 p-2 bg-red-50 rounded">
                                  Motivo: {diploma.rejection_reason}
                                </p>
                              )}
                              {/* Badges de ação - sempre visíveis */}
                              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                <ActionBadge
                                  label="Aprovar"
                                  icon={CheckCircle}
                                  color={CORES.verde}
                                  isLoading={isLoading && processing?.action === "approved"}
                                  isActive={diploma.validation_status === "approved"}
                                  onClick={() => handleValidateDocument(diploma.id, "approved")}
                                />
                                <ActionBadge
                                  label="Reprovar"
                                  icon={XCircle}
                                  color={CORES.vermelho}
                                  isLoading={isLoading && processing?.action === "rejected"}
                                  isActive={diploma.validation_status === "rejected"}
                                  onClick={() => {
                                    setRejectDocument({ id: diploma.id, type: "diploma", therapistName: therapist.name });
                                    setShowRejectModal(true);
                                  }}
                                />
                                <ActionBadge
                                  label="Reenviar"
                                  icon={RotateCcw}
                                  color={CORES.laranja}
                                  isLoading={isLoading && processing?.action === "need_reupload"}
                                  isActive={diploma.validation_status === "need_reupload"}
                                  onClick={() => handleValidateDocument(diploma.id, "need_reupload")}
                                />
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
                  })()}

                  {/* Registro Profissional */}
                  {(() => {
                    const registration = therapist.documents.find(d => d.type === "registration");
                    const isLoading = processing?.docId === registration?.id;
                    
                    return (
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100" style={{ backgroundColor: `${CORES.rosa}10` }}>
                          <h4 className="font-medium text-gray-800">📋 Registro Profissional</h4>
                        </div>
                        <div className="p-4">
                          {registration ? (
                            <>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-5 h-5 text-[#E03673]" />
                                  <span className="text-sm text-gray-600 truncate max-w-[200px]">{registration.filename}</span>
                                </div>
                                <button
                                  onClick={() => openPdfModal(registration, therapist.name)}
                                  className="p-1.5 text-gray-500 hover:text-[#2F80D3] transition-colors"
                                  title="Visualizar"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="mb-3">
                                {getStatusBadge(registration.validation_status)}
                              </div>
                              {registration.rejection_reason && (
                                <p className="text-xs text-red-600 mb-3 p-2 bg-red-50 rounded">
                                  Motivo: {registration.rejection_reason}
                                </p>
                              )}
                              {/* Badges de ação - sempre visíveis */}
                              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                                <ActionBadge
                                  label="Aprovar"
                                  icon={CheckCircle}
                                  color={CORES.verde}
                                  isLoading={isLoading && processing?.action === "approved"}
                                  isActive={registration.validation_status === "approved"}
                                  onClick={() => handleValidateDocument(registration.id, "approved")}
                                />
                                <ActionBadge
                                  label="Reprovar"
                                  icon={XCircle}
                                  color={CORES.vermelho}
                                  isLoading={isLoading && processing?.action === "rejected"}
                                  isActive={registration.validation_status === "rejected"}
                                  onClick={() => {
                                    setRejectDocument({ id: registration.id, type: "registration", therapistName: therapist.name });
                                    setShowRejectModal(true);
                                  }}
                                />
                                <ActionBadge
                                  label="Reenviar"
                                  icon={RotateCcw}
                                  color={CORES.laranja}
                                  isLoading={isLoading && processing?.action === "need_reupload"}
                                  isActive={registration.validation_status === "need_reupload"}
                                  onClick={() => handleValidateDocument(registration.id, "need_reupload")}
                                />
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
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Visualização de PDF */}
      {showPdfModal && selectedDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200" style={{ background: `linear-gradient(135deg, ${CORES.azul}, ${CORES.rosa})`, color: CORES.branco }}>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <div>
                  <h3 className="font-semibold">{getDocumentTypeName(selectedDocument.type)}</h3>
                  <p className="text-xs text-white/80">{selectedDocument.therapistName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPdfModal(false)}
                className="p-1.5 text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-100 p-4">
              <embed
                src={selectedDocument.url}
                type="application/pdf"
                className="w-full h-[70vh] rounded-lg shadow-md"
              />
            </div>
            <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-500">{selectedDocument.filename}</div>
              <div className="flex gap-3">
                <a
                  href={selectedDocument.url}
                  download
                  className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors"
                  style={{ backgroundColor: CORES.azul, color: CORES.branco }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#236bb3"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = CORES.azul}
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </a>
                <button
                  onClick={() => setShowPdfModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Reprovação */}
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
              <p className="text-gray-700 mb-2">
                Documento: <strong>{getDocumentTypeName(rejectDocument.type)}</strong>
              </p>
              <p className="text-gray-700 mb-4">
                Terapeuta: <strong>{rejectDocument.therapistName}</strong>
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motivo da reprovação
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                rows={3}
                placeholder="Informe o motivo da reprovação..."
              />
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectDocument(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleValidateDocument(rejectDocument.id, "rejected", rejectionReason)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Confirmar reprovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}