"use client";

import { useState, useEffect } from "react";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, TrendingUp, CheckCircle, ArrowRight, Loader2, Sparkles, Star, Zap, Rocket, Percent, FileText } from "lucide-react";

const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  laranja: "#F59E0B",
  verde: "#10B981",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  branco: "#FFFFFF",
};

interface UpgradeCardProps {
  planName: string;
  planId: string;
  price: number;
  commission: string;
  description: string;
  features: string[];
  popular?: boolean;
  currentSaving?: number;
}

export function UpgradeCard({
  planName,
  planId,
  price,
  commission,
  description,
  features,
  popular = false,
  currentSaving = 0
}: UpgradeCardProps) {
  const { execute: apiCall } = useApi();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiCall({
        url: "/api/payments/create-subscription-checkout",
        method: "POST",
        body: { plan: planId },
        requireAuth: true
      });
      
      if (response?.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (error) {
      console.error("Erro ao criar checkout:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  // Ícone baseado no plano
  const getIcon = () => {
    if (planId === "premium") {
      return <Crown className="w-6 h-6" />;
    }
    if (planId === "profissional") {
      return <TrendingUp className="w-6 h-6" />;
    }
    return <Star className="w-6 h-6" />;
  };

  // Cor de destaque baseada no plano
  const getAccentColor = () => {
    if (planId === "premium") {
      return CORES.rosa;
    }
    if (planId === "profissional") {
      return CORES.laranja;
    }
    return CORES.azul;
  };

  return (
    <div className={`rounded-xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 duration-300 ${
      popular 
        ? "bg-gradient-to-br from-[#E03673] to-[#E03673]/90 text-white shadow-md ring-2 ring-[#E03673]/30" 
        : "bg-white border-2 border-gray-100 text-gray-800"
    }`}>
      {popular && (
        <div className="bg-[#F59E0B] text-white text-xs font-bold text-center py-1 flex items-center justify-center gap-1">
          <Zap className="w-3 h-3" />
          MAIS POPULAR
          <Zap className="w-3 h-3" />
        </div>
      )}
      
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-full ${
              popular ? "bg-white/20" : "bg-opacity-10"
            }`} style={{ backgroundColor: popular ? "transparent" : `${getAccentColor()}20` }}>
              <div style={{ color: popular ? CORES.branco : getAccentColor() }}>
                {getIcon()}
              </div>
            </div>
            <h3 className={`text-xl font-bold ${popular ? "text-white" : "text-gray-800"}`}>
              {planName}
            </h3>
          </div>
          {currentSaving > 0 && (
            <div className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${
              popular ? "bg-white/20 text-white" : "bg-[#F59E0B]/10 text-[#F59E0B]"
            }`}>
              <Rocket className="w-3 h-3" />
              Economia de R$ {currentSaving}
            </div>
          )}
        </div>
        
        <p className={`text-sm mb-4 ${popular ? "text-white/80" : "text-gray-500"}`}>
          {description}
        </p>
        
        <div className="mb-4 flex items-baseline gap-2 flex-wrap">
          <span className={`text-3xl font-bold ${popular ? "text-white" : "text-gray-800"}`}>
            {formatPrice(price)}
          </span>
          <span className={`text-sm ${popular ? "text-white/70" : "text-gray-400"}`}>/mês</span>
          <div className={`ml-2 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
            popular ? "bg-white/20 text-white" : "bg-gray-100 text-gray-700"
          }`}>
            <Percent className="w-3 h-3" />
            Comissão: {commission}
          </div>
        </div>
        
        <ul className="space-y-2 mb-6">
          {features.map((feature, index) => {
            // Destacar relatórios com ícone específico
            const isReportFeature = feature.toLowerCase().includes("relatório");
            return (
              <li key={index} className="flex items-start gap-2 text-sm">
                {isReportFeature ? (
                  <FileText className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    popular ? "text-white" : "text-[#2F80D3]"
                  }`} />
                ) : (
                  <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    popular ? "text-white" : "text-[#F59E0B]"
                  }`} />
                )}
                <span className={popular ? "text-white/90" : "text-gray-600"}>
                  {feature}
                </span>
              </li>
            );
          })}
        </ul>
        
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className={`w-full py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
            popular
              ? "bg-white text-[#E03673] hover:bg-gray-100"
              : "bg-[#F59E0B] text-white hover:bg-[#d97706]"
          } disabled:opacity-50`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Upgrade Agora
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}