"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  FileText, Upload, Loader2, CheckCircle, AlertCircle,
  Shield, ArrowRight, RotateCcw, XCircle
} from "lucide-react";

export default function RequiredDocumentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

  // 🔥 Status dos documentos existentes
  const [diplomaStatus, setDiplomaStatus] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [needsReupload, setNeedsReupload] = useState(false);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://meudiva-api-backend-592671373665.southamerica-east1.run.app";

  useEffect(() => {
    const checkDocuments = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await apiCall({ url: "/api/therapist/documents/status", requireAuth: true });

        const diploma = data.documents?.find((doc: any) => doc.type === "diploma");
        const registration = data.documents?.find((doc: any) => doc.type === "registration");

        const dStatus = diploma?.validation_status || null;
        const rStatus = registration?.validation_status || null;

        setDiplomaStatus(dStatus);
        setRegistrationStatus(rStatus);

        // Salvar motivos de reprovação
        const reasons: Record<string, string> = {};
        if (diploma?.rejection_reason) reasons.diploma = diploma.rejection_reason;
        if (registration?.rejection_reason) reasons.registration = registration.rejection_reason;
        setRejectionReasons(reasons);

        // 🔥 Só redireciona se ambos existem E nenhum precisa de reenvio
        const hasDiploma = !!diploma;
        const hasRegistration = !!registration;
        const hasNeedReupload = dStatus === "need_reupload" || rStatus === "need_reupload";
        const hasRejected = dStatus === "rejected" || rStatus === "rejected";

        if (hasDiploma && hasRegistration && !hasNeedReupload && !hasRejected) {
          // Tudo ok — redireciona
          setTimeout(() => router.push("/therapist/dashboard"), 2000);
        } else if (hasNeedReupload || hasRejected) {
          // Precisa reenviar algum documento
          setNeedsReupload(true);
        }
      } catch (err) {
        console.error("Erro ao verificar documentos:", err);
      } finally {
        setLoading(false);
      }
    };

    checkDocuments();
  }, [user, router, apiCall]);

  // Tela de "aguardando validação" — apenas quando tudo enviado e sem problemas
  if (!loading && diplomaStatus && registrationStatus &&
      diplomaStatus !== "need_reupload" && diplomaStatus !== "rejected" &&
      registrationStatus !== "need_reupload" && registrationStatus !== "rejected") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md mx-auto">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Documentos já enviados!</h2>
          <p className="text-gray-600 mb-4">Seus documentos já foram enviados e estão aguardando validação.</p>
          <button onClick={() => router.push("/therapist/dashboard")}
            className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e]">
            Ir para o Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  const handleFileChange = (type: "diploma" | "registration", file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Apenas arquivos PDF são aceitos"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Arquivo muito grande. Máximo 10MB"); return; }
    if (type === "diploma") setDiplomaFile(file);
    else setRegistrationFile(file);
    setError("");
  };

  const uploadDocument = async (type: string, file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", type);
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${BACKEND_URL}/api/therapist/documents/upload`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Erro ao enviar ${type}`);
    }
    return true;
  };

  // 🔥 Determina quais documentos precisam ser enviados
  const needsDiploma = !diplomaStatus || diplomaStatus === "need_reupload" || diplomaStatus === "rejected";
  const needsRegistration = !registrationStatus || registrationStatus === "need_reupload" || registrationStatus === "rejected";

  const handleSubmit = async () => {
    if (needsDiploma && !diplomaFile) { setError("Você precisa enviar o Diploma"); return; }
    if (needsRegistration && !registrationFile) { setError("Você precisa enviar o Registro Profissional"); return; }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      if (needsDiploma && diplomaFile) await uploadDocument("diploma", diplomaFile);
      if (needsRegistration && registrationFile) await uploadDocument("registration", registrationFile);
      setSuccess("Documentos enviados com sucesso! Aguarde a validação da nossa equipe.");
      setTimeout(() => router.push("/therapist/dashboard"), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar documentos");
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    if (status === "approved") return <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full"><CheckCircle className="w-3 h-3" /> Aprovado</span>;
    if (status === "rejected") return <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> Reprovado</span>;
    if (status === "need_reupload") return <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full"><RotateCcw className="w-3 h-3" /> Reenvio solicitado</span>;
    return <span className="inline-flex items-center gap-1 text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded-full"><Loader2 className="w-3 h-3" /> Pendente</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#2F80D3] to-[#E03673] text-white p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">
              {needsReupload ? "Reenvio de documentos" : "Complete seu cadastro"}
            </h1>
            <p className="text-white/80 mt-2">
              {needsReupload
                ? "Um ou mais documentos precisam ser reenviados"
                : "Para garantir a qualidade dos nossos serviços, precisamos validar seus documentos profissionais"}
            </p>
          </div>

          <div className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />{success}
              </div>
            )}

            {/* Diploma */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Diploma / Comprovante de Formação *
                </label>
                {getStatusBadge(diplomaStatus)}
              </div>

              {/* Motivo da reprovação */}
              {(diplomaStatus === "rejected" || diplomaStatus === "need_reupload") && rejectionReasons.diploma && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Motivo:</strong> {rejectionReasons.diploma}
                </div>
              )}

              {needsDiploma ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-3">Formato PDF, até 10MB</p>
                  <input id="diploma-upload" type="file" accept=".pdf"
                    onChange={(e) => handleFileChange("diploma", e.target.files?.[0] || null)}
                    className="hidden" disabled={uploading} />
                  <button onClick={() => document.getElementById("diploma-upload")?.click()}
                    disabled={uploading}
                    className="px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] inline-flex items-center gap-2 text-sm disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Selecionar arquivo
                  </button>
                  {diplomaFile && <div className="mt-2 text-sm text-green-600">✓ {diplomaFile.name}</div>}
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Documento enviado — aguardando validação
                </div>
              )}
            </div>

            {/* Registro Profissional */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Registro Profissional (Ex.: CRP, ONP e Outros) *
                </label>
                {getStatusBadge(registrationStatus)}
              </div>

              {(registrationStatus === "rejected" || registrationStatus === "need_reupload") && rejectionReasons.registration && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <strong>Motivo:</strong> {rejectionReasons.registration}
                </div>
              )}

              {needsRegistration ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 mb-3">Formato PDF, até 10MB</p>
                  <input id="registration-upload" type="file" accept=".pdf"
                    onChange={(e) => handleFileChange("registration", e.target.files?.[0] || null)}
                    className="hidden" disabled={uploading} />
                  <button onClick={() => document.getElementById("registration-upload")?.click()}
                    disabled={uploading}
                    className="px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] inline-flex items-center gap-2 text-sm disabled:opacity-50">
                    <Upload className="w-4 h-4" /> Selecionar arquivo
                  </button>
                  {registrationFile && <div className="mt-2 text-sm text-green-600">✓ {registrationFile.name}</div>}
                </div>
              ) : (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Documento enviado — aguardando validação
                </div>
              )}
            </div>

            <button onClick={handleSubmit}
              disabled={
                (needsDiploma && !diplomaFile) ||
                (needsRegistration && !registrationFile) ||
                uploading
              }
              className="w-full py-3 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {uploading
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <><ArrowRight className="w-4 h-4" />{needsReupload ? "Reenviar documentos" : "Finalizar cadastro"}</>}
            </button>

            <p className="text-xs text-gray-400 text-center mt-4">
              Seus documentos serão analisados pela nossa equipe. Você será notificado quando for aprovado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}