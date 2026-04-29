"use client";

import { Suspense } from "react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import {
  CheckCircle, Crown, Star, Shield, ArrowRight,
  Loader2, Sparkles, Zap, TrendingUp, Users, Video, Calendar, CreditCard, Headphones,
  Flame, Gem, AlertCircle, HelpCircle, UserPlus, LogIn, Search, LayoutDashboard
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaEscuro: "#c02c5e",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

interface PlanFromAPI {
  id: string;
  name: string;
  price_cents: number;
  price_brl: number;
  features: string[];
  is_free: boolean;
}

interface ProcessedPlan {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  commission: string;
  description: string;
  features: string[];
  icon: JSX.Element;
  color: string;
  bgColor: string;
  buttonText: string;
  buttonVariant: string;
  popular: boolean;
}

const COMMISSION_MAP: Record<string, string> = {
  essencial: "20%",
  profissional: "10%",
  premium: "3%"
};

const DESCRIPTION_MAP: Record<string, string> = {
  essencial: "Para começar sem risco",
  profissional: "Para quem quer consistência",
  premium: "Para quem quer crescer de verdade"
};

const getIcon = (planId: string) => {
  switch (planId) {
    case "essencial": return <Shield className="w-8 h-8" />;
    case "profissional": return <Star className="w-8 h-8" />;
    case "premium": return <Crown className="w-8 h-8" />;
    default: return <Shield className="w-8 h-8" />;
  }
};

const getColor = (planId: string) => {
  switch (planId) {
    case "essencial": return "from-gray-500 to-gray-600";
    case "profissional": return "from-[#2F80D3] to-[#2F80D3]/80";
    case "premium": return "from-[#E03673] to-[#E03673]/80";
    default: return "from-gray-500 to-gray-600";
  }
};

const getButtonVariant = (planId: string) => {
  switch (planId) {
    case "essencial": return "outline";
    case "profissional": return "primary";
    case "premium": return "premium";
    default: return "outline";
  }
};

