"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  CheckCircle, 
  Crown, 
  Star, 
  ArrowRight, 
  Loader2, 
  AlertCircle, 
  CreditCard, 
  Calendar, 
  Shield, 
  Sparkles,
  TrendingUp,
  Bot,
  RefreshCw,
  Zap
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "https://meudiva-api-backend-592671373665.southamerica-east1.run.app";

interface Subscription {
  id: number;
  plan: string;
  status: string;
  stripe_subscription_id: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  priceFormatted: string;
  commission: number;
  features: string[];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "Essencial",
    price: 0,
    priceFormatted: "Grátis",
    commission: 20,
    features: [
      "Perfil na plataforma",
      "Agenda e gestão de sessões",
      "Videochamada integrada",
      "Pagamento automático",
      "Suporte padrão"
    ],
    icon: <Shield className="w-8 h-8" />,
    color: "from-gray-500 to-gray-600",
    bgColor: "bg-gray-50"
  },
  {
    id: "profissional",
    name: "Profissional",
    price: 79,
    priceFormatted: "R$ 79/mês",
    commission: 10,
    features: [
      "Tudo do Essencial",
      "Comissão reduzida (10%)",
      "Melhor posicionamento na busca",
      "Acesso a mais pacientes",
      "Relatórios básicos",
      "Prioridade no matching"
    ],
    icon: <Star className="w-8 h-8" />,
    color: "from-[#2F80D3] to-[#2F80D3]/80",
    bgColor: "bg-blue-50"
  },
  {
    id: "premium",
    name: "Premium",
    price: 149,
    priceFormatted: "R$ 149/mês",
    commission: 3,
    features: [
      "Tudo do Profissional",
      "Comissão mínima (3%)",
      "Destaque máximo na plataforma",
      "Leads prioritários",
      "Participação em campanhas",
      "Analytics avançado",
      "(Futuro) IA para apoio clínico"
    ],
    icon: <Crown className="w-8 h-8" />,
    color: "from-[#E03673] to-[#E03673]/80",
    bgColor: "bg-pink-50"
  }
];

