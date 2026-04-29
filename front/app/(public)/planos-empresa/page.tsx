"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InstitucionalHeader } from "@/components/layout/InstitucionalHeader";
import { InstitucionalFooter } from "@/components/layout/InstitucionalFooter";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import {
  CheckCircle, Crown, Star, ArrowRight,
  Loader2, TrendingUp, Users,
  AlertCircle, UserPlus,
  Building2, Zap, Shield, Heart, DollarSign, Headphones
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
  branco: "#FFFFFF",
};

interface EmpresaPlanoFromAPI {
  id: number;
  nome: string;
  chave: string;
  preco_mensal_por_colaborador: number;
  sessoes_inclusas_por_colaborador: number;
  descricao: string | null;
  ativo: boolean;
}

interface ProcessedEmpresaPlan {
  id: string;
  name: string;
  price: number;
  sessionsIncluded: number;
  description: string;
  features: string[];
  icon: JSX.Element;
  color: string;
  popular: boolean;
}

const getFeaturesByPlan = (chave: string): string[] => {
  switch (chave) {
    case "prata":
      return [
        "Acesso à plataforma para todos",
        "Dashboard básico para o RH",
        "Relatório mensal de adesão",
        "Documentação para conformidade NR-1",
        "Diagnóstico de saúde mental",
        "Capacitação de lideranças"
      ];
    case "ouro":
      return [
        "Tudo do Plano Prata",
        "Diagnóstico de saúde mental da equipe",
        "Dashboard avançado com indicadores de bem-estar",
        "Suporte prioritário ao RH",
        "Conformidade NR-1 documentada"
      ];
    case "diamante":
      return [
        "Tudo do Plano Ouro",
        "Capacitação de lideranças inclusa",
        "Palestras e workshops mensais",
        "Relatórios personalizados para o board",
        "Gerente de conta dedicado",
        "Conformidade NR-1 completa e auditável"
      ];
    default:
      return [];
  }
};

const STATS = [
  { icon: <DollarSign className="w-6 h-6" />, value: "R$3,70", label: "retornados para cada R$1 investido", source: "OMS, Harvard Business Review" },
  { icon: <TrendingUp className="w-6 h-6" />, value: "30%", label: "↓ no índice de afastamentos médicos", source: "Deloitte Global Mental Health Survey" },
  { icon: <Users className="w-6 h-6" />, value: "84%", label: "dos colaboradores relatam melhora em produtividade", source: "Harvard Business Review" },
  { icon: <Heart className="w-6 h-6" />, value: "97%", label: "dos usuários sentem melhora na qualidade de vida", source: "Pesquisa interna Meu Divã" }
];

