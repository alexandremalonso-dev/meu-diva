"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhotoUploadButton } from "@/components/ui/PhotoUploadButton";

import { EmailChangeModal } from '@/components/ui/EmailChangeModal';
import { EmpresaAddressForm } from '@/components/empresa/profile/EmpresaAddressForm';
import { 
  Loader2, AlertCircle, CheckCircle, User, Calendar, Phone, IdCard,
  School, Building2, Briefcase, ArrowLeft, Camera, X, Mail, FileText,
  Shield, FileCheck, AlertTriangle, Home, MapPin, Info, Eye, EyeOff,
  Plus, Trash2
} from "lucide-react";

interface EmpresaProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone: string | null;
  cnpj: string | null;
  corporate_name: string | null;
  trading_name: string | null;
  state_registration: string | null;
  municipal_registration: string | null;
  birth_date: string | null;
  education_level: string | null;
  foto_url: string | null;
  department: string | null;
  position: string | null;
  cpf: string | null;
  responsible_email: string | null;
  responsible_phone: string | null;
  created_at: string;
  updated_at: string | null;
}

interface Documento {
  id: number;
  type: string;
  url: string;
  filename: string;
  validation_status: "pending" | "approved" | "rejected" | "need_reupload";
  rejection_reason?: string;
  uploaded_at: string;
}

interface Endereco {
  id: number;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  is_primary: boolean;
}

const educationLevelOptions = [
  "Ensino Fundamental incompleto", "Ensino Fundamental completo",
  "Ensino Médio incompleto", "Ensino Médio completo",
  "Ensino Superior incompleto", "Ensino Superior completo",
  "Pós-graduação (especialização)", "Mestrado", "Doutorado"
];
const departmentOptions = ["Administração", "Financeiro", "RH", "Comercial", "Marketing", "Operações", "Tecnologia", "Jurídico"];
const positionOptions = ["Diretor", "Gerente", "Coordenador", "Analista", "Assistente", "Administrador", "Responsável Legal"];

const DOCUMENT_TYPES = [
  { value: "contrato_social", label: "Contrato Social", required: true },
  { value: "cartao_cnpj", label: "Cartão CNPJ", required: true },
  { value: "comprovante_endereco", label: "Comprovante de Endereço", required: true },
  { value: "documento_socio", label: "Documento do Sócio", required: true },
  { value: "certidao_federal", label: "Certidão Federal (INSS)", required: false },
  { value: "certidao_fgts", label: "Certidão FGTS", required: false },
  { value: "certidao_trabalhista", label: "Certidão Trabalhista (CNDT)", required: false }
];

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const getDocumentTypeLabel = (type: string) => DOCUMENT_TYPES.find(d => d.value === type)?.label || type;

const getStatusBadge = (status: string) => {
  switch (status) {
    case "approved": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> Aprovado</span>;
    case "rejected": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700"><X className="w-3 h-3" /> Reprovado</span>;
    case "need_reupload": return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3" /> Reenviar</span>;
    default: return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Pendente</span>;
  }
};

type TabType = "dados" | "enderecos" | "documentos" | "lgpd";

export default function EmpresaProfilePage() {
  const { user, loadMe } = useAuth();
  
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [activeTab, setActiveTab] = useState<TabType>("dados");
  const [profile, setProfile] = useState<EmpresaProfile | null>(null);
  const [documents, setDocuments] = useState<Documento[]>([]);
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showCnpj, setShowCnpj] = useState(false);
  const [showCpf, setShowCpf] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [lgpdConsentDate, setLgpdConsentDate] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Endereco | null>(null);

  const [formData, setFormData] = useState({
    full_name: "", phone: "", cnpj: "", corporate_name: "", trading_name: "",
    state_registration: "", municipal_registration: "", birth_date: "",
    education_level: "", department: "", position: "", cpf: "",
    responsible_email: "", responsible_phone: ""
  });

  useEffect(() => { loadProfile(); loadDocuments(); loadEnderecos(); }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "", phone: profile.phone || "",
        cnpj: profile.cnpj || "", corporate_name: profile.corporate_name || "",
        trading_name: profile.trading_name || "", state_registration: profile.state_registration || "",
        municipal_registration: profile.municipal_registration || "", birth_date: profile.birth_date || "",
        education_level: profile.education_level || "", department: profile.department || "",
        position: profile.position || "", cpf: profile.cpf || "",
        responsible_email: profile.responsible_email || "", responsible_phone: profile.responsible_phone || ""
      });
      // ✅ Só atualiza fotoUrl se o banco tiver URL — nunca sobrescreve com null
      if (profile.foto_url) {
        setFotoUrl(profile.foto_url);
      }
    }
  }, [profile]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiCall({ url: "/api/empresa/profile/me", requireAuth: true });
      setProfile(data);
      setLgpdConsent(data.lgpd_consent || false);
      setLgpdConsentDate(data.lgpd_consent_date);
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      setError("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const data = await apiCall({ url: "/api/empresa/documents", requireAuth: true });
      setDocuments(data || []);
    } catch (err) { console.error("Erro ao carregar documentos:", err); }
  };

  const loadEnderecos = async () => {
    try {
      const data = await apiCall({ url: "/api/empresa/enderecos", requireAuth: true });
      setEnderecos(data || []);
    } catch (err) { console.error("Erro ao carregar endereços:", err); }
  };

  const handleEmailChangeSuccess = (newEmail: string) => {
    if (typeof loadMe === 'function') loadMe();
    setSuccess("E-mail de login alterado com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleUploadDocument = async (file: File, documentType: string) => {
    setUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    formDataUpload.append("document_type", documentType);
    try {
      const response = await fetch(`${BACKEND_URL}/api/empresa/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: formDataUpload
      });
      if (response.ok) {
        setSuccess(`Documento ${getDocumentTypeLabel(documentType)} enviado com sucesso!`);
        await loadDocuments();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || "Erro ao enviar documento");
      }
    } catch (err) {
      setError("Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEndereco = async (endereco: Endereco) => {
    try {
      await apiCall({ url: "/api/empresa/enderecos", method: "POST", body: endereco, requireAuth: true });
      setSuccess("Endereço adicionado com sucesso!");
      loadEnderecos();
      setShowAddressForm(false);
      setEditingAddress(null);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar endereço");
    }
  };

  const handleDeleteEndereco = async (id: number) => {
    if (!confirm("Deseja remover este endereço?")) return;
    try {
      await apiCall({ url: `/api/empresa/enderecos/${id}`, method: "DELETE", requireAuth: true });
      setSuccess("Endereço removido com sucesso!");
      loadEnderecos();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao remover endereço");
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === "cnpj") value = formatCnpj(value);
    else if (field === "phone" || field === "responsible_phone") value = formatPhone(value);
    else if (field === "cpf") value = formatCpf(value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    const n = value.replace(/\D/g, '');
    if (n.length <= 11) {
      if (n.length <= 2) return n;
      if (n.length <= 7) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
      return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
    }
    return value;
  };

  const formatCnpj = (value: string) => {
    const n = value.replace(/\D/g, '');
    if (n.length <= 14) {
      if (n.length <= 2) return n;
      if (n.length <= 5) return `${n.slice(0, 2)}.${n.slice(2)}`;
      if (n.length <= 8) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5)}`;
      if (n.length <= 12) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8)}`;
      return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/${n.slice(8, 12)}-${n.slice(12, 14)}`;
    }
    return value;
  };

  const formatCpf = (value: string) => {
    const n = value.replace(/\D/g, '');
    if (n.length <= 11) {
      if (n.length <= 3) return n;
      if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
      if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
      return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9, 11)}`;
    }
    return value;
  };

  const salvarPerfil = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (formData.full_name !== user?.full_name) {
        await apiCall({ url: "/api/users/me", method: "PATCH", body: { full_name: formData.full_name }, requireAuth: true });
      }
      await apiCall({
        url: "/api/empresa/profile/me",
        method: "POST",
        body: {
          full_name: formData.full_name, phone: formData.phone || null,
          cnpj: formData.cnpj || null, corporate_name: formData.corporate_name || null,
          trading_name: formData.trading_name || null, state_registration: formData.state_registration || null,
          municipal_registration: formData.municipal_registration || null, birth_date: formData.birth_date || null,
          education_level: formData.education_level || null, department: formData.department || null,
          position: formData.position || null,

          cpf: formData.cpf || null, responsible_email: formData.responsible_email || null,
          responsible_phone: formData.responsible_phone || null, lgpd_consent: lgpdConsent
        },
        requireAuth: true
      });
      if (typeof loadMe === 'function') await loadMe();
      await loadProfile();
      setSuccess("Perfil atualizado com sucesso!");
    } catch (err: any) {
      console.error("❌ Erro ao salvar:", err);
      setError(err.message || "Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const salvarLgpd = async () => {
    setSaving(true);
    try {
      await apiCall({ url: "/api/empresa/profile/lgpd", method: "POST", body: { consent: lgpdConsent }, requireAuth: true });
      setSuccess("Preferências de privacidade atualizadas!");
      if (lgpdConsent && !lgpdConsentDate) setLgpdConsentDate(new Date().toISOString());
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar preferências");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Perfil da Empresa</h1>
          </div>
          <Link href="/empresa/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />Voltar
          </Link>
        </div>
        <p className="text-sm text-gray-600 mt-1">Gerencie as informações da sua empresa</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />{error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />{success}
          </div>
        )}

        {/* TABS */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            {([
              { key: "dados", icon: Building2, label: "Dados da Empresa" },
              { key: "enderecos", icon: MapPin, label: "Endereços" },
              { key: "documentos", icon: FileText, label: "Documentos" },
              { key: "lgpd", icon: Shield, label: "LGPD e Privacidade" },
            ] as const).map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`pb-3 px-2 text-sm font-medium transition-colors ${activeTab === key ? "border-b-2 border-[#E03673] text-[#E03673]" : "text-gray-500 hover:text-gray-700"}`}>
                <Icon className="w-4 h-4 inline mr-2" />{label}
              </button>
            ))}
          </nav>
        </div>

        {/* ABA 1: DADOS */}
        {activeTab === "dados" && (
          <form onSubmit={(e) => { e.preventDefault(); salvarPerfil(); }} className="space-y-6">

            {/* ✅ LOGO — PhotoUploadButton universal */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Camera className="w-5 h-5 text-[#E03673]" />
                <h2 className="text-lg font-semibold">Logo da Empresa</h2>
              </div>
              <div className="flex items-center gap-6">
                <PhotoUploadButton
                  currentPhotoUrl={fotoUrl}
                  endpoint="/api/empresa/profile/upload-foto"
                  onSuccess={(url) => {
                    setFotoUrl(url);
                    
                    setSuccess("Logo atualizada com sucesso!");
                    setTimeout(() => setSuccess(""), 3000);
                  }}
                  onError={(msg) => setError(msg)}
                  size={96}
                  name={formData.trading_name || formData.corporate_name || formData.full_name}
                  avatarBgClass="bg-gradient-to-br from-[#6366f1] to-[#4f46e5]"
                />
                <div>
                  <p className="text-sm text-gray-600">Clique no ícone da câmera para alterar a logo</p>
                  <p className="text-xs text-gray-400 mt-1">Formatos aceitos: JPG, PNG, GIF, WEBP (máx. 5MB)</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-[#E03673]" />
                <h2 className="text-lg font-semibold">Informações da Empresa</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                  <input type="text" value={formData.corporate_name} onChange={(e) => handleChange("corporate_name", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                  <input type="text" value={formData.trading_name} onChange={(e) => handleChange("trading_name", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                    <div className="relative">
                      <input type="text" value={formData.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="00.000.000/0000-00" />
                      <button type="button" onClick={() => setShowCnpj(!showCnpj)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {showCnpj ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone da empresa</label>
                    <input type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Estadual</label>
                    <input type="text" value={formData.state_registration} onChange={(e) => handleChange("state_registration", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="Digite 'Isento' se for o caso" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Municipal</label>
                    <input type="text" value={formData.municipal_registration} onChange={(e) => handleChange("municipal_registration", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-5 h-5 text-[#E03673]" />
                <h2 className="text-lg font-semibold">Responsável Legal</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                  <input type="text" value={formData.full_name} onChange={(e) => handleChange("full_name", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de nascimento</label>
                    <input type="date" value={formData.birth_date} onChange={(e) => handleChange("birth_date", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Escolaridade</label>
                    <select value={formData.education_level} onChange={(e) => handleChange("education_level", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                      <option value="">Selecione</option>
                      {educationLevelOptions.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                    <div className="relative">
                      <input type="text" value={formData.cpf} onChange={(e) => handleChange("cpf", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="000.000.000-00" />
                      <button type="button" onClick={() => setShowCpf(!showCpf)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                        {showCpf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone do responsável</label>
                    <input type="tel" value={formData.responsible_phone} onChange={(e) => handleChange("responsible_phone", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail do responsável legal <span className="text-xs text-gray-400 ml-1">(pode ser diferente do e-mail de login)</span>
                  </label>
                  <input type="email" value={formData.responsible_email} onChange={(e) => handleChange("responsible_email", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="responsavel@empresa.com.br" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <select value={formData.department} onChange={(e) => handleChange("department", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                      <option value="">Selecione</option>
                      {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <select value={formData.position} onChange={(e) => handleChange("position", e.target.value)} className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                      <option value="">Selecione</option>
                      {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">E-mail de login (usuário)</span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-gray-600">{user?.email}</p>
                <button type="button" onClick={() => setShowEmailModal(true)} className="text-xs text-[#E03673] hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3" />Alterar e-mail de login
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Este é o e-mail usado para acessar a plataforma</p>
            </div>

            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => router.back()} className="px-6 py-2 border rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" disabled={saving} className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><CheckCircle className="w-4 h-4" />Salvar alterações</>}
              </button>
            </div>
          </form>
        )}

        {/* ABA 2: ENDEREÇOS */}
        {activeTab === "enderecos" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-[#E03673]" />
                <h2 className="text-lg font-semibold">Endereços da Empresa</h2>
              </div>
              <button onClick={() => setShowAddressForm(true)} className="flex items-center gap-2 px-3 py-1.5 bg-[#E03673] text-white rounded-lg text-sm hover:bg-[#c02c5e] transition-colors">
                <Plus className="w-4 h-4" />Novo Endereço
              </button>
            </div>
            {enderecos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum endereço cadastrado</p>
                <button onClick={() => setShowAddressForm(true)} className="mt-2 text-sm text-[#E03673] hover:underline">Adicionar endereço</button>
              </div>
            ) : (
              <div className="space-y-4">
                {enderecos.map((end) => (
                  <div key={end.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{end.logradouro}, {end.numero}</p>
                        <p className="text-sm text-gray-500">{end.bairro} - {end.cidade}/{end.uf}</p>
                        <p className="text-sm text-gray-500">CEP: {end.cep}</p>
                        {end.complemento && <p className="text-sm text-gray-500">Complemento: {end.complemento}</p>}
                      </div>
                      <div className="flex gap-2">
                        {end.is_primary && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Principal</span>}
                        <button onClick={() => handleDeleteEndereco(end.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showAddressForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
                  <div className="p-4 bg-[#E03673] text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      <h3 className="text-lg font-semibold">Adicionar Endereço</h3>
                    </div>
                    <button onClick={() => setShowAddressForm(false)} className="p-1 text-white hover:bg-white/20 rounded-lg">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-5">
                    <EmpresaAddressForm onSave={handleSaveEndereco} onCancel={() => setShowAddressForm(false)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ABA 3: DOCUMENTOS */}
        {activeTab === "documentos" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Documentos da Empresa</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Envie a documentação necessária para validação. Os documentos serão analisados pela nossa equipe.</p>
            <div className="space-y-4">
              {DOCUMENT_TYPES.map((doc) => {
                const existingDoc = documents.find(d => d.type === doc.value);
                return (
                  <div key={doc.value} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="font-medium">{doc.label}{doc.required && <span className="text-red-500 ml-1">*</span>}</p>
                        {existingDoc ? (
                          <div className="flex items-center gap-2 mt-1">
                            <FileCheck className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-gray-500">{existingDoc.filename}</span>
                            {getStatusBadge(existingDoc.validation_status)}
                            {existingDoc.rejection_reason && <p className="text-xs text-red-500 mt-1">{existingDoc.rejection_reason}</p>}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 mt-1">Nenhum arquivo enviado</p>
                        )}
                      </div>
                      <label className="px-3 py-1.5 bg-[#E03673] text-white text-sm rounded-lg cursor-pointer">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Enviar arquivo"}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUploadDocument(e.target.files[0], doc.value); }} disabled={uploading} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ABA 4: LGPD */}
        {activeTab === "lgpd" && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Privacidade e LGPD</h2>
            </div>
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={lgpdConsent} onChange={(e) => setLgpdConsent(e.target.checked)} className="h-5 w-5 text-[#E03673] rounded mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Autorizo o tratamento dos dados da minha empresa conforme a LGPD</p>
                    <p className="text-xs text-gray-500 mt-1">Seus dados serão utilizados apenas para fins de faturamento e registro.</p>
                  </div>
                </label>
                {lgpdConsentDate && (
                  <p className="text-xs text-gray-400 mt-2">Consentimento registrado em {new Date(lgpdConsentDate).toLocaleDateString('pt-BR')}</p>
                )}
              </div>
              <div className="flex justify-end">
                <button onClick={salvarLgpd} disabled={saving} className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] disabled:opacity-50 flex items-center gap-2">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><CheckCircle className="w-4 h-4" />Salvar preferências</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <EmailChangeModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        currentEmail={user?.email || ""}
        onSuccess={handleEmailChangeSuccess}
      />
    </>
  );
}