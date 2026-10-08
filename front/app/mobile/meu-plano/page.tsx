"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Crown, Star, Shield, Sparkles, Loader2, AlertCircle,
  CheckCircle, PauseCircle, PlayCircle, XCircle, TrendingUp,
  Calendar, Receipt, ChevronDown, ChevronUp, CreditCard
} from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const PLAN_CONFIG: Record<string, { name: string; price: string; commission: number; icon: any }> = {
  basico:       { name: "Básico (cortesia)", price: "Grátis",       commission: 20, icon: Shield   },
  essencial:    { name: "Essencial",         price: "R$ 19,90/mês", commission: 20, icon: Sparkles },
  profissional: { name: "Profissional",      price: "R$ 79/mês",    commission: 10, icon: Star     },
  premium:      { name: "Premium",           price: "R$ 149/mês",   commission: 3,  icon: Crown    },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativa",               color: "#059669" },
  paused:   { label: "Pausada",             color: "#D97706" },
  cancelled:{ label: "Cancelada",           color: "#DC2626" },
  past_due: { label: "Pagamento pendente",  color: "#EA580C" },
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MeuPlanoPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "pause" | "resume" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEarnings, setShowEarnings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const result = await api("/api/payments/therapist/subscription");
      setData(result);
    } catch (e: any) {
      setError("Erro ao carregar assinatura.");
    } finally {
      setLoading(false);
    }
  }

  async function executeAction(action: "pause" | "resume" | "cancel") {
    setConfirmAction(null);
    setActionLoading(action);
    setError("");
    try {
      const endpoints: Record<string, string> = {
        pause:  "/api/payments/therapist/subscription/pause",
        resume: "/api/payments/therapist/subscription/resume",
        cancel: "/api/payments/therapist/subscription/cancel",
      };
      await api(endpoints[action], { method: "POST" });
      const msgs: Record<string, string> = {
        pause:  "Assinatura pausada. Reative quando quiser.",
        resume: "Assinatura reativada com sucesso!",
        cancel: "Cancelamento agendado. Seu plano continua até o fim do período.",
      };
      setSuccess(msgs[action]);
      setTimeout(() => setSuccess(""), 5000);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Erro ao processar ação.");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="animate-spin" color={COLORS.primary} />
      </div>
    );
  }

  const sub = data?.subscription;
  const earnings = data?.earnings_summary;
  const billing = data?.billing_history || [];
  const plan = sub?.plan || "basico";
  const cfg = PLAN_CONFIG[plan] || PLAN_CONFIG.basico;
  const Icon = cfg.icon;
  const statusCfg = STATUS_LABELS[sub?.status || "active"];
  const isPaid = plan !== "basico";
  const canCancel = isPaid && sub?.status === "active" && !sub?.cancel_at_period_end;
  const canPause  = isPaid && sub?.status === "active";
  const canResume = sub?.status === "paused";
  const isApple   = sub?.payment_provider === "apple_iap";

  const CONFIRM_MSGS: Record<string, string> = {
    pause:  "Novas cobranças serão pausadas. Você voltará temporariamente à comissão de 20% e poderá reativar quando quiser.",
    resume: "Seu plano será reativado e as cobranças mensais voltarão.",
    cancel: "O plano continua ativo até o fim do período atual. Após isso, você será rebaixado para o Básico.",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Meu Plano</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Assinatura e recursos</div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {/* Card plano atual */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={24} color={COLORS.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark }}>Plano {cfg.name}</div>
              <div style={{ fontSize: 12, color: statusCfg?.color || "#059669", fontWeight: 500 }}>
                {statusCfg?.label || "Ativo"}
                {sub?.cancel_at_period_end && " · cancelamento agendado"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{cfg.commission}%</div>
              <div style={{ fontSize: 10, color: "#6B7280" }}>comissão</div>
            </div>
          </div>

          {sub?.current_period_end && (
            <div style={{ background: "#F9FAFB", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={12} />
              {sub.cancel_at_period_end
                ? `Vale até ${fmt(sub.current_period_end)}`
                : `Próxima cobrança: ${fmt(sub.current_period_end)}`}
            </div>
          )}

          {isApple && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#6B7280" }}>
              Assinatura via App Store · gerencie em Ajustes → Apple ID → Assinaturas
            </div>
          )}

          {!isPaid && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
              Gerencie sua assinatura em meudivaonline.com
            </div>
          )}
        </div>

        {/* Ações */}
        {isPaid && !isApple && (canCancel || canPause || canResume) && (
          <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, marginBottom: 4 }}>Gerenciar assinatura</div>

            {canResume && (
              <button onClick={() => setConfirmAction("resume")} disabled={!!actionLoading}
                style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {actionLoading === "resume" ? <Loader2 size={14} className="animate-spin" /> : <><PlayCircle size={16} /> Reativar plano</>}
              </button>
            )}
            {canPause && (
              <button onClick={() => setConfirmAction("pause")} disabled={!!actionLoading}
                style={{ background: "white", color: COLORS.primary, border: `1px solid ${COLORS.primary}`, borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {actionLoading === "pause" ? <Loader2 size={14} className="animate-spin" /> : <><PauseCircle size={16} /> Pausar plano</>}
              </button>
            )}
            {canCancel && (
              <button onClick={() => setConfirmAction("cancel")} disabled={!!actionLoading}
                style={{ background: "white", color: "#DC2626", border: "1px solid #DC2626", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {actionLoading === "cancel" ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={16} /> Cancelar plano</>}
              </button>
            )}
          </div>
        )}

        {/* Resumo de ganhos */}
        {earnings && (
          <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #E5E7EB", overflow: "hidden" }}>
            <button onClick={() => setShowEarnings(!showEarnings)}
              style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={18} color="#059669" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>Resumo de Ganhos</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{earnings.total_sessions} sessões · {fmtMoney(earnings.total_earned)} líquido</div>
                </div>
              </div>
              {showEarnings ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
            </button>

            {showEarnings && (
              <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid #F3F4F6" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 12, marginBottom: 12 }}>
                  {[
                    { label: "Total recebido", value: fmtMoney(earnings.total_earned), color: "#059669", bg: "#D1FAE5" },
                    { label: "Comissões", value: fmtMoney(earnings.total_commission_paid), color: "#DC2626", bg: "#FEE2E2" },
                    { label: "Sessões", value: earnings.total_sessions, color: COLORS.secondary, bg: "#DBEAFE" },
                  ].map((item, i) => (
                    <div key={i} style={{ background: item.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: item.color, marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: item.color }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {earnings.recent?.slice(0, 3).map((e: any, i: number) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #F3F4F6", fontSize: 12 }}>
                    <div>
                      <div style={{ color: COLORS.dark }}>{fmt(e.date)}</div>
                      <div style={{ color: "#9CA3AF", fontSize: 11 }}>Comissão {e.commission_rate}%</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "#059669", fontWeight: 600 }}>+{fmtMoney(e.net_amount)}</div>
                      <div style={{ color: "#9CA3AF", fontSize: 11 }}>de {fmtMoney(e.session_price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Histórico de cobranças */}
        <div style={{ background: "white", borderRadius: 14, border: "0.5px solid #E5E7EB", overflow: "hidden" }}>
          <button onClick={() => setShowBilling(!showBilling)}
            style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Receipt size={18} color={COLORS.primary} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>Histórico de Cobranças</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{billing.length ? `${billing.length} registros` : "Nenhuma cobrança"}</div>
              </div>
            </div>
            {showBilling ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
          </button>
          {showBilling && (
            <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid #F3F4F6" }}>
              {billing.length === 0 ? (
                <div style={{ textAlign: "center", padding: "16px 0", color: "#9CA3AF", fontSize: 13 }}>
                  Nenhuma cobrança encontrada
                  {isApple && <div style={{ fontSize: 11, marginTop: 4 }}>Para cobranças Apple, acesse Ajustes → Apple ID → Assinaturas</div>}
                </div>
              ) : billing.map((b: any) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "0.5px solid #F3F4F6" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{b.description}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{fmt(b.date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{fmtMoney(b.amount)}</div>
                    <div style={{ fontSize: 11, color: b.status === "approved" ? "#059669" : b.status === "pending" ? "#D97706" : "#DC2626" }}>
                      {b.status === "approved" ? "Pago" : b.status === "pending" ? "Pendente" : b.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal confirmação */}
      {confirmAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: COLORS.dark }}>
              {confirmAction === "cancel" ? "Cancelar plano?" : confirmAction === "pause" ? "Pausar plano?" : "Reativar plano?"}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{CONFIRM_MSGS[confirmAction]}</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>
                Voltar
              </button>
              <button onClick={() => executeAction(confirmAction)} disabled={!!actionLoading}
                style={{ flex: 1, background: confirmAction === "cancel" ? "#DC2626" : COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
