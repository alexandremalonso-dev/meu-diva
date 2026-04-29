"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Loader2, AlertCircle, CheckCircle, User, Briefcase, Building2, Crown, Star, Sparkles, Shield, TrendingUp } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TherapistPlan {
  id: number;
  plan: string;
  price_brl: number;
  price_cents: number;
  features: string[];
}

interface EmpresaPlanoFromAPI {
  id: number;
  nome: string;
  chave: string;
  preco_mensal_por_colaborador: number;
  sessoes_inclusas_por_colaborador: number;
  descricao: string | null;
  ativo: boolean;
}

function SignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  
  // Planos vindo do banco
  const [therapistPlans, setTherapistPlans] = useState<TherapistPlan[]>([]);
  const [empresaPlanos, setEmpresaPlanos] = useState<EmpresaPlanoFromAPI[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "patient"
  });

  // Buscar planos quando mudar o tipo de conta
  useEffect(() => {
    if (formData.role === "therapist" && therapistPlans.length === 0 && !loadingPlanos) {
      carregarPlanosTerapeuta();
    }
    if (formData.role === "empresa" && empresaPlanos.length === 0 && !loadingPlanos) {
      carregarPlanosEmpresa();
    }
  }, [formData.role]);

  const carregarPlanosTerapeuta = async () => {
  setLoadingPlanos(true);
  setError("");
  try {
    const response = await fetch(`${BACKEND_URL}/api/plans/`);
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    const plans = data.plans || [];
    
    const plansWithFeatures = plans
      .filter((plan: any) => plan.id !== "essencial") // Remove essencial (já temos hardcoded)
      .map((plan: any) => {
        let features: string[] = [];
        if (plan.id === "profissional") {
          features = [
            "Tudo do Essencial",
            "Perfil no marketplace",
            "Captação de novos pacientes",
            "Relatórios financeiros avançados",
            "Suporte prioritário",
            "Chat com pacientes"
          ];
        } else if (plan.id === "premium") {
          features = [
            "Tudo do Profissional",
            "Destaque no marketplace",
            "Leads diretos da plataforma",
            "Acesso a pacientes corporativos",
            "Suporte dedicado",
            "Menor comissão do mercado"
          ];
        }
        return {
          id: plan.id,
          plan: plan.id,
          price_brl: plan.price_brl,
          price_cents: plan.price_cents,
          features
        };
      });
    
    setTherapistPlans(plansWithFeatures);
  } catch (err) {
    console.error("Erro ao carregar planos do terapeuta:", err);
    setError("Erro ao carregar planos. Tente novamente.");
    setTherapistPlans([]);
  } finally {
    setLoadingPlanos(false);
  }
};

  const carregarPlanosEmpresa = async () => {
    setLoadingPlanos(true);
    setError("");
    try {
      const response = await fetch(`${BACKEND_URL}/api/empresa/planos-publicos`);
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setEmpresaPlanos(data);
    } catch (err) {
      console.error("Erro ao carregar planos da empresa:", err);
      setError("Erro ao carregar planos. Tente novamente.");
      setEmpresaPlanos([]);
    } finally {
      setLoadingPlanos(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!formData.full_name.trim()) {
      setError("Nome completo é obrigatório");
      return;
    }
    
    if (!formData.email.trim()) {
      setError("E-mail é obrigatório");
      return;
    }
    
    if (!formData.password) {
      setError("Senha é obrigatória");
      return;
    }
    
    if (formData.password !== formData.confirm_password) {
      setError("As senhas não coincidem");
      return;
    }
    
    if (formData.password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    
    setLoading(true);
    
    try {
      const payload: any = {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        role: formData.role
      };

      // Se for empresa e tiver plano selecionado, adicionar plano_id
      if (formData.role === "empresa" && selectedPlan) {
        const planoSelecionado = empresaPlanos.find(p => p.chave === selectedPlan);
        if (planoSelecionado) {
          payload.plano_id = planoSelecionado.id;
        }
      }

      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      setSuccess("Cadastro realizado com sucesso! Redirecionando...");
      
      setTimeout(() => {
        if (formData.role === "therapist") {
          router.push("/therapist/subscription");
        } else if (formData.role === "empresa") {
          router.push("/empresa/dashboard");
        } else {
          router.push("/auth/login");
        }
      }, 1500);
      
    } catch (err: any) {
      console.error("Erro no cadastro:", err);
      setError(err.message || "Erro ao realizar cadastro");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = (provider: "google" | "microsoft") => {
    setSocialLoading(true);
    setError("");
    window.location.href = `${BACKEND_URL}/api/auth/${provider}/login`;
  };

  const getCommissionByPlan = (plan: string) => {
    switch (plan) {
      case "profissional": return 10;
      case "premium": return 3;
      default: return 20;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#E03673]">Meu Divã</h1>
          <p className="text-gray-600 mt-2">Crie sua conta</p>
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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              placeholder="Seu nome completo"
              disabled={loading || socialLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              placeholder="seu@email.com"
              disabled={loading || socialLoading}
            />
          </div>
          
          {/* SELETOR DE TIPO DE CONTA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Como você quer acessar o Meu Divã?
            </label>
            <div className="space-y-3">
              {/* Paciente */}
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, role: "patient" });
                  setSelectedPlan(null);
                }}
                disabled={loading || socialLoading}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  formData.role === "patient"
                    ? "border-[#E03673] bg-[#E03673]/5 ring-2 ring-[#E03673]/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${formData.role === "patient" ? "bg-[#E03673]/10" : "bg-gray-100"}`}>
                    <User className={`w-5 h-5 ${formData.role === "patient" ? "text-[#E03673]" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${formData.role === "patient" ? "text-[#E03673]" : "text-gray-900"}`}>
                      Paciente
                    </p>
                    <p className="text-sm text-gray-500">Quero fazer sessões de terapia e cuidar da minha saúde emocional</p>
                  </div>
                  {formData.role === "patient" && (
                    <CheckCircle className="w-5 h-5 text-[#E03673]" />
                  )}
                </div>
              </button>

              {/* Terapeuta */}
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, role: "therapist" });
                  setSelectedPlan(null);
                }}
                disabled={loading || socialLoading}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  formData.role === "therapist"
                    ? "border-[#E03673] bg-[#E03673]/5 ring-2 ring-[#E03673]/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${formData.role === "therapist" ? "bg-[#E03673]/10" : "bg-gray-100"}`}>
                    <Briefcase className={`w-5 h-5 ${formData.role === "therapist" ? "text-[#E03673]" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${formData.role === "therapist" ? "text-[#E03673]" : "text-gray-900"}`}>
                      Especialista
                    </p>
                    <p className="text-sm text-gray-500">Quero atender pacientes online e fazer gestão da minha carreira</p>
                  </div>
                  {formData.role === "therapist" && (
                    <CheckCircle className="w-5 h-5 text-[#E03673]" />
                  )}
                </div>
              </button>

              {/* Empresa */}
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, role: "empresa" });
                  setSelectedPlan(null);
                }}
                disabled={loading || socialLoading}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  formData.role === "empresa"
                    ? "border-[#E03673] bg-[#E03673]/5 ring-2 ring-[#E03673]/20"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${formData.role === "empresa" ? "bg-[#E03673]/10" : "bg-gray-100"}`}>
                    <Building2 className={`w-5 h-5 ${formData.role === "empresa" ? "text-[#E03673]" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${formData.role === "empresa" ? "text-[#E03673]" : "text-gray-900"}`}>
                      Empresa
                    </p>
                    <p className="text-sm text-gray-500">Quero promover bem-estar emocional aos meus colaboradores</p>
                  </div>
                  {formData.role === "empresa" && (
                    <CheckCircle className="w-5 h-5 text-[#E03673]" />
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* SELEÇÃO DE PLANOS - para TERAPEUTA (BUSCA DO BANCO) */}
          {formData.role === "therapist" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Escolha seu plano (você pode mudar depois)
              </label>
              {loadingPlanos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
                </div>
              ) : therapistPlans.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>Nenhum plano disponível no momento</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Plano Essencial (hardcoded - padrão) */}
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("essencial")}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      selectedPlan === "essencial"
                        ? "border-[#E03673] bg-[#E03673]/5 ring-2 ring-[#E03673]/20"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-gray-500" />
                          <h3 className="font-bold text-gray-900">Essencial</h3>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Grátis</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">Para começar sem risco</p>
                        <ul className="text-xs text-gray-400 mt-2 space-y-1">
                          <li>✓ Agenda online</li>
                          <li>✓ Prontuário digital</li>
                          <li>✓ Sessões via Jitsi Meet</li>
                          <li>✓ Atender seus próprios pacientes</li>
                          <li className="text-gray-300">✗ Visibilidade no marketplace</li>
                          <li className="text-gray-300">✗ Relatórios financeiros avançados</li>
                        </ul>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-600">Grátis</p>
                        <p className="text-xs text-gray-400 mt-2">Comissão: 20%</p>
                        <span className="inline-block mt-1 text-xs text-[#E03673] font-medium">Começar grátis</span>
                      </div>
                    </div>
                  </button>

                  {/* Planos do banco: Profissional e Premium */}
                  {therapistPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.plan)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all relative ${
                        selectedPlan === plan.plan
                          ? "border-[#E03673] bg-[#E03673]/5 ring-2 ring-[#E03673]/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {plan.plan === "profissional" && (
                        <div className="absolute -top-2 right-4 bg-[#E03673] text-white text-xs px-2 py-0.5 rounded-full">
                          Mais escolhido
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {plan.plan === "profissional" ? (
                              <Star className="w-5 h-5 text-[#2F80D3]" />
                            ) : (
                              <Crown className="w-5 h-5 text-yellow-500" />
                            )}
                            <h3 className="font-bold text-gray-900">
                              {plan.plan === "profissional" ? "Profissional" : "Premium"}
                            </h3>
                            <span className="text-xs bg-[#2F80D3]/10 text-[#2F80D3] px-2 py-0.5 rounded-full">
                              R${plan.price_brl}/mês
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mt-1">
                            {plan.plan === "profissional" 
                              ? "Para crescer com consistência" 
                              : "Para escalar sua prática clínica"}
                          </p>
                          <ul className="text-xs text-gray-400 mt-2 space-y-1">
                            {plan.features.map((feature, idx) => (
                              <li key={idx}>✓ {feature}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#E03673]">R$ {plan.price_brl.toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-2">Comissão: {getCommissionByPlan(plan.plan)}%</p>
                          <span className="inline-block mt-1 text-xs text-[#E03673] font-medium">
                            Assinar {plan.plan === "profissional" ? "Profissional" : "Premium"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Após o cadastro, você será direcionado para a página de planos para assinar.
              </p>
            </div>
          )}

          {/* SELEÇÃO DE PLANOS - para EMPRESA (BUSCA DO BANCO) */}
          {formData.role === "empresa" && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Escolha o plano da sua empresa
              </label>
              {loadingPlanos ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
                </div>
              ) : empresaPlanos.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>Nenhum plano disponível no momento</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {empresaPlanos.filter(p => p.ativo).map((plano) => (
                    <button
                      key={plano.id}
                      type="button"
                      onClick={() => setSelectedPlan(plano.chave)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        selectedPlan === plano.chave
                          ? "border-[#E03673] bg-[#E03673]/5 ring-2 ring-[#E03673]/20"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {plano.chave === "prata" && <Star className="w-5 h-5 text-gray-400" />}
                            {plano.chave === "ouro" && <TrendingUp className="w-5 h-5 text-[#2F80D3]" />}
                            {plano.chave === "diamante" && <Crown className="w-5 h-5 text-yellow-500" />}
                            <h3 className="font-bold text-gray-900">{plano.nome}</h3>
                            {plano.chave === "ouro" && (
                              <span className="text-xs bg-[#2F80D3]/10 text-[#2F80D3] px-2 py-0.5 rounded-full">Mais escolhido</span>
                            )}
                            {plano.chave === "diamante" && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Recomendado</span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-1">{plano.descricao || (plano.chave === "prata" ? "Para começar a cuidar das pessoas" : plano.chave === "ouro" ? "Para empresas que levam saúde a sério" : "Para cultura de cuidado completa")}</p>
                          <ul className="text-xs text-gray-400 mt-2 space-y-1">
                            <li>✓ {plano.sessoes_inclusas_por_colaborador} sessão(ões) inclusas por mês</li>
                            <li>✓ Gestão de colaboradores</li>
                            <li>✓ Relatórios consolidados</li>
                            <li>✓ Suporte dedicado</li>
                            {plano.chave === "ouro" && <li>✓ Analytics avançado</li>}
                            {plano.chave === "diamante" && <li>✓ API de integração</li>}
                          </ul>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-[#E03673]">
                            R$ {plano.preco_mensal_por_colaborador.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-400">por colaborador/mês</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Após o cadastro, você poderá adicionar colaboradores e gerenciar sua equipe.
              </p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              placeholder="••••••"
              disabled={loading || socialLoading}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar senha
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              placeholder="••••••"
              disabled={loading || socialLoading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || socialLoading}
            className="w-full py-3 bg-[#E03673] text-white rounded-xl font-medium hover:bg-[#c02c5e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cadastrar"}
          </button>
        </form>
        
        {/* Botões de cadastro social */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-3">Ou cadastre-se com</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSocialSignup("google")}
              disabled={loading || socialLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm text-gray-600">Google</span>
            </button>

            <button
              onClick={() => handleSocialSignup("microsoft")}
              disabled={loading || socialLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              <span className="text-sm text-gray-600">Microsoft</span>
            </button>
          </div>
          {socialLoading && (
            <p className="text-xs text-center text-gray-400 mt-2">Redirecionando para o provedor...</p>
          )}
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem uma conta?{" "}
          <Link href="/auth/login" className="text-[#E03673] hover:underline">
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <AuthProvider>
      <SignupForm />
    </AuthProvider>
  );
}