// 🔥 Componente interno que usa useSearchParams
function PlanosContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [plansAPI, setPlansAPI] = useState<PlanFromAPI[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [stats, setStats] = useState({ therapists: 0, sessions: 0, satisfaction: 98, online: 100 });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const loadPlanos = async () => {
      setLoadingPlanos(true);
      try {
        const token = localStorage.getItem("access_token");
        const headers: HeadersInit = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${BACKEND_URL}/api/plans/`, { headers });
        if (response.ok) {
          const data = await response.json();
          setPlansAPI(data.plans || []);
        } else throw new Error("Erro ao carregar planos");
      } catch {
        setPlansAPI([
          { id: "essencial", name: "Essencial", price_cents: 0, price_brl: 0, features: [], is_free: true },
          { id: "profissional", name: "Profissional", price_cents: 7900, price_brl: 79, features: [], is_free: false },
          { id: "premium", name: "Premium", price_cents: 14900, price_brl: 149, features: [], is_free: false }
        ]);
      } finally {
        setLoadingPlanos(false);
      }
    };
    loadPlanos();
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const response = await fetch(`${BACKEND_URL}/public/stats/`);
        if (response.ok) {
          const data = await response.json();
          setStats({ therapists: data.therapists || 0, sessions: data.sessions || 0, satisfaction: data.satisfaction || 98, online: data.online || 100 });
        }
      } catch {
        setStats({ therapists: 500, sessions: 10000, satisfaction: 98, online: 100 });
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();

    const token = localStorage.getItem("access_token");
    if (token) {
      fetch(`${BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : null)
        .then(data => setUser(data))
        .catch(() => setUser(null));
    }
  }, []);

  const getDefaultFeatures = (planId: string): string[] => {
    switch (planId) {
      case "essencial": return ["Perfil na plataforma", "Agenda e gestão de sessões", "Videochamada integrada", "Pagamento automático", "Suporte padrão"];
      case "profissional": return ["Tudo do Essencial", "Comissão reduzida (10%)", "Melhor posicionamento na busca", "Acesso a mais pacientes", "Relatórios básicos", "Prioridade no matching"];
      case "premium": return ["Tudo do Profissional", "Comissão mínima (3%)", "Destaque máximo na plataforma", "Leads prioritários", "Participação em campanhas", "Analytics avançado", "(Futuro) IA para apoio clínico"];
      default: return [];
    }
  };

  const processPlans = (): ProcessedPlan[] => {
    if (plansAPI.length === 0) return [];
    return plansAPI.map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price_brl,
      priceFormatted: plan.is_free ? "Grátis" : `R$ ${plan.price_brl.toFixed(2)}/mês`,
      commission: COMMISSION_MAP[plan.id] || "20%",
      description: DESCRIPTION_MAP[plan.id] || "Plano para terapeutas",
      features: plan.features.length > 0 ? plan.features : getDefaultFeatures(plan.id),
      icon: getIcon(plan.id),
      color: getColor(plan.id),
      bgColor: plan.id === "essencial" ? "bg-gray-50" : plan.id === "profissional" ? "bg-blue-50" : "bg-pink-50",
      buttonText: plan.is_free ? "Começar grátis" : "Assinar Agora",
      buttonVariant: getButtonVariant(plan.id),
      popular: plan.id === "profissional"
    }));
  };

  const PLANS = processPlans();

  const formatNumber = (num: number) => {
    if (num >= 1000) return `+${(num / 1000).toFixed(0)}k`;
    return `+${num}`;
  };

  const handleSubscribe = async (planId: string) => {
    if (planId === "essencial") { router.push("/auth/signup?role=therapist"); return; }
    setLoading(planId);
    setError("");
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        localStorage.setItem("selected_plan", planId);
        router.push("/auth/signup?role=therapist&plan=" + planId);
        return;
      }
      const userRes = await fetch(`${BACKEND_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (!userRes.ok) {
        localStorage.removeItem("access_token");
        localStorage.setItem("selected_plan", planId);
        router.push("/auth/login?redirect=/planos&plan=" + planId);
        return;
      }
      const userData = await userRes.json();
      if (userData.role !== "therapist") {
        setError("Você está logado como paciente. Para assinar um plano, você precisa se cadastrar como terapeuta.");
        setTimeout(() => setError(""), 5000);
        return;
      }
      const response = await fetch(`${BACKEND_URL}/api/payments/create-subscription-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erro ao processar assinatura");
      }
      const data = await response.json();
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setError(err.message || "Erro ao processar assinatura");
      setTimeout(() => setError(""), 3000);
    } finally {
      setLoading(null);
    }
  };

  const STATS = [
    { icon: <Users className="w-5 h-5" />, value: formatNumber(stats.therapists), label: "Terapeutas ativos", loading: loadingStats },
    { icon: <Calendar className="w-5 h-5" />, value: formatNumber(stats.sessions), label: "Sessões realizadas", loading: loadingStats },
    { icon: <TrendingUp className="w-5 h-5" />, value: `${stats.satisfaction}%`, label: "Taxa de satisfação", loading: loadingStats },
    { icon: <Video className="w-5 h-5" />, value: "100%", label: "Online", loading: false }
  ];

  if (loadingPlanos) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F9FAFB" }}>
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      {isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />}

      {/* Hero azul */}
      <div style={{ backgroundColor: CORES.azul }}>
        <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "48px 16px" }}>
          {isLoggedIn && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px", gap: "12px" }}>
              <Link href="/busca" style={{ textDecoration: "none" }}>
                <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", backgroundColor: `${CORES.branco}20`, color: CORES.branco, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}>
                  <Search size={16} /> Voltar para busca
                </button>
              </Link>
              <Link href="/patient/dashboard" style={{ textDecoration: "none" }}>
                <button style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", backgroundColor: CORES.branco, color: CORES.azul, border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "500" }}>
                  <LayoutDashboard size={16} /> Dashboard
                </button>
              </Link>
            </div>
          )}

          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Planos para Terapeutas
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Escolha o plano ideal para sua prática clínica e comece a atender pacientes hoje mesmo
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-white/70 text-sm">
              <Gem className="w-4 h-4" />
              <span>Você só paga quando atende — comissão por sessão + mensalidade opcional</span>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "32px 16px", flex: 1, width: "100%" }}>

        {/* Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#E03673]/10 flex items-center justify-center mx-auto mb-3">
                  <div className="text-[#E03673]">{stat.icon}</div>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {stat.loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#E03673]" /> : stat.value}
                </p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
            {error.includes("paciente") && (
              <Link href="/auth/signup?role=therapist" className="ml-2 text-[#E03673] font-medium hover:underline flex items-center gap-1">
                <UserPlus className="w-3 h-3" />
                Cadastrar como terapeuta
              </Link>
            )}
          </div>
        )}

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${plan.popular ? "ring-2 ring-[#E03673] transform scale-105" : ""}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-[#E03673] text-white px-4 py-1 text-sm font-medium rounded-bl-lg flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  Mais Popular
                </div>
              )}
              <div className={`bg-gradient-to-r ${plan.color} p-6 text-white`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                    <p className="text-white/80 text-sm mt-1">{plan.description}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    {plan.icon}
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold">{plan.priceFormatted}</p>
                  <p className="text-white/70 text-sm mt-1">Comissão por sessão: {plan.commission}</p>
                </div>
              </div>
              <div className="p-6 bg-white">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    plan.buttonVariant === "primary" ? "bg-[#E03673] hover:bg-[#c02c5e] text-white"
                    : plan.buttonVariant === "premium" ? "bg-gradient-to-r from-[#E03673] to-[#c02c5e] hover:opacity-90 text-white"
                    : "border-2 border-gray-300 text-gray-700 hover:border-[#E03673] hover:text-[#E03673]"
                  }`}
                >
                  {loading === plan.id ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Processando...</>
                  ) : (
                    <>{plan.buttonText}<ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-16 bg-gray-50 rounded-2xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Dúvidas frequentes</h2>
            <p className="text-gray-600 mt-2">Tire suas dúvidas sobre os planos</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-[#E03673]" />Como funciona a comissão?</h3>
              <p className="text-sm text-gray-600">A comissão é cobrada apenas sobre as sessões realizadas. Você só paga quando atende. Os valores são debitados automaticamente da sua carteira na plataforma.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2"><CreditCard className="w-4 h-4 text-[#E03673]" />Posso trocar de plano?</h3>
              <p className="text-sm text-gray-600">Sim! Você pode fazer upgrade ou downgrade a qualquer momento. O valor é ajustado proporcionalmente.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-[#E03673]" />Como cancelar?</h3>
              <p className="text-sm text-gray-600">Você pode cancelar sua assinatura a qualquer momento. O plano continua ativo até o fim do período pago, e você volta automaticamente para o plano Essencial.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2"><Headphones className="w-4 h-4 text-[#E03673]" />Precisa de ajuda?</h3>
              <p className="text-sm text-gray-600">Nossa equipe de suporte está disponível para ajudar você a escolher o melhor plano e tirar dúvidas.</p>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup?role=therapist">
              <button className="px-8 py-3 bg-[#2F80D3] hover:bg-[#236bb3] text-white rounded-xl font-medium transition-colors inline-flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Cadastrar como terapeuta
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/auth/login">
              <button className="px-8 py-3 border-2 border-gray-300 hover:border-[#E03673] text-gray-700 hover:text-[#E03673] rounded-xl font-medium transition-colors inline-flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Já tenho conta
              </button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4 flex items-center justify-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Não precisa de cartão de crédito para começar
          </p>
        </div>
      </div>

      {/* Footer */}
      {isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />}

    </div>
  );
}

// 🔥 Componente principal com Suspense boundary
export default function PlanosPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F9FAFB" }}>
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    }>
      <PlanosContent />
    </Suspense>
  );
}