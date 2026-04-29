"use client";

import { useEffect, useState } from "react";
import Link from "next/link";  // 🔥 ADICIONE ESTA LINHA
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, Filter, Loader2, AlertCircle, TrendingUp, TrendingDown, Tag } from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Commission {
  id: number;
  appointment_id: number;
  session_price: number;
  commission_rate: number;
  commission_amount: number;
  net_amount: number;
  created_at: string;
  is_refund: boolean;
  appointment?: {
    id: number;
    starts_at: string;
    patient_name?: string;
  };
}

interface Subscription {
  id: number;
  plan: string;
  status: string;
  current_period_end: string;
}

export default function TherapistWalletPage() {
  const { user } = useAuth();
  const { execute: apiCall } = useApi();
  
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 🔥 Removido tipo genérico - usando as assertion
      const commissionsData = await apiCall({
        url: "/api/therapist/commissions",
        requireAuth: true
      }) as Commission[];
      setCommissions(commissionsData || []);
      
      const subscriptionData = await apiCall({
        url: "/api/therapist/subscription",
        requireAuth: true
      }) as Subscription;
      setSubscription(subscriptionData || null);
      
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      setError(err.message || "Erro ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const totalNetReceived = commissions
    .filter(c => !c.is_refund)
    .reduce((sum, c) => sum + c.net_amount, 0);
    
  const totalCommissionPaid = commissions
    .filter(c => !c.is_refund)
    .reduce((sum, c) => sum + c.commission_amount, 0);
    
  const totalGross = totalNetReceived + totalCommissionPaid;

  const filteredCommissions = commissions.filter(c => {
    if (filter === "all") return true;
    if (filter === "net") return !c.is_refund;
    if (filter === "refund") return c.is_refund;
    return true;
  });

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      essencial: "Essencial",
      profissional: "Profissional",
      premium: "Premium"
    };
    return labels[plan] || plan;
  };

  const getPlanColor = (plan: string) => {
    const colors: Record<string, string> = {
      essencial: "bg-gray-100 text-gray-700",
      profissional: "bg-blue-100 text-blue-700",
      premium: "bg-pink-100 text-pink-700"
    };
    return colors[plan] || "bg-gray-100 text-gray-700";
  };

  const getCommissionRateLabel = (rate: number) => {
    return `${rate}% de comissão`;
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  const currentPlan = subscription?.plan || "essencial";
  const currentPlanLabel = getPlanLabel(currentPlan);
  const currentPlanColor = getPlanColor(currentPlan);
  const currentCommissionRate = currentPlan === "essencial" ? 20 : currentPlan === "profissional" ? 10 : 3;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Minha Carteira</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gerencie seus recebimentos líquidos (já descontada a comissão da plataforma)
            </p>
          </div>
          <Link href="/therapist/subscription" className="text-sm text-[#E03673] hover:text-[#c02c5e] flex items-center gap-1">
            <Tag className="w-4 h-4" />
            Gerenciar plano
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

        {/* Cards de resumo financeiro com TAG do plano */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/80">Total Recebido (Líquido)</p>
              <TrendingUp className="w-5 h-5 text-white/70" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalNetReceived)}</p>
            <p className="text-xs text-white/70 mt-1">Valor após comissão da plataforma</p>
          </div>
          
          <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/80">Comissão Paga</p>
              <TrendingDown className="w-5 h-5 text-white/70" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalCommissionPaid)}</p>
            <p className="text-xs text-white/70 mt-1">Taxa da plataforma</p>
          </div>
          
          <div className="bg-gradient-to-r from-[#10B981] to-[#10B981]/80 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-white/80">Total Bruto</p>
              <Wallet className="w-5 h-5 text-white/70" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalGross)}</p>
            <p className="text-xs text-white/70 mt-1">Valor total das sessões</p>
          </div>
        </div>

        {/* Informações do plano atual com TAG */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E03673]/10 flex items-center justify-center">
                <Tag className="w-5 h-5 text-[#E03673]" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Plano atual</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">
                    {currentPlanLabel}
                  </p>
                  {/* TAG DO PLANO */}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${currentPlanColor}`}>
                    {currentPlanLabel}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({getCommissionRateLabel(currentCommissionRate)})
                  </span>
                </div>
              </div>
            </div>
            {subscription?.status === "active" && subscription?.current_period_end && (
              <p className="text-xs text-gray-400">
                Próxima cobrança: {formatDate(subscription.current_period_end)}
              </p>
            )}
            {subscription?.status !== "active" && currentPlan === "essencial" && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                Plano gratuito
              </span>
            )}
          </div>
          
          {/* Barra de progresso de economia */}
          {currentPlan !== "essencial" && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Comissão padrão: 20%</span>
                <span>Sua comissão: {currentCommissionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-[#E03673] h-2 rounded-full transition-all duration-500"
                  style={{ width: `${((20 - currentCommissionRate) / 20) * 100}%` }}
                />
              </div>
              <p className="text-xs text-green-600 mt-2">
                ✨ Você economiza {20 - currentCommissionRate}% em comissões por sessão!
              </p>
            </div>
          )}
        </div>

        {/* Extrato de recebimentos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#E03673]" />
              <h2 className="text-lg font-semibold">Histórico de recebimentos</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="p-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#E03673] focus:border-[#E03673] outline-none"
              >
                <option value="all">Todas as transações</option>
                <option value="net">Recebimentos</option>
                <option value="refund">Estornos</option>
              </select>
            </div>
          </div>

          {filteredCommissions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Wallet className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum recebimento encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCommissions.map((commission) => (
                <div
                  key={commission.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    commission.is_refund
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900">
                        Sessão #{commission.appointment_id}
                      </p>
                      {commission.is_refund && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          Estorno
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {commission.appointment?.starts_at 
                        ? formatDate(commission.appointment.starts_at)
                        : formatDate(commission.created_at)}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        Taxa: {commission.commission_rate}%
                      </span>
                      <span className="text-xs text-gray-400">
                        Comissão: {formatCurrency(commission.commission_amount)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${
                      commission.is_refund ? "text-red-600" : "text-green-600"
                    }`}>
                      {commission.is_refund ? "-" : "+"}{formatCurrency(Math.abs(commission.net_amount))}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Bruto: {formatCurrency(commission.session_price)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}