"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Building2,
  Briefcase,
  IdCard,
  Eye,
  EyeOff,
  Lock
} from "lucide-react";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  verde: "#10B981",
  vermelho: "#EF4444",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  branco: "#FFFFFF",
};

export default function NovoColaboradorPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    data_nascimento: "",
    telefone: "",
    departamento: "",
    cargo: ""
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    if (field === "cpf") {
      value = formatCpf(value);
    } else if (field === "telefone") {
      value = formatPhone(value);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!formData.nome) {
      setError("Nome é obrigatório");
      setLoading(false);
      return;
    }
    if (!formData.email) {
      setError("Email é obrigatório");
      setLoading(false);
      return;
    }
    if (!formData.cpf) {
      setError("CPF é obrigatório");
      setLoading(false);
      return;
    }
    if (!formData.data_nascimento) {
      setError("Data de nascimento é obrigatória");
      setLoading(false);
      return;
    }

    try {
      const result = await apiCall({
        url: "/api/empresa/colaboradores/novo",
        method: "POST",
        body: {
          nome: formData.nome,
          email: formData.email,
          cpf: formData.cpf.replace(/\D/g, ''),
          data_nascimento: formData.data_nascimento,
          telefone: formData.telefone.replace(/\D/g, ''),
          departamento: formData.departamento,
          cargo: formData.cargo
        },
        requireAuth: true
      });
      
      setSuccess(`Colaborador ${formData.nome} cadastrado com sucesso! Uma senha temporária foi enviada para o e-mail informado.`);
      
      setFormData({
        nome: "",
        email: "",
        cpf: "",
        data_nascimento: "",
        telefone: "",
        departamento: "",
        cargo: ""
      });
      
      setTimeout(() => {
        router.push("/empresa/colaboradores");
      }, 3000);
      
    } catch (err: any) {
      console.error("Erro ao cadastrar:", err);
      setError(err.message || "Erro ao cadastrar colaborador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-[#E03673]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Novo Colaborador</h1>
              <p className="text-gray-500 mt-1">
                Cadastre um novo colaborador manualmente
              </p>
            </div>
          </div>
          <Link href="/empresa/colaboradores" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
        </div>
      </div>

      {/* Alertas */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dados Pessoais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <IdCard className="w-5 h-5 text-[#E03673]" />
            Dados Pessoais
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    placeholder="colaborador@empresa.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPF <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => handleChange("cpf", e.target.value)}
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de nascimento <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => handleChange("data_nascimento", e.target.value)}
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.telefone}
                    onChange={(e) => handleChange("telefone", e.target.value)}
                    className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dados Profissionais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#E03673]" />
            Dados Profissionais
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departamento
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.departamento}
                  onChange={(e) => handleChange("departamento", e.target.value)}
                  className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  placeholder="Ex: TI, RH, Financeiro"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cargo
              </label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.cargo}
                  onChange={(e) => handleChange("cargo", e.target.value)}
                  className="w-full pl-9 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#E03673] outline-none"
                  placeholder="Ex: Analista, Coordenador"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Informação sobre senha */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Senha temporária</p>
              <p className="text-sm text-blue-700">
                Uma senha temporária será gerada automaticamente e enviada para o e-mail do colaborador.
                O colaborador poderá alterar a senha no primeiro acesso.
              </p>
            </div>
          </div>
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push("/empresa/colaboradores")}
            className="px-6 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? "Cadastrando..." : "Cadastrar Colaborador"}
          </button>
        </div>
      </form>
    </div>
  );
}