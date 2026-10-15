"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Loader2, CheckCircle, AlertCircle, Shield, ArrowRight, RotateCcw, XCircle } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.meudivaonline.com";

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const cfg: Record<string, { bg: string; color: string; icon: any; label: string }> = {
    approved:     { bg: "#D1FAE5", color: "#065F46", icon: CheckCircle, label: "Aprovado" },
    rejected:     { bg: "#FEE2E2", color: "#991B1B", icon: XCircle,     label: "Reprovado" },
    need_reupload:{ bg: "#FEF3C7", color: "#92400E", icon: RotateCcw,   label: "Reenvio solicitado" },
    pending:      { bg: "#FEF3C7", color: "#92400E", icon: Loader2,     label: "Pendente" },
  };
  const s = cfg[status] || cfg.pending;
  const Icon = s.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: s.bg, color: s.color }}>
      <Icon size={10} /> {s.label}
    </span>
  );
}

export default function MobileTerapeutaDocumentosPage() {
  const router = useRouter();
  const diplomaRef = useRef<HTMLInputElement>(null);
  const registrationRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [diplomaStatus, setDiplomaStatus] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/therapist/documents/status");
        const diploma = data.documents?.find((d: any) => d.type === "diploma");
        const registration = data.documents?.find((d: any) => d.type === "registration");
        setDiplomaStatus(diploma?.validation_status || null);
        setRegistrationStatus(registration?.validation_status || null);
        const reasons: Record<string, string> = {};
        if (diploma?.rejection_reason) reasons.diploma = diploma.rejection_reason;
        if (registration?.rejection_reason) reasons.registration = registration.rejection_reason;
        setRejectionReasons(reasons);
        const allOk = diploma && registration &&
          diploma.validation_status !== "need_reupload" && diploma.validation_status !== "rejected" &&
          registration.validation_status !== "need_reupload" && registration.validation_status !== "rejected";
        if (allOk) setTimeout(() => router.push("/mobile/dashboard"), 2000);
      } catch { setError("Erro ao verificar documentos."); }
      finally { setLoading(false); }
    })();
  }, [router]);

  const handleFile = (type: "diploma" | "registration", file: File | null) => {
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Apenas PDFs são aceitos."); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Arquivo muito grande. Máximo 10MB."); return; }
    if (type === "diploma") setDiplomaFile(file);
    else setRegistrationFile(file);
    setError("");
  };

  const uploadDoc = async (type: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("document_type", type);
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${BACKEND_URL}/api/therapist/documents/upload`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
    });
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Erro ao enviar ${type}`); }
  };

  const needsDiploma = !diplomaStatus || diplomaStatus === "need_reupload" || diplomaStatus === "rejected";
  const needsRegistration = !registrationStatus || registrationStatus === "need_reupload" || registrationStatus === "rejected";
  const needsReupload = (diplomaStatus === "need_reupload" || diplomaStatus === "rejected") ||
    (registrationStatus === "need_reupload" || registrationStatus === "rejected");

  const handleSubmit = async () => {
    if (needsDiploma && !diplomaFile) { setError("Envie o Diploma."); return; }
    if (needsRegistration && !registrationFile) { setError("Envie o Registro Profissional."); return; }
    setUploading(true); setError(""); setSuccess("");
    try {
      if (needsDiploma && diplomaFile) await uploadDoc("diploma", diplomaFile);
      if (needsRegistration && registrationFile) await uploadDoc("registration", registrationFile);
      setSuccess("Documentos enviados! Aguarde a validação da nossa equipe.");
      setTimeout(() => router.push("/mobile/dashboard"), 3000);
    } catch (e: any) { setError(e.message || "Erro ao enviar documentos."); }
    finally { setUploading(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={32} className="animate-spin" color={COLORS.primary} />
    </div>
  );

  if (!needsDiploma && !needsRegistration) return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, textAlign: "center", maxWidth: 360, width: "100%" }}>
        <CheckCircle size={48} color="#059669" style={{ margin: "0 auto 16px" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark, marginBottom: 8 }}>Documentos enviados!</div>
        <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 20 }}>Seus documentos estão aguardando validação.</div>
        <button onClick={() => router.push("/mobile/dashboard")} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Ir para o Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${COLORS.secondary}, ${COLORS.primary})`, padding: "32px 20px 24px", textAlign: "center" }}>
        <Shield size={40} color="white" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 6 }}>
          {needsReupload ? "Reenvio de documentos" : "Complete seu cadastro"}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
          {needsReupload
            ? "Um ou mais documentos precisam ser reenviados"
            : "Precisamos validar seus documentos profissionais"}
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {/* Diploma */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Diploma / Comprovante de Formação</div>
            <StatusBadge status={diplomaStatus} />
          </div>

          {(diplomaStatus === "rejected" || diplomaStatus === "need_reupload") && rejectionReasons.diploma && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#92400E", marginBottom: 10 }}>
              <strong>Motivo:</strong> {rejectionReasons.diploma}
            </div>
          )}

          {needsDiploma ? (
            <div style={{ border: "2px dashed #E5E7EB", borderRadius: 12, padding: 20, textAlign: "center" }}>
              <FileText size={36} color="#9CA3AF" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>PDF · máximo 10MB</div>
              <input ref={diplomaRef} type="file" accept=".pdf" style={{ display: "none" }}
                onChange={e => handleFile("diploma", e.target.files?.[0] || null)} disabled={uploading} />
              <button onClick={() => diplomaRef.current?.click()} disabled={uploading}
                style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> Selecionar arquivo
              </button>
              {diplomaFile && <div style={{ marginTop: 8, fontSize: 13, color: "#059669" }}>✓ {diplomaFile.name}</div>}
            </div>
          ) : (
            <div style={{ background: "#D1FAE5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#065F46", display: "flex", gap: 8, alignItems: "center" }}>
              <CheckCircle size={16} /> Enviado — aguardando validação
            </div>
          )}
        </div>

        {/* Registro Profissional */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Registro Profissional (CRP, ONP etc.)</div>
            <StatusBadge status={registrationStatus} />
          </div>

          {(registrationStatus === "rejected" || registrationStatus === "need_reupload") && rejectionReasons.registration && (
            <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#92400E", marginBottom: 10 }}>
              <strong>Motivo:</strong> {rejectionReasons.registration}
            </div>
          )}

          {needsRegistration ? (
            <div style={{ border: "2px dashed #E5E7EB", borderRadius: 12, padding: 20, textAlign: "center" }}>
              <FileText size={36} color="#9CA3AF" style={{ margin: "0 auto 8px" }} />
              <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 12 }}>PDF · máximo 10MB</div>
              <input ref={registrationRef} type="file" accept=".pdf" style={{ display: "none" }}
                onChange={e => handleFile("registration", e.target.files?.[0] || null)} disabled={uploading} />
              <button onClick={() => registrationRef.current?.click()} disabled={uploading}
                style={{ background: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Upload size={14} /> Selecionar arquivo
              </button>
              {registrationFile && <div style={{ marginTop: 8, fontSize: 13, color: "#059669" }}>✓ {registrationFile.name}</div>}
            </div>
          ) : (
            <div style={{ background: "#D1FAE5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#065F46", display: "flex", gap: 8, alignItems: "center" }}>
              <CheckCircle size={16} /> Enviado — aguardando validação
            </div>
          )}
        </div>

        <button onClick={handleSubmit}
          disabled={(needsDiploma && !diplomaFile) || (needsRegistration && !registrationFile) || uploading}
          style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: ((needsDiploma && !diplomaFile) || (needsRegistration && !registrationFile) || uploading) ? 0.5 : 1 }}>
          {uploading ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : <><ArrowRight size={18} />{needsReupload ? "Reenviar documentos" : "Finalizar cadastro"}</>}
        </button>

        <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
          Seus documentos serão analisados pela nossa equipe. Você será notificado quando for aprovado.
        </div>
      </div>
    </div>
  );
}