export default function PlanosEmpresaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [planosAPI, setPlanosAPI] = useState<EmpresaPlanoFromAPI[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    const loadPlanos = async () => {
      setLoadingPlanos(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/empresa/planos-publicos`);
        if (!response.ok) {
          throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        // 🔥 VERIFICA SE RETORNOU DADOS VÁLIDOS
        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error("Nenhum plano encontrado no banco de dados");
        }
        
        setPlanosAPI(data);
      } catch (err) {
        console.error("Erro ao carregar planos da API:", err);
        setError("Não foi possível carregar os planos. Entre em contato com o suporte.");
        setPlanosAPI([]);
      } finally {
        setLoadingPlanos(false);
      }
    };
    loadPlanos();
  }, []);

  const processPlans = (): ProcessedEmpresaPlan[] => {
    if (planosAPI.length === 0) return [];
    return planosAPI.filter(p => p.ativo).map((plano) => ({
      id: plano.chave,
      name: plano.nome,
      price: plano.preco_mensal_por_colaborador,
      sessionsIncluded: plano.sessoes_inclusas_por_colaborador,
      description: plano.descricao || (plano.chave === "prata" ? "Para começar a cuidar das pessoas" : plano.chave === "ouro" ? "Para empresas que levam saúde a sério" : "Para cultura de cuidado completa"),
      features: getFeaturesByPlan(plano.chave),
      icon: plano.chave === "prata" ? <Shield className="w-8 h-8" /> : plano.chave === "ouro" ? <Star className="w-8 h-8" /> : <Crown className="w-8 h-8" />,
      color: plano.chave === "prata" ? "from-gray-500 to-gray-600" : plano.chave === "ouro" ? "from-[#2F80D3] to-[#2F80D3]/80" : "from-[#E03673] to-[#E03673]/80",
      popular: plano.chave === "ouro"
    }));
  };

  const PLANS = processPlans();

  const handleSolicitarProposta = (planId: string) => {
    setLoading(true);
    router.push(`/auth/signup?role=empresa&plan=${planId}`);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  if (loadingPlanos) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F9FAFB" }}>
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", display: "flex", flexDirection: "column" }}>
        {isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />}
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Erro ao carregar planos</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
        {isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />}
      </div>
    );
  }

  if (PLANS.length === 0) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#F9FAFB", display: "flex", flexDirection: "column" }}>
        {isLoggedIn ? <PublicHeader /> : <InstitucionalHeader />}
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Nenhum plano disponível</h2>
            <p className="text-gray-600 mb-6">
              Não há planos cadastrados no momento. Entre em contato com o suporte para mais informações.
            </p>
          </div>
        </div>
        {isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />}
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
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <Building2 className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Planos corporativos
            </h1>
            <p className="text-xl text-white/90 max-w-2xl mx-auto">
              Escolha o plano certo para o tamanho da sua empresa
            </p>
            <p className="text-sm text-white/70 mt-2">
              Todos os planos incluem acesso à plataforma, dashboard do RH e suporte dedicado. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "32px 16px", flex: 1, width: "100%" }}>

        {/* Planos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl ${plan.popular ? "ring-2 ring-[#E03673] transform scale-105" : ""}`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-[#E03673] text-white px-4 py-1 text-sm font-medium rounded-bl-lg flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Mais escolhido
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
                  <p className="text-2xl font-bold">{formatNumber(plan.price)}</p>
                  <p className="text-white/70 text-sm mt-1">por colaborador/mês</p>
                </div>
              </div>
              <div className="p-6 bg-white">
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-semibold text-gray-700">Sessões inclusas por colaborador</p>
                  <p className="text-2xl font-bold text-[#E03673]">{plan.sessionsIncluded} sessão(ões)/mês</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSolicitarProposta(plan.id)}
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    plan.id === "ouro" 
                      ? "bg-[#E03673] hover:bg-[#c02c5e] text-white"
                      : plan.id === "diamante" 
                      ? "bg-gradient-to-r from-[#E03673] to-[#c02c5e] hover:opacity-90 text-white"
                      : "border-2 border-[#2F80D3] text-[#2F80D3] hover:bg-[#2F80D3] hover:text-white"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecionando...
                    </>
                  ) : (
                    <>
                      Solicitar proposta
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            A partir de 10 colaboradores · Sessões não acumulam mês a mês · Cancele quando quiser ·
            Proposta personalizada com valores para o porte da sua empresa
          </p>
        </div>

        {/* Estatísticas */}
        <div className="mt-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">O custo do descuido com a saúde emocional é real</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-[#E03673]/10 flex items-center justify-center mx-auto mb-4">
                  <div className="text-[#E03673]">{stat.icon}</div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
                <p className="text-xs text-gray-400 mt-2">{stat.source}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-400">Fontes: OMS, Harvard Business Review, Deloitte Global Mental Health Survey</p>
          </div>
        </div>

        {/* CTA Final com WhatsApp */}
        <div className="mt-12 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup?role=empresa">
              <button className="px-8 py-3 bg-[#2F80D3] hover:bg-[#236bb3] text-white rounded-xl font-medium transition-colors inline-flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Cadastrar minha empresa
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a
              href="https://wa.me/553121812810?text=Olá! Gostaria de mais informações sobre os planos empresariais do Meu Divã."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 border-2 border-gray-300 hover:border-[#E03673] text-gray-700 hover:text-[#E03673] rounded-xl font-medium transition-colors"
            >
              <Headphones className="w-4 h-4" />
              Falar com consultor
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      {isLoggedIn ? <PublicFooter /> : <InstitucionalFooter />}

    </div>
  );
}