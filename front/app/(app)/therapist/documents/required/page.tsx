"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { 
  FileText, 
  Upload, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Shield,
  ArrowRight
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
  const [hasDocuments, setHasDocuments] = useState(false);

  // Obter a URL do backend das variáveis de ambiente
  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://meudiva-api-backend-592671373665.southamerica-east1.run.app";

  // Verificar se já tem documentos enviados
  useEffect(() => {
    const checkDocuments = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const data = await apiCall({
          url: "/api/therapist/documents/status",
          requireAuth: true
        });
        
        console.log("📄 Status dos documentos:", data);
        
        // Verificar se já tem os dois documentos APROVADOS ou PENDENTES
        const hasDiploma = data.documents?.some((doc: any) => doc.type === "diploma");
        const hasRegistration = data.documents?.some((doc: any) => doc.type === "registration");
        
        // Se já tem ambos documentos (mesmo pendentes), redirecionar
        if (hasDiploma && hasRegistration) {
          setHasDocuments(true);
          // Redirecionar após 2 segundos
          setTimeout(() => {
            router.push("/therapist/dashboard");
          }, 2000);
        }
      } catch (err) {
        console.error("Erro ao verificar documentos:", err);
        // Se erro de autorização, provavelmente o perfil não existe ainda - ok continuar
        if (err instanceof Error && err.message.includes("401")) {
          console.log("Perfil não encontrado, continuando para upload");
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkDocuments();
  }, [user, router, apiCall]);

  // Se já tem documentos, mostrar mensagem
  if (hasDocuments) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md mx-auto">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Documentos já enviados!</h2>
          <p className="text-gray-600 mb-4">
            Seus documentos já foram enviados e estão aguardando validação.
          </p>
          <button
            onClick={() => router.push("/therapist/dashboard")}
            className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e]"
          >
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
    
    if (file.type !== "application/pdf") {
      setError("Apenas arquivos PDF são aceitos");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Arquivo muito grande. Máximo 10MB");
      return;
    }
    
    if (type === "diploma") {
      setDiplomaFile(file);
    } else {
      setRegistrationFile(file);
    }
    setError("");
    
    if (diplomaFile && registrationFile) {
      setStep(3);
    } else if ((type === "diploma" && diplomanFile) || (type === "registration" && registrationFile)) {
      setStep(2);
    }
  };

  const uploadDocument = async (type: string, file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", type);

    const token = localStorage.getItem("access_token");
    
    // 🔥 USAR URL COMPLETA DO BACKEND
    const response = await fetch(`${BACKEND_URL}/api/therapist/documents/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Erro ao enviar ${type}`);
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!diplomaFile || !registrationFile) {
      setError("Você precisa enviar ambos os documentos");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      await uploadDocument("diploma", diplomaFile);
      await uploadDocument("registration", registrationFile);
      
      setSuccess("Documentos enviados com sucesso! Aguarde a validação da nossa equipe.");
      
      setTimeout(() => {
        router.push("/therapist/dashboard");
      }, 3000);
    } catch (err: any) {
      console.error("Erro no upload:", err);
      setError(err.message || "Erro ao enviar documentos");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2F80D3] to-[#E03673] text-white p-6 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3" />
            <h1 className="text-2xl font-bold">Complete seu cadastro</h1>
            <p className="text-white/80 mt-2">
              Para garantir a qualidade dos nossos serviços, precisamos validar seus documentos profissionais
            </p>
          </div>

          {/* Conteúdo */}
          <div className="p-6">
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

            {/* Passo a passo */}
            <div className="flex items-center justify-between mb-8">
              <div className={`flex-1 text-center ${step >= 1 ? "text-[#E03673]" : "text-gray-400"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${step >= 1 ? "bg-[#E03673] text-white" : "bg-gray-200 text-gray-500"}`}>
                  1
                </div>
                <span className="text-xs">Diploma</span>
              </div>
              <div className={`w-12 h-0.5 ${step >= 2 ? "bg-[#E03673]" : "bg-gray-200"}`} />
              <div className={`flex-1 text-center ${step >= 2 ? "text-[#E03673]" : "text-gray-400"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${step >= 2 ? "bg-[#E03673] text-white" : "bg-gray-200 text-gray-500"}`}>
                  2
                </div>
                <span className="text-xs">Registro</span>
              </div>
              <div className={`w-12 h-0.5 ${step >= 3 ? "bg-[#E03673]" : "bg-gray-200"}`} />
              <div className={`flex-1 text-center ${step >= 3 ? "text-[#E03673]" : "text-gray-400"}`}>
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${step >= 3 ? "bg-[#E03673] text-white" : "bg-gray-200 text-gray-500"}`}>
                  3
                </div>
                <span className="text-xs">Finalizar</span>
              </div>
            </div>

            {/* Upload do Diploma */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Diploma / Comprovante de Formação *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Envie seu diploma de graduação ou especialização
                </p>
                <p className="text-xs text-gray-400 mb-3">Formato PDF, até 10MB</p>
                
                <input
                  id="diploma-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange("diploma", e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  onClick={() => document.getElementById("diploma-upload")?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] transition-colors inline-flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Selecionar arquivo
                </button>
                
                {diplomaFile && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ {diplomaFile.name}
                  </div>
                )}
              </div>
            </div>

            {/* Upload do Registro Profissional */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registro Profissional (Ex.: CRP, ONP e Outros) *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">
                  Envie seu registro profissional (CRP)
                </p>
                <p className="text-xs text-gray-400 mb-3">Formato PDF, até 10MB</p>
                
                <input
                  id="registration-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => handleFileChange("registration", e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={uploading}
                />
                <button
                  onClick={() => document.getElementById("registration-upload")?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-[#2F80D3] text-white rounded-lg hover:bg-[#236bb3] transition-colors inline-flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Selecionar arquivo
                </button>
                
                {registrationFile && (
                  <div className="mt-2 text-sm text-green-600">
                    ✓ {registrationFile.name}
                  </div>
                )}
              </div>
            </div>

            {/* Botão finalizar */}
            <button
              onClick={handleSubmit}
              disabled={!diplomaFile || !registrationFile || uploading}
              className="w-full py-3 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Finalizar cadastro
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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