export default function TherapistSubscriptionPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  const router = useRouter();
  
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSubscription();
  }, []);

  async function loadSubscription() {
    try {
      const data = await apiCall({
        url: "/api/therapist/subscription",
        requireAuth: true
      });
      setSubscription(data || null);
    } catch (err) {
      console.error("Erro ao carregar assinatura:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planId: string) {
    if (planId === "essencial") {
      setError("Para voltar ao plano Essencial, cancele sua assinatura atual.");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    // Verificar se o token é válido antes de tentar
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    
    setUpgrading(planId);
    setError("");
    
    try {
      console.log("📡 Chamando API para criar checkout...");
      
      // 🔥 SEM TIPO GENÉRICO - IGUAL AO DASHBOARD
      const response = await apiCall({
        url: "/api/payments/create-subscription-checkout",
        method: "POST",
        body: { plan: planId },
        requireAuth: true
      });
      
      console.log("✅ Resposta recebida:", response);
      
      // 🔥 ACESSAR checkout_url DA MESMA FORMA QUE O DASHBOARD
      if (response?.checkout_url) {
        console.log("🔗 Redirecionando para Stripe:", response.checkout_url);
        // 🔥 USAR window.location.href - IGUAL AO DASHBOARD
        window.location.href = response.checkout_url;
      } else {
        throw new Error("URL de checkout não recebida");
      }
      
    } catch (err: any) {
      console.error("❌ Erro detalhado:", err);
      
      // Se for erro de autenticação, limpar tokens e redirecionar
      if (err.message?.includes("401") || err.message?.includes("Token") || err.message?.includes("token")) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        router.push('/auth/login');
        return;
      }
      
      setError(err.message || "Erro ao processar assinatura");
      setTimeout(() => setError(""), 5000);
    } finally {
      setUpgrading(null);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura? Você voltará ao plano Essencial (20% de comissão).")) {
      return;
    }
    
    try {
      await apiCall({
        url: "/api/therapist/subscription/cancel",
        method: "POST",
        requireAuth: true
      });
      setSuccess("Assinatura cancelada com sucesso! Você voltará ao plano Essencial no fim do período.");
      await loadSubscription();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      console.error("Erro ao cancelar:", err);
      setError(err.message || "Erro ao cancelar assinatura");
      setTimeout(() => setError(""), 3000);
    }
  }

  const getCurrentPlan = () => {
    if (!subscription) return PLANS[0];
    return PLANS.find(p => p.id === subscription.plan) || PLANS[0];
  };

  const currentPlan = getCurrentPlan();

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Planos e Assinatura</h1>
            <p className="text-sm text-gray-600 mt-1">
              Escolha o plano ideal para sua prática e aumente seus ganhos
            </p>
          </div>
          <Link href="/therapist/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            Voltar ao dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Plano atual */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full bg-[#E03673]/10 flex items-center justify-center`}>
                <CreditCard className="w-5 h-5 text-[#E03673]" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Plano Atual</h2>
            </div>
            {subscription?.status === "active" && subscription?.cancel_at_period_end && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                Cancelará em {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-gray-900">{currentPlan.name}</h3>
                <span className="text-sm text-gray-500">
                  ({currentPlan.commission}% de comissão)
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {currentPlan.id === "essencial" 
                  ? "Comissão padrão de 20% sobre cada sessão"
                  : `Comissão reduzida de ${currentPlan.commission}% sobre cada sessão`
                }
              </p>
            </div>
            
            {subscription?.status === "active" && subscription.plan !== "essencial" && (
              <button
                onClick={handleCancelSubscription}
                className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Cancelar assinatura
              </button>
            )}
          </div>
          
          {subscription?.status === "active" && subscription.current_period_end && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                <span>
                  Próxima cobrança: {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Comparativo de planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = subscription?.plan === plan.id;
            const isUpgrading = upgrading === plan.id;
            
            return (
              <div
                key={plan.id}
                className={`rounded-xl shadow-sm border transition-all hover:shadow-md ${
                  isCurrent
                    ? "border-[#E03673] ring-2 ring-[#E03673]/20"
                    : "border-gray-200"
                } ${plan.bgColor}`}
              >
                <div className={`p-6 rounded-t-xl bg-gradient-to-r ${plan.color} text-white`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{plan.name}</h3>
                      <p className="text-2xl font-bold mt-2">{plan.priceFormatted}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      {plan.icon}
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Comissão por sessão</p>
                    <p className="text-2xl font-bold text-gray-900">{plan.commission}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {plan.commission === 20 && "Comissão padrão"}
                      {plan.commission === 10 && "Economize 10% em comissões"}
                      {plan.commission === 3 && "Economize 17% em comissões"}
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-3">Benefícios</p>
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {plan.id === "essencial" ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed"
                    >
                      Plano gratuito
                    </button>
                  ) : isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg bg-green-100 text-green-600 cursor-not-allowed"
                    >
                      ✓ Plano atual
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      disabled={!!upgrading}
                      className="w-full py-2.5 rounded-lg bg-[#E03673] hover:bg-[#c02c5e] text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isUpgrading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Assinar {plan.name}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Informações adicionais */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Por que assinar um plano?</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Aumente seus ganhos
              </p>
              <p className="text-xs text-gray-500">
                Comissão reduzida significa mais dinheiro no seu bolso. Em 20 sessões de R$200, a diferença entre 20% e 3% é de R$680!
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
                <Star className="w-4 h-4 text-[#2F80D3]" />
                Mais visibilidade
              </p>
              <p className="text-xs text-gray-500">
                Planos Profissional e Premium garantem melhor posicionamento na busca e mais pacientes para você.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-600" />
                Ferramentas exclusivas
              </p>
              <p className="text-xs text-gray-500">
                Acesso a relatórios avançados e futuramente IA para apoio clínico e organização.
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-800 mb-1 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-orange-600" />
                Cancelamento flexível
              </p>
              <p className="text-xs text-gray-500">
                Cancele quando quiser. Você volta ao plano Essencial e continua usando a plataforma normalmente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}