"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Crown, Star, ArrowRight, Loader2, AlertCircle,
  CreditCard, Calendar, Shield, Sparkles, TrendingUp, RefreshCw,
  Zap, PauseCircle, PlayCircle, XCircle, ChevronDown, ChevronUp,
  Receipt, DollarSign, Info, ExternalLink
} from "lucide-react";

const PLAN_CONFIG: Record<string, {
  name: string; price: string; commission: number;
  color: string; bgColor: string; borderColor: string; icon: React.ReactNode;
  features: string[];
}> = {
  essencial: {
    name: "Essencial", price: "Grátis", commission: 20,
    color: "from-gray-500 to-gray-600", bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    icon: <Shield className="w-6 h-6" />,
    features: ["Perfil na plataforma", "Agenda e gestão de sessões", "Videochamada integrada", "Pagamento automático", "Suporte padrão"]
  },
  profissional: {
    name: "Profissional", price: "R$ 79/mês", commission: 10,
    color: "from-[#2F80D3] to-blue-500", bgColor: "bg-blue-50",
    borderColor: "border-blue-400",
    icon: <Star className="w-6 h-6" />,
    features: ["Tudo do Essencial", "Comissão reduzida (10%)", "Melhor posicionamento na busca", "Relatórios básicos", "Prioridade no matching"]
  },
  premium: {
    name: "Premium", price: "R$ 149/mês", commission: 3,
    color: "from-[#E03673] to-pink-500", bgColor: "bg-pink-50",
    borderColor: "border-[#E03673]",
    icon: <Crown className="w-6 h-6" />,
    features: ["Tudo do Profissional", "Comissão mínima (3%)", "Destaque máximo na plataforma", "Leads prioritários", "Analytics avançado"]
  }
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "Ativa", color: "text-green-700", bg: "bg-green-100" },
  paused: { label: "Pausada", color: "text-yellow-700", bg: "bg-yellow-100" },
  cancelled: { label: "Cancelada", color: "text-red-700", bg: "bg-red-100" },
  past_due: { label: "Pagamento pendente", color: "text-orange-700", bg: "bg-orange-100" },
};

interface SubscriptionData {
  subscription: {
    id: number | null;
    plan: string;
    plan_name: string;
    status: string;
    commission_rate: number;
    payment_provider: string | null;
    mp_subscription_id: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    created_at: string | null;
  };
  billing_history: Array<{
    id: string;
    date: string;
    amount: number;
    status: string;
    description: string;
  }>;
  earnings_summary: {
    total_sessions: number;
    total_earned: number;
    total_commission_paid: number;
    recent: Array<{
      date: string;
      session_price: number;
      commission_rate: number;
      commission_amount: number;
      net_amount: number;
    }>;
  };
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function TherapistSubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPlans, setShowPlans] = useState(false);
  const [showEarnings, setShowEarnings] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const result = await api("/api/payments/therapist/subscription");
      setData(result);
    } catch (err) {
      console.error(err);
      setError("Erro ao carregar dados da assinatura");
    } finally {
      setLoading(false);
    }
  }

  function showMsg(type: "success" | "error", msg: string) {
    if (type === "success") { setSuccess(msg); setTimeout(() => setSuccess(""), 5000); }
    else { setError(msg); setTimeout(() => setError(""), 5000); }
  }

  async function handleAction(action: "pause" | "resume" | "cancel") {
    const confirmMessages = {
      pause: "Pausar sua assinatura? Você voltará ao plano Essencial (20% de comissão) temporariamente e poderá reativar quando quiser.",
      resume: "Reativar sua assinatura?",
      cancel: "Cancelar sua assinatura permanentemente? Você voltará ao plano Essencial (20% de comissão) ao final do período atual."
    };
    if (!confirm(confirmMessages[action])) return;

    setActionLoading(action);
    try {
      const endpoints = {
        pause: "/api/payments/therapist/subscription/pause",
        resume: "/api/payments/therapist/subscription/resume",
        cancel: "/api/payments/therapist/subscription/cancel"
      };
      await api(endpoints[action], { method: "POST" });
      const msgs = {
        pause: "Assinatura pausada. Você pode reativar quando quiser.",
        resume: "Assinatura reativada com sucesso!",
        cancel: "Assinatura cancelada. Você continuará no plano atual até o fim do período."
      };
      showMsg("success", msgs[action]);
      await loadData();
    } catch (err: any) {
      showMsg("error", err.message || "Erro ao processar ação");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  const sub = data?.subscription;
  const plan = PLAN_CONFIG[sub?.plan || "essencial"];
  const statusCfg = STATUS_CONFIG[sub?.status || "active"];
  const isPaid = sub?.plan !== "essencial";
  const isActive = sub?.status === "active";
  const isPaused = sub?.status === "paused";
  const isApple = sub?.payment_provider === "apple_iap";
  const earnings = data?.earnings_summary;

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Minha Assinatura</h1>
            <p className="text-sm text-gray-500 mt-1">Gerencie seu plano e acompanhe seu histórico</p>
          </div>
          <Link href="/therapist/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />{success}
          </div>
        )}

        {/* Card principal — Plano atual */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className={`bg-gradient-to-r ${plan.color} p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  {plan.icon}
                </div>
                <div>
                  <p className="text-white/80 text-sm">Plano atual</p>
                  <h2 className="text-2xl font-bold">{plan.name}</h2>
                </div>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                  {statusCfg.label}
                </span>
                <p className="text-white/80 text-sm mt-2">{plan.price}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Comissão */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-[#E03673]" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Comissão por sessão</p>
                  <p className="text-xs text-gray-500">Descontada automaticamente de cada pagamento</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-[#E03673]">{plan.commission}%</span>
            </div>

            {/* Período */}
            {isPaid && sub?.current_period_start && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Início do período
                  </p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate(sub.current_period_start)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {sub.cancel_at_period_end ? "Cancela em" : "Próxima cobrança"}
                  </p>
                  <p className={`text-sm font-semibold ${sub.cancel_at_period_end ? "text-red-600" : "text-gray-900"}`}>
                    {formatDate(sub.current_period_end)}
                  </p>
                </div>
              </div>
            )}

            {/* Data de início da assinatura */}
            {isPaid && sub?.created_at && (
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Assinante desde {formatDate(sub.created_at)}
                {sub.payment_provider && ` · via ${sub.payment_provider === "apple_iap" ? "Apple" : "Mercado Pago"}`}
              </p>
            )}

            {/* Aviso Apple */}
            {isApple && (
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-600">
                  Sua assinatura foi feita pela App Store. Para gerenciar, pausar ou cancelar, acesse <strong>Ajustes → Apple ID → Assinaturas</strong> no seu iPhone.
                </p>
              </div>
            )}

            {/* Ações */}
            {isPaid && !isApple && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                {isActive && (
                  <button
                    onClick={() => handleAction("pause")}
                    disabled={!!actionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "pause" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
                    Pausar assinatura
                  </button>
                )}
                {isPaused && (
                  <button
                    onClick={() => handleAction("resume")}
                    disabled={!!actionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "resume" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                    Reativar assinatura
                  </button>
                )}
                {(isActive || isPaused) && !sub?.cancel_at_period_end && (
                  <button
                    onClick={() => handleAction("cancel")}
                    disabled={!!actionLoading}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === "cancel" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Cancelar assinatura
                  </button>
                )}
                {sub?.cancel_at_period_end && (
                  <div className="w-full p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Sua assinatura será cancelada em <strong>{formatDate(sub.current_period_end)}</strong>. Você continuará com os benefícios até essa data.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Upgrade */}
            {!isPaid && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-3">Reduza sua comissão e aumente seus ganhos:</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push("/subscription-checkout?plan=profissional")}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#2F80D3] text-white text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Star className="w-4 h-4" /> Profissional — R$79/mês
                  </button>
                  <button
                    onClick={() => router.push("/subscription-checkout?plan=premium")}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#E03673] text-white text-sm font-medium hover:bg-pink-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Crown className="w-4 h-4" /> Premium — R$149/mês
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo de ganhos */}
        {earnings && earnings.total_sessions > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={() => setShowEarnings(!showEarnings)}
              className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Resumo de Ganhos</p>
                  <p className="text-xs text-gray-500">{earnings.total_sessions} sessões · {formatCurrency(earnings.total_earned)} líquido</p>
                </div>
              </div>
              {showEarnings ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </button>

            {showEarnings && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100">
                <div className="grid grid-cols-3 gap-3 pt-4">
                  <div className="p-3 bg-green-50 rounded-xl text-center">
                    <p className="text-xs text-green-600 mb-1">Total recebido</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(earnings.total_earned)}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-xl text-center">
                    <p className="text-xs text-red-600 mb-1">Comissões pagas</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(earnings.total_commission_paid)}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl text-center">
                    <p className="text-xs text-blue-600 mb-1">Sessões</p>
                    <p className="text-lg font-bold text-blue-700">{earnings.total_sessions}</p>
                  </div>
                </div>

                {earnings.recent.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Últimas sessões</p>
                    <div className="space-y-2">
                      {earnings.recent.map((e, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                          <div>
                            <p className="text-gray-600">{formatDate(e.date)}</p>
                            <p className="text-xs text-gray-400">Comissão {e.commission_rate}% = {formatCurrency(e.commission_amount)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-700">+{formatCurrency(e.net_amount)}</p>
                            <p className="text-xs text-gray-400">de {formatCurrency(e.session_price)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Histórico de cobranças */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={() => setShowPlans(!showPlans)}
            className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#E03673]/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-[#E03673]" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Histórico de Cobranças</p>
                <p className="text-xs text-gray-500">
                  {data?.billing_history.length ? `${data.billing_history.length} registros encontrados` : "Nenhuma cobrança registrada"}
                </p>
              </div>
            </div>
            {showPlans ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {showPlans && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4">
              {data?.billing_history.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma cobrança encontrada</p>
                  {isApple && (
                    <p className="text-xs mt-1">Para cobranças Apple, acesse Ajustes → Apple ID → Assinaturas</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {data?.billing_history.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{bill.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(bill.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(bill.amount)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          bill.status === "approved" ? "bg-green-100 text-green-700" :
                          bill.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {bill.status === "approved" ? "Pago" : bill.status === "pending" ? "Pendente" : bill.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comparativo de planos colapsável */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-[#E03673]" />
            <h3 className="font-semibold text-gray-900">Comparativo de Planos</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(PLAN_CONFIG).map(([planId, cfg]) => {
              const isCurrent = sub?.plan === planId;
              return (
                <div key={planId} className={`rounded-xl border-2 p-4 transition-all ${isCurrent ? cfg.borderColor + " ring-2 ring-offset-1" : "border-gray-200"} ${cfg.bgColor}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${cfg.color} text-white flex items-center justify-center`}>
                      {cfg.icon}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{cfg.name}</p>
                      <p className="text-xs text-gray-500">{cfg.price}</p>
                    </div>
                    {isCurrent && <span className="ml-auto text-xs bg-[#E03673] text-white px-2 py-0.5 rounded-full">Atual</span>}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{cfg.commission}%</p>
                  <p className="text-xs text-gray-500 mb-3">comissão por sessão</p>
                  <ul className="space-y-1">
                    {cfg.features.slice(0, 3).map((f, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && planId !== "essencial" && (
                    <button
                      onClick={() => router.push(`/subscription-checkout?plan=${planId}`)}
                      className="mt-3 w-full py-1.5 text-xs rounded-lg bg-[#E03673] text-white font-medium hover:bg-pink-600 transition-colors"
                    >
                      Assinar {cfg.name}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Calculadora de economia */}
          <div className="mt-4 p-4 bg-gradient-to-r from-[#E03673]/5 to-[#2F80D3]/5 rounded-xl border border-gray-100">
            <p className="text-sm font-medium text-gray-800 mb-2 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#E03673]" />
              Quanto você economiza com o Premium?
            </p>
            <p className="text-xs text-gray-600">
              Em 20 sessões de R$200: comissão atual ({plan.commission}%) = {formatCurrency(20 * 200 * plan.commission / 100)},
              com Premium (3%) = {formatCurrency(20 * 200 * 3 / 100)}.
              Economia de <strong className="text-green-700">{formatCurrency(20 * 200 * (plan.commission - 3) / 100)}</strong> por mês.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}