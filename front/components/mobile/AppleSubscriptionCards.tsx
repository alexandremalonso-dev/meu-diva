"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Crown, Star, Sparkles } from "lucide-react";
import { BACKEND_URL } from "@/config";

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  dark: "#3A3B21",
};

type PlanId = "essencial" | "profissional" | "premium";

interface PlanInfo {
  id: PlanId;
  productId: string;
  name: string;
  priceLabel: string;
  commission: string;
  features: string[];
  icon: React.ElementType;
  highlight?: boolean;
}

const PLANS: PlanInfo[] = [
  {
    id: "essencial",
    productId: "003",
    name: "Essencial",
    priceLabel: "R$ 14,90/mês",
    commission: "20% de comissão por sessão",
    features: ["Perfil na busca", "Agenda online", "Videochamadas"],
    icon: Sparkles,
  },
  {
    id: "profissional",
    productId: "001",
    name: "Profissional",
    priceLabel: "R$ 92,90/mês",
    commission: "10% de comissão por sessão",
    features: ["Tudo do Essencial", "Destaque na busca", "Relatórios avançados"],
    icon: Star,
    highlight: true,
  },
  {
    id: "premium",
    productId: "002",
    name: "Premium",
    priceLabel: "R$ 175,90/mês",
    commission: "3% de comissão por sessão",
    features: ["Tudo do Profissional", "Topo da busca", "Suporte prioritário"],
    icon: Crown,
  },
];

interface SubscriptionStatus {
  plan: PlanId;
  status: string;
  payment_provider: string | null;
  current_period_end: string | null;
}

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

function isIOSNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return isNativeApp() && cap?.getPlatform?.() === "ios";
}

export function AppleSubscriptionCards() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasingPlan, setPurchasingPlan] = useState<PlanId | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${BACKEND_URL}/api/payments/therapist/subscription/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Erro ao buscar assinatura");
      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      console.error("❌ Erro ao carregar assinatura:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (plan: PlanInfo) => {
    setErrorMsg(null);
    setPurchasingPlan(plan.id);

    try {
      const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");

      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      if (!isBillingSupported) {
        throw new Error("Compras não suportadas neste dispositivo");
      }

      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: plan.productId,
        productType: PURCHASE_TYPE.SUBS,
      });

      const jws = (transaction as any).jwsRepresentation;
      if (!jws) {
        throw new Error("Não foi possível obter a confirmação da compra");
      }

      const token = localStorage.getItem("access_token");
      const response = await fetch(`${BACKEND_URL}/api/payments/apple/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ signed_transaction: jws }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Erro ao validar compra");
      }

      await loadSubscription();
      window.dispatchEvent(new Event("refreshProfile"));
    } catch (err: any) {
      const message = err?.message || "";
      if (message.toLowerCase().includes("cancel")) {
        return;
      }
      console.error("❌ Erro na compra:", err);
      setErrorMsg(message || "Erro ao processar a compra. Tente novamente.");
    } finally {
      setPurchasingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { AppLauncher } = await import("@capacitor/app-launcher");
      await AppLauncher.openUrl({ url: "itms-apps://apps.apple.com/account/subscriptions" });
    } catch (err) {
      console.error("❌ Erro ao abrir gerenciamento de assinatura:", err);
    }
  };

  if (!isIOSNative()) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
        <Loader2 size={24} className="animate-spin" color={COLORS.primary} />
      </div>
    );
  }

  const hasPaidPlan = subscription && subscription.plan !== "essencial" && subscription.status === "active";

  if (hasPaidPlan && subscription) {
    const currentPlanInfo = PLANS.find((p) => p.id === subscription.plan);
    return (
      <div style={{
        background: "linear-gradient(135deg, #E03673, #c02c5e)",
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {currentPlanInfo && <currentPlanInfo.icon size={18} />}
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            Plano {currentPlanInfo?.name || subscription.plan}
          </div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 12 }}>
          {subscription.payment_provider === "apple_iap"
            ? "Assinatura via App Store"
            : "Assinatura ativa"}
        </div>
        <button
          onClick={handleManageSubscription}
          style={{
            background: "rgba(255,255,255,0.2)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 8,
            padding: "8px 14px",
            color: "white",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Gerenciar assinatura
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: "#888", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 10 }}>
        POTENCIALIZE SUA PRÁTICA
      </div>

      {errorMsg && (
        <div style={{
          background: "#FEE2E2", color: "#991B1B", borderRadius: 10,
          padding: "8px 12px", fontSize: 12, marginBottom: 10,
        }}>
          {errorMsg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PLANS.filter((p) => p.id !== "essencial").map((plan) => {
          const Icon = plan.icon;
          const isPurchasing = purchasingPlan === plan.id;
          return (
            <div
              key={plan.id}
              style={{
                background: plan.highlight
                  ? "linear-gradient(135deg, #E03673, #c02c5e)"
                  : "white",
                border: plan.highlight ? "none" : "0.5px solid #E5E7EB",
                borderRadius: 14,
                padding: 14,
                color: plan.highlight ? "white" : COLORS.dark,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon size={16} color={plan.highlight ? "white" : COLORS.primary} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{plan.name}</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{plan.priceLabel}</span>
              </div>
              <div style={{ fontSize: 11, opacity: plan.highlight ? 0.9 : 0.7, marginBottom: 10 }}>
                {plan.commission}
              </div>
              <div style={{ marginBottom: 12 }}>
                {plan.features.map((feature) => (
                  <div key={feature} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Check size={12} color={plan.highlight ? "white" : COLORS.secondary} />
                    <span style={{ fontSize: 11, opacity: plan.highlight ? 0.95 : 0.8 }}>{feature}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handlePurchase(plan)}
                disabled={purchasingPlan !== null}
                style={{
                  width: "100%",
                  background: plan.highlight ? "white" : COLORS.primary,
                  color: plan.highlight ? COLORS.primary : "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: purchasingPlan !== null ? "not-allowed" : "pointer",
                  opacity: purchasingPlan !== null && !isPurchasing ? 0.5 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {isPurchasing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Assinar"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}