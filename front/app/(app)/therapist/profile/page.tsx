"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PhotoUploadButton } from "@/components/ui/PhotoUploadButton";

import { TherapistAddressList } from '@/components/therapist/profile/TherapistAddressList';
import { EmailChangeModal } from '@/components/ui/EmailChangeModal';
import { AccountDeletionModal } from "@/components/ui/AccountDeletionModal";
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  User, 
  Briefcase, 
  DollarSign, 
  Instagram,
  Clock,
  Shield,
  Star,
  Languages,
  Heart,
  GraduationCap,
  Search,
  Phone,
  Calendar,
  PenTool,
  Video,
  Building2,
  CreditCard,
  QrCode,
  Eye,
  EyeOff,
  Info,
  IdCard,
  School,
  Award,
  Home,
  Mail,
  AlertTriangle,
  Trash2,
  ChevronDown,
  ChevronUp
} from "lucide-react";

type TherapistProfile = {
  id: number;
  user_id: number;
  bio: string | null;
  specialties: string | null;
  session_price: number | null;
  foto_url?: string | null;
  experiencia?: string | null;
  abordagem?: string | null;
  idiomas?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  lgbtqia_ally?: boolean;
  formation?: string | null;
  education_level?: string | null;
  treatment?: string | null;
  approaches?: string[] | null;
  specialties_list?: string[] | null;
  reasons?: string[] | null;
  service_types?: string[] | null;
  languages_list?: string[] | null;
  rating_distribution?: Record<string, number> | null;
  total_sessions?: number;
  verified?: boolean;
  featured?: boolean;
  instagram_url?: string | null;
  session_duration_30min?: boolean;
  session_duration_50min?: boolean;
  phone?: string | null;
  birth_date?: string | null;
  show_phone_to_patients?: boolean;
  show_birth_date_to_patients?: boolean;
  signature_url?: string | null;
  video_url?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  pix_key_type?: string | null;
  pix_key?: string | null;
  lgpd_consent?: boolean;
  lgpd_consent_date?: string | null;
  payment_change_deadline?: string | null;
  payment_change_deadline_message?: string | null;
  accepts_corporate_sessions?: boolean;
  user?: {
    full_name: string;
    email: string;
  };
};

type UserData = {
  id: number;
  formatted_id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
};

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

const treatmentOptions = [
  { value: "Dr.", label: "Dr." },
  { value: "Dra.", label: "Dra." },
  { value: "Sr.", label: "Sr." },
  { value: "Sra.", label: "Sra." }
];

export default function TherapistProfilePage() {
  const { user, loadMe } = useAuth();
  
  const [profile, setProfile] = useState<TherapistProfile | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [showDeletionSection, setShowDeletionSection] = useState(false);
  
  const [showCpf, setShowCpf] = useState(false);
  const [showCnpj, setShowCnpj] = useState(false);
  
  const genderOptions = ["homem", "mulher", "nao_binario", "genero_fluido"];
  const ethnicityOptions = ["branca", "preta", "parda", "amarela", "indigena"];
  const formationOptions = ["doutorado", "mestrado", "especializacao", "pos_graduacao"];
  const approachOptions = [
    "Psicanálise", "Cognitivo-Comportamental", "Humanista", "Gestalt", 
    "Fenomenológica", "Corporal", "Junguiana", "Logoterapia", "Neuropsicanálise",
    "Psicanálise Winnicottiana", "Terapia de Casal", "Terapia Familiar"
  ];
  const reasonOptions = [
    "Ansiedade", "Depressão", "Relacionamentos", "Autoestima", "Estresse",
    "Burnout", "Luto", "Trauma", "Fobias", "TOC", "Pânico", "Dependência Química",
    "Transtornos Alimentares", "Sexualidade", "Gênero", "Abuso", "Violência"
  ];
  const serviceTypeOptions = [
    "psicologo", "psicanalista", "coach", "nutricionista", "psiquiatra", "terapeuta"
  ];
  const languageOptions = ["Português", "Inglês", "Espanhol", "Francês", "Alemão", "Italiano", "Mandarim", "Japonês"];
  const pixKeyTypeOptions = [
    { value: "cpf", label: "CPF" },
    { value: "cnpj", label: "CNPJ" },
    { value: "email", label: "E-mail" },
    { value: "phone", label: "Telefone" },
    { value: "random", label: "Chave aleatória" }
  ];

  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    specialties: "",
    session_price: "",
    experiencia: "",
    abordagem: "",
    idiomas: "",
    gender: "",
    ethnicity: "",
    lgbtqia_ally: false,
    formation: "",
    education_level: "",
    treatment: "",
    approaches: [] as string[],
    specialties_list: [] as string[],
    reasons: [] as string[],
    service_types: [] as string[],
    languages_list: [] as string[],
    instagram_url: "",
    session_duration_30min: true,
    session_duration_50min: true,
    phone: "",
    birth_date: "",
    show_phone_to_patients: false,
    show_birth_date_to_patients: false,
    signature_url: "",
    video_url: "",
    cnpj: "",
    cpf: "",
    bank_agency: "",
    bank_account: "",
    bank_account_digit: "",
    pix_key_type: "",
    pix_key: "",
    lgpd_consent: false,
    payment_change_deadline_message: "",
    lgpd_consent_date: "",
    accepts_corporate_sessions: false,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.user?.full_name || user?.full_name || "",
        bio: profile.bio || "",
        specialties: profile.specialties || "",
        session_price: profile.session_price?.toString() || "",
        experiencia: profile.experiencia || "",
        abordagem: profile.abordagem || "",
        idiomas: profile.idiomas || "",
        gender: profile.gender || "",
        ethnicity: profile.ethnicity || "",
        lgbtqia_ally: profile.lgbtqia_ally || false,
        formation: profile.formation || "",
        education_level: profile.education_level || "",
        treatment: profile.treatment || "",
        approaches: profile.approaches || [],
        specialties_list: profile.specialties_list || [],
        reasons: profile.reasons || [],
        service_types: profile.service_types || [],
        languages_list: profile.languages_list || [],
        instagram_url: profile.instagram_url || "",
        session_duration_30min: profile.session_duration_30min ?? true,
        session_duration_50min: profile.session_duration_50min ?? true,
        phone: profile.phone || "",
        birth_date: profile.birth_date ? new Date(profile.birth_date).toISOString().split('T')[0] : "",
        show_phone_to_patients: profile.show_phone_to_patients || false,
        show_birth_date_to_patients: profile.show_birth_date_to_patients || false,
        signature_url: profile.signature_url || "",
        video_url: profile.video_url || "",
        cnpj: profile.cnpj || "",
        cpf: profile.cpf || "",
        bank_agency: profile.bank_agency || "",
        bank_account: profile.bank_account || "",
        bank_account_digit: profile.bank_account_digit || "",
        pix_key_type: profile.pix_key_type || "",
        pix_key: profile.pix_key || "",
        lgpd_consent: profile.lgpd_consent || false,
        payment_change_deadline_message: (profile as any).payment_change_deadline_message || "",
        lgpd_consent_date: (profile as any).lgpd_consent_date || "",
        accepts_corporate_sessions: profile.accepts_corporate_sessions || false,
      });
    }
  }, [profile, user]);

  const loadUserData = async () => {
    try {
      const data = await api('/api/users/me');
      setUserData(data);
    } catch (err: any) {
      console.error('Erro ao carregar dados do usuário:', err);
    }
  };

  const loadProfile = async () => {
    try {
      let data;
      try {
        data = await api("/api/therapists/me/profile");
      } catch {
        data = await api("/api/therapists/me/profile", {
          method: "POST",
          body: JSON.stringify({
            bio: "", specialties: "", session_price: null, experiencia: "",
            abordagem: "", idiomas: "", foto_url: null, gender: "", ethnicity: "",
            lgbtqia_ally: false, formation: "", education_level: "", treatment: "",
            approaches: [], specialties_list: [], reasons: [], service_types: [],
            languages_list: [], instagram_url: "", session_duration_30min: true,
            session_duration_50min: true, phone: null, birth_date: null,
            show_phone_to_patients: false, show_birth_date_to_patients: false,
            signature_url: null, video_url: null, cnpj: null, cpf: null,
            bank_agency: null, bank_account: null, bank_account_digit: null,
            pix_key_type: null, pix_key: null, lgpd_consent: false,
            accepts_corporate_sessions: false,
          })
        });
      }
      setProfile(data);
      if (data.foto_url) {
        setFotoUrl(data.foto_url);
      }
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
      setError("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserData();
    loadProfile();
  }, [user]);

  const handleUploadComplete = (novaFotoUrl: string) => {
    setFotoUrl(novaFotoUrl);
  };

  const handleEmailChangeSuccess = (newEmail: string) => {
    setUserData(prev => prev ? { ...prev, email: newEmail } : null);
    loadUserData();
  };

  const handleAccountDeleted = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/auth/login';
  };

  const toggleArrayItem = (field: keyof typeof formData, value: string) => {
    setFormData(prev => {
      const currentArray = prev[field] as string[];
      if (currentArray.includes(value)) {
        return { ...prev, [field]: currentArray.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...currentArray, value] };
      }
    });
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

  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
      if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
      if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
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
        await api("/api/users/me", {
          method: "PATCH",
          body: JSON.stringify({ full_name: formData.full_name })
        });
      }
      await api("/api/therapists/me/profile", {
        method: "POST",
        body: JSON.stringify({
          bio: formData.bio,
          specialties: formData.specialties,
          session_price: formData.session_price ? Number(formData.session_price) : null,
          experiencia: formData.experiencia,
          abordagem: formData.abordagem,
          idiomas: formData.idiomas,
          gender: formData.gender || null,
          ethnicity: formData.ethnicity || null,
          lgbtqia_ally: formData.lgbtqia_ally,
          formation: formData.formation || null,
          education_level: formData.education_level || null,
          treatment: formData.treatment || null,
          approaches: formData.approaches,
          specialties_list: formData.specialties_list,
          reasons: formData.reasons,
          service_types: formData.service_types,
          languages_list: formData.languages_list,
          instagram_url: formData.instagram_url || null,
          session_duration_30min: formData.session_duration_30min,
          session_duration_50min: formData.session_duration_50min,
          phone: formData.phone || null,
          birth_date: formData.birth_date || null,
          show_phone_to_patients: formData.show_phone_to_patients,
          show_birth_date_to_patients: formData.show_birth_date_to_patients,
          signature_url: formData.signature_url || null,
          video_url: formData.video_url || null,
          cnpj: formData.cnpj || null,
          cpf: formData.cpf || null,
          bank_agency: formData.bank_agency || null,
          bank_account: formData.bank_account || null,
          bank_account_digit: formData.bank_account_digit || null,
          pix_key_type: formData.pix_key_type || null,
          pix_key: formData.pix_key || null,
          lgpd_consent: formData.lgpd_consent,
          accepts_corporate_sessions: formData.accepts_corporate_sessions,
        })
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

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    if (field === "phone") value = formatPhone(value as string);
    else if (field === "cnpj") value = formatCnpj(value as string);
    else if (field === "cpf") value = formatCpf(value as string);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
      <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
    </div>
  );

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Perfil Profissional</h1>
        <p className="text-sm text-gray-600 mt-1">Gerencie suas informações profissionais e configurações</p>
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

        {userData && (
          <div className="mb-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <IdCard className="w-4 h-4 text-[#E03673]" />
              <h3 className="text-sm font-medium text-gray-700">Identificação</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">ID do usuário</p>
                <p className="text-sm font-mono font-medium text-gray-900">{userData.formatted_id}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tipo de conta</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{userData.role}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500">E-mail</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-medium text-gray-900 flex-1">{userData.email}</p>
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    Alterar e-mail
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Cadastrado em</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(userData.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); salvarPerfil(); }} className="space-y-6">

          {/* FOTO DE PERFIL */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Foto de Perfil</h2>
            </div>
            <div className="flex items-center gap-4">
              <PhotoUploadButton
                currentPhotoUrl={fotoUrl}
                endpoint="/api/therapists/me/profile/photo"
                onSuccess={handleUploadComplete}
                onError={(msg) => setError(msg)}
                size={96}
                name={formData.full_name}
              />
              <div>
                <p className="text-sm text-gray-600">Clique no ícone da câmera para alterar sua foto</p>
                <p className="text-xs text-gray-400 mt-1">Formatos aceitos: JPG, PNG, GIF, WEBP (máx. 5MB)</p>
              </div>
            </div>
          </div>

          {/* Informações Básicas */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Informações Básicas</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
                <input type="text" value={formData.full_name} onChange={(e) => handleChange("full_name", e.target.value)} className="w-full p-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={user?.email || ""} className="w-full p-2 border rounded-lg bg-gray-50" disabled />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Award className="w-4 h-4" />Tratamento
                </label>
                <select value={formData.treatment} onChange={(e) => handleChange("treatment", e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="">Selecione...</option>
                  {treatmentOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Como deseja ser chamado nos recibos e comunicações</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Phone className="w-4 h-4" />Celular
                  </label>
                  <input type="tel" value={formData.phone} onChange={(e) => handleChange("phone", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="(00) 00000-0000" />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <input type="checkbox" checked={formData.show_phone_to_patients} onChange={(e) => handleChange("show_phone_to_patients", e.target.checked)} className="h-4 w-4 text-[#E03673] rounded" />
                    <span>Mostrar para pacientes</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />Data de nascimento
                  </label>
                  <input type="date" value={formData.birth_date} onChange={(e) => handleChange("birth_date", e.target.value)} className="w-full p-2 border rounded-lg" />
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <input type="checkbox" checked={formData.show_birth_date_to_patients} onChange={(e) => handleChange("show_birth_date_to_patients", e.target.checked)} className="h-4 w-4 text-[#E03673] rounded" />
                    <span>Mostrar para pacientes</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <School className="w-4 h-4" />Nível de escolaridade
                </label>
                <select value={formData.education_level} onChange={(e) => handleChange("education_level", e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="">Selecione...</option>
                  {educationLevelOptions.map(level => <option key={level} value={level}>{level}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Para fins estatísticos</p>
              </div>
            </div>
          </div>

          {/* Endereços */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Home className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Endereços</h2>
            </div>
            <TherapistAddressList therapistId={profile?.id || 0} onAddressChange={() => { loadProfile(); }} />
          </div>

          {/* Perfil Profissional */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Perfil Profissional</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Descrição</label>
                <textarea value={formData.bio} onChange={(e) => handleChange("bio", e.target.value)} rows={4} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Especialidades (texto livre)</label>
                <input type="text" value={formData.specialties} onChange={(e) => handleChange("specialties", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Ex: Psicanálise, TCC, Terapia de Casal" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Abordagem</label>
                <input type="text" value={formData.abordagem} onChange={(e) => handleChange("abordagem", e.target.value)} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experiência</label>
                <textarea value={formData.experiencia} onChange={(e) => handleChange("experiencia", e.target.value)} rows={3} className="w-full p-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <PenTool className="w-4 h-4" />Assinatura digital (para recibos)
                </label>
                <input type="text" value={formData.signature_url} onChange={(e) => handleChange("signature_url", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="URL da imagem da assinatura (fundo transparente)" />
                <p className="text-xs text-gray-500 mt-1">A imagem deve ter fundo transparente para melhor visualização no recibo</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Video className="w-4 h-4" />Vídeo de apresentação
                </label>
                <input type="url" value={formData.video_url} onChange={(e) => handleChange("video_url", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="https://youtube.com/watch?v=..." />
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-blue-800 mb-1">Política de Remarcação</h3>
                    <p className="text-sm text-blue-700">Remarcações podem ocorrer até 24 hora(s) antes sem custo adicional</p>
                  </div>
                </div>
              </div>

              {/* Duração das sessões */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <label className="text-sm font-medium text-gray-700">Duração das sessões oferecidas</label>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={formData.session_duration_30min} onChange={(e) => handleChange("session_duration_30min", e.target.checked)} className="h-5 w-5 text-[#E03673] rounded" />
                    <div>
                      <span className="font-medium">Sessões de 30 minutos</span>
                      <p className="text-xs text-gray-500">Ideal para acompanhamentos rápidos</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 p-2 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={formData.session_duration_50min} onChange={(e) => handleChange("session_duration_50min", e.target.checked)} className="h-5 w-5 text-[#E03673] rounded" />
                    <div>
                      <span className="font-medium">Sessões de 50 minutos</span>
                      <p className="text-xs text-gray-500">Duração padrão para terapia</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Atendimento Corporativo */}
              <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-gray-600" />
                  <label className="text-sm font-medium text-gray-700">Atendimento para empresas</label>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-2 border rounded-lg bg-white hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={formData.accepts_corporate_sessions} onChange={(e) => handleChange("accepts_corporate_sessions", e.target.checked)} className="h-5 w-5 text-[#E03673] rounded" />
                    <div>
                      <span className="font-medium">Aceito atender pacientes via plano empresa</span>
                      <p className="text-xs text-gray-500">Sessões corporativas pagas pelo plano da empresa</p>
                    </div>
                  </label>
                  {formData.accepts_corporate_sessions && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        O valor por sessão será definido pelo plano da empresa (R$ 40,00 a R$ 50,00 por sessão). A comissão da plataforma é calculada sobre este valor.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />Preço da sessão (R$)
                </label>
                <input type="number" value={formData.session_price} onChange={(e) => handleChange("session_price", e.target.value)} className="w-full p-2 border rounded-lg" min="0" step="10" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Instagram className="w-4 h-4" />Instagram <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <input type="url" value={formData.instagram_url} onChange={(e) => handleChange("instagram_url", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="https://instagram.com/seu_perfil" />
              </div>
            </div>
          </div>

          {/* Dados Financeiros */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Dados Financeiros</h2>
            </div>
            {formData.payment_change_deadline_message && (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-yellow-600 mt-0.5" />
                <p className="text-xs text-yellow-700">{formData.payment_change_deadline_message}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />CNPJ
                </label>
                <div className="relative">
                  <input type="text" value={formData.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="00.000.000/0000-00" />
                  <button type="button" onClick={() => setShowCnpj(!showCnpj)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showCnpj ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <User className="w-4 h-4" />CPF <span className="text-gray-400 text-xs">(opcional)</span>
                </label>
                <div className="relative">
                  <input type="text" value={formData.cpf} onChange={(e) => handleChange("cpf", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="000.000.000-00" />
                  <button type="button" onClick={() => setShowCpf(!showCpf)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                    {showCpf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Armazenado conforme LGPD.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Agência</label>
                  <input type="text" value={formData.bank_agency} onChange={(e) => handleChange("bank_agency", e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Conta</label>
                  <input type="text" value={formData.bank_account} onChange={(e) => handleChange("bank_account", e.target.value)} className="w-full p-2 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dígito</label>
                  <input type="text" value={formData.bank_account_digit} onChange={(e) => handleChange("bank_account_digit", e.target.value)} className="w-full p-2 border rounded-lg" maxLength={2} />
                </div>
              </div>
            </div>
          </div>

          {/* Chave PIX */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Chave PIX</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de chave</label>
                <select value={formData.pix_key_type} onChange={(e) => handleChange("pix_key_type", e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="">Selecione</option>
                  {pixKeyTypeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
                <input type="text" value={formData.pix_key} onChange={(e) => handleChange("pix_key", e.target.value)} className="w-full p-2 border rounded-lg" placeholder="Digite sua chave PIX" />
              </div>
            </div>
          </div>

          {/* Privacidade e LGPD */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Privacidade e LGPD</h2>
            </div>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={formData.lgpd_consent} onChange={(e) => handleChange("lgpd_consent", e.target.checked)} className="h-5 w-5 text-[#E03673] rounded mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Autorizo o tratamento dos meus dados pessoais conforme a LGPD</p>
                  <p className="text-xs text-gray-500 mt-1">Seus dados serão utilizados apenas para fins de pagamento e registro profissional.</p>
                </div>
              </label>
              {formData.lgpd_consent_date && (
                <p className="text-xs text-gray-400 mt-2">Consentimento registrado em {new Date(formData.lgpd_consent_date).toLocaleDateString('pt-BR')}</p>
              )}
            </div>

            {/* Exclusão de conta — colapsável, dentro do bloco LGPD */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowDeletionSection(!showDeletionSection)}
                className="flex items-center justify-between w-full text-left text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-gray-400" />
                  Exclusão de conta e dados
                </span>
                {showDeletionSection
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>

              {showDeletionSection && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-800">Esta ação é permanente e irreversível</p>
                      <p className="text-xs text-red-600 mt-1">
                        Ao excluir sua conta, todos os seus dados serão removidos permanentemente — incluindo perfil, sessões, prontuários e dados financeiros.
                        Registros fiscais podem ser mantidos por até 5 anos conforme a legislação brasileira.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeletionModal(true)}
                    className="w-full px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Quero excluir minha conta permanentemente
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dados para Busca Avançada */}
          <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-[#E03673]/20">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold text-[#E03673]">Dados para Busca Avançada</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">Estes dados ajudam pacientes a encontrar você através dos filtros de busca.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
                <select value={formData.gender} onChange={(e) => handleChange("gender", e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="">Selecione</option>
                  {genderOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etnia</label>
                <select value={formData.ethnicity} onChange={(e) => handleChange("ethnicity", e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="">Selecione</option>
                  {ethnicityOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="lgbtqia" checked={formData.lgbtqia_ally} onChange={(e) => handleChange("lgbtqia_ally", e.target.checked)} className="h-4 w-4 text-[#E03673] rounded" />
                <label htmlFor="lgbtqia" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Heart className="w-4 h-4 text-[#E03673]" />Aliado/pertencente à comunidade LGBTQIAPN+
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" />Formação
                </label>
                <select value={formData.formation} onChange={(e) => handleChange("formation", e.target.value)} className="w-full p-2 border rounded-lg">
                  <option value="">Selecione</option>
                  {formationOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Abordagens Terapêuticas</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {approachOptions.map(approach => (
                  <label key={approach} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.approaches.includes(approach)} onChange={() => toggleArrayItem("approaches", approach)} className="h-4 w-4 text-[#E03673] rounded" />{approach}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Especialidades</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {reasonOptions.slice(0, 10).map(spec => (
                  <label key={spec} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.specialties_list.includes(spec)} onChange={() => toggleArrayItem("specialties_list", spec)} className="h-4 w-4 text-[#E03673] rounded" />{spec}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Motivos que atende</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {reasonOptions.map(reason => (
                  <label key={reason} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.reasons.includes(reason)} onChange={() => toggleArrayItem("reasons", reason)} className="h-4 w-4 text-[#E03673] rounded" />{reason}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de profissional</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {serviceTypeOptions.map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.service_types.includes(type)} onChange={() => toggleArrayItem("service_types", type)} className="h-4 w-4 text-[#E03673] rounded" />{type}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Languages className="w-4 h-4" />Idiomas
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {languageOptions.map(lang => (
                  <label key={lang} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={formData.languages_list.includes(lang)} onChange={() => toggleArrayItem("languages_list", lang)} className="h-4 w-4 text-[#E03673] rounded" />{lang}
                  </label>
                ))}
              </div>
            </div>
            {profile && (profile.total_sessions !== undefined || profile.verified) && (
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  <h3 className="font-medium">Estatísticas</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {profile.total_sessions !== undefined && (
                    <div>Total de sessões: <span className="font-bold">{profile.total_sessions}</span></div>
                  )}
                  {profile.verified && (
                    <div className="text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Profissional verificado</div>
                  )}
                  {profile.featured && (
                    <div className="text-purple-600 flex items-center gap-1"><Star className="w-4 h-4" /> Em destaque</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => window.history.back()} className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal de Exclusão de Conta */}
      <AccountDeletionModal
        isOpen={showDeletionModal}
        onClose={() => setShowDeletionModal(false)}
        onDeleted={handleAccountDeleted}
        userEmail={userData?.email || user?.email || ""}
      />

      {/* Modal de Alteração de E-mail */}
      <EmailChangeModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        currentEmail={userData?.email || user?.email || ""}
        onSuccess={handleEmailChangeSuccess}
      />
    </>
  );
}