"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PhotoUploadButton } from "@/components/ui/PhotoUploadButton";

import { EmailChangeModal } from '@/components/ui/EmailChangeModal';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  User, 
  Calendar,
  Phone,
  IdCard,
  School,
  Building2,
  Briefcase,
  ArrowLeft,
  Camera,
  Mail
} from "lucide-react";

interface AdminProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone: string | null;
  cpf: string | null;
  birth_date: string | null;
  education_level: string | null;
  foto_url: string | null;
  department: string | null;
  position: string | null;
  created_at: string;
  updated_at: string | null;
}

const educationLevelOptions = [
  "Ensino Fundamental incompleto",
  "Ensino Fundamental completo",
  "Ensino Médio incompleto",
  "Ensino Médio completo",
  "Ensino Superior incompleto",
  "Ensino Superior completo",
  "Pós-graduação (especialização)",
  "Mestrado",
  "Doutorado"
];

const departmentOptions = [
  "Administração", "Suporte", "Financeiro", "Desenvolvimento",
  "Atendimento", "Marketing", "RH", "Jurídico"
];

const positionOptions = [
  "Administrador", "Coordenador", "Analista", "Desenvolvedor",
  "Suporte Técnico", "Atendimento", "Financeiro"
];

export default function AdminProfilePage() {
  const { user, loadMe } = useAuth();
  
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    cpf: "",
    birth_date: "",
    education_level: "",
    department: "",
    position: ""
  });

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        cpf: profile.cpf || "",
        birth_date: profile.birth_date || "",
        education_level: profile.education_level || "",
        department: profile.department || "",
        position: profile.position || ""
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
      const data = await apiCall({ url: "/api/admin/profile/me", requireAuth: true });
      setProfile(data);
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
      setError("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChangeSuccess = (newEmail: string) => {
    if (typeof loadMe === 'function') loadMe();
    setSuccess("E-mail alterado com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === "cpf") value = formatCpf(value);
    else if (field === "phone") value = formatPhone(value);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
    return value;
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
    }
    return value;
  };

  const salvarPerfil = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (formData.full_name !== user?.full_name) {
        await apiCall({
          url: "/api/users/me",
          method: "PATCH",
          body: { full_name: formData.full_name },
          requireAuth: true
        });
      }
      await apiCall({
        url: "/api/admin/profile/me",
        method: "POST",
        body: {
          full_name: formData.full_name,
          phone: formData.phone || null,
          cpf: formData.cpf || null,
          birth_date: formData.birth_date || null,
          education_level: formData.education_level || null,
          department: formData.department || null,
          position: formData.position || null,

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

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-[#E03673]" />
            <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
          </div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />Voltar ao dashboard
          </Link>
        </div>
        <p className="text-sm text-gray-600 mt-1">Gerencie suas informações de administrador</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

        <form onSubmit={(e) => { e.preventDefault(); salvarPerfil(); }} className="space-y-6">

          {/* ✅ FOTO — PhotoUploadButton universal */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Camera className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Foto de Perfil</h2>
            </div>
            <div className="flex items-center gap-6">
              <PhotoUploadButton
                currentPhotoUrl={fotoUrl}
                endpoint="/api/admin/profile/upload-foto"
                onSuccess={(url) => {
                  setFotoUrl(url);
                  
                  setSuccess("Foto atualizada com sucesso!");
                  setTimeout(() => setSuccess(""), 3000);
                }}
                onError={(msg) => setError(msg)}
                size={96}
                name={formData.full_name}
                avatarBgClass="bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80"
              />
              <div>
                <p className="text-sm text-gray-600">Clique no ícone da câmera para alterar sua foto</p>
                <p className="text-xs text-gray-400 mt-1">Formatos aceitos: JPG, PNG, GIF, WEBP (máx. 5MB)</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Informações Básicas</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input type="text" value={formData.full_name} onChange={(e) => handleChange("full_name", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <div className="flex items-center gap-2">
                  <input type="email" value={user?.email || ""} className="flex-1 p-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500" disabled />
                  <button type="button" onClick={() => setShowEmailModal(true)} className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap">
                    <Mail className="w-4 h-4" />Alterar e-mail
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="w-4 h-4" />Telefone
                  </label>
                  <input type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <IdCard className="w-4 h-4" />CPF
                  </label>
                  <input type="text" value={formData.cpf} onChange={(e) => handleChange("cpf", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" placeholder="000.000.000-00" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />Data de nascimento
                  </label>
                  <input type="date" value={formData.birth_date} onChange={(e) => handleChange("birth_date", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <School className="w-4 h-4" />Escolaridade
                  </label>
                  <select value={formData.education_level} onChange={(e) => handleChange("education_level", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                    <option value="">Selecione</option>
                    {educationLevelOptions.map(level => <option key={level} value={level}>{level}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Informações Profissionais</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />Departamento
                </label>
                <select value={formData.department} onChange={(e) => handleChange("department", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Selecione</option>
                  {departmentOptions.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />Cargo
                </label>
                <select value={formData.position} onChange={(e) => handleChange("position", e.target.value)} className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none">
                  <option value="">Selecione</option>
                  {positionOptions.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => router.back()} className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : <><CheckCircle className="w-4 h-4" />Salvar alterações</>}
            </button>
          </div>
        </form>
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