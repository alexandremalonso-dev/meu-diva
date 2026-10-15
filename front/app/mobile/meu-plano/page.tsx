"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle, Crown, Star, Shield, Sparkles, TrendingUp,
  Loader2, AlertCircle, CreditCard, Calendar, ChevronDown, ChevronUp,
  Receipt, RefreshCw, PauseCircle, PlayCircle, XCircle
} from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const PLAN_CONFIG: Record<string, { name: string; price: string; commission: number; color: string; icon: any; features: string[] }> = {
  basico:       { name: "Básico",       price: "Grátis",       commission: 20, color: "#6B7280", icon: Shield,   features: ["Perfil na plataforma","Agenda e sessões","Videochamada integrada","Pagamento automático"] },
  essencial:    { name: "Essencial",    price: "R$19,90/mês",  commission: 20, color: "#6B7280", icon: Shield,   features: ["Tudo do Básico","Visibilidade no marketplace","Relatórios financeiros","7 dias de teste"] },
  profissional: { name: "Profissional", price: "R$79/mês",     commission: 10, color: "#2F80D3", icon: Star,    features: ["Tudo do Essencial","Comissão reduzida (10%)","Melhor posicionamento","Relatórios básicos"] },
  premium:      { name: "Premium",      price: "R$149/mês",    commission: 3,  color: "#E03673", icon: Crown,   features: ["Tudo do Profissional","Comissão mínima (3%)","Destaque máximo","Analytics avançado"] },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: "Ativa",              color: "#065F46", bg: "#D1FAE5" },
  paused:   { label: "Pausada",            color: "#92400E", bg: "#FEF3C7" },
  cancelled:{ label: "Cancelada",          color: "#991B1B", bg: "#FEE2E2" },
  past_due: { label: "Pagamento pendente", color: "#9A3412", bg: "#FFEDD5" },
};

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function isApple() {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.() && cap?.getPlatform?.() === "ios";
}

export default function MeuPlanoPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showEarnings, setShowEarnings] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"pause"|"resume"|"cancel"|null>(null);
  const apple = isApple();

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const result = await api("/api/payments/therapist/subscription");
      setData(result);
    } catch { setError("Erro ao carregar dados da assinatura"); }
    finally { setLoading(false); }
  }

  async function executeAction(action: "pause"|"resume"|"cancel") {
    setConfirmAction(null);
    setActionLoading(action);
    try {
      const endpoints: Record<string, string> = {
        pause: "/api/payments/therapist/subscription/pause",
        resume: "/api/payments/therapist/subscription/resume",
        cancel: "/api/payments/therapist/subscription/cancel",
      };
      await api(endpoints[action], { method: "POST" });
      const msgs: Record<string, string> = {
        pause: "Assinatura pausada. Você pode reativar quando quiser.",
        resume: "Assinatura reativada com sucesso!",
        cancel: "Assinatura cancelada. Você continuará no plano atual até o fim do período.",
      };
      setSuccess(msgs[action]);
      setTimeout(() => setSuccess(""), 5000);
      await load();
    } catch (e: any) {
      setError(e.message || "Erro ao processar ação");
      setTimeout(() => setError(""), 5000);
    } finally { setActionLoading(null); }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={32} className="animate-spin" color={COLORS.primary} />
    </div>
  );

  const sub = data?.subscription;
  const earnings = data?.earnings_summary;
  const billing = data?.billing_history || [];
  const planCfg = PLAN_CONFIG[sub?.plan] || PLAN_CONFIG.basico;
  const statusCfg = STATUS_CONFIG[sub?.status] || { label: sub?.status, color: "#374151", bg: "#F3F4F6" };
  const PlanIcon = planCfg.icon;
  const isPaid = sub?.plan && sub.plan !== "basico";
  const isActive = sub?.status === "active";

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 100 }}>
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Meu Plano</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Assinatura e histórico financeiro</div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><AlertCircle size={16} /> {error}</div>}
        {success && <div style={{ background: "#D1FAE5", color: "#065F46", borderRadius: 10, padding: "10px 14px", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><CheckCircle size={16} /> {success}</div>}

        {/* Plano atual */}
        <div style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
          <div style={{ background: `linear-gradient(135deg, ${planCfg.color}, ${planCfg.color}cc)`, padding: 20, color: "white" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PlanIcon size={24} />
                </div>
                <div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>Plano atual</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{planCfg.name}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 11, background: statusCfg.bg, color: statusCfg.color, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{statusCfg.label}</span>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{planCfg.price}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>Comissão por sessão</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: planCfg.color }}>{planCfg.commission}%</div>
              </div>
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 2 }}>{sub?.cancel_at_period_end ? "Encerra em" : "Próx. cobrança"}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{fmt(sub?.current_period_end)}</div>
              </div>
            </div>

            {/* Ações — só para planos pagos não Apple */}
            {isPaid && !apple && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {isActive && (
                  <button onClick={() => setConfirmAction("pause")} disabled={!!actionLoading}
                    style={{ flex: 1, minWidth: 100, background: "white", color: "#D97706", border: "1px solid #FCD34D", borderRadius: 10, padding: "10px 0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading ? 0.5 : 1 }}>
                    {actionLoading === "pause" ? <Loader2 size={14} className="animate-spin" /> : <><PauseCircle size={14} /> Pausar</>}
                  </button>
                )}
                {sub?.status === "paused" && (
                  <button onClick={() => setConfirmAction("resume")} disabled={!!actionLoading}
                    style={{ flex: 1, minWidth: 100, background: COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading ? 0.5 : 1 }}>
                    {actionLoading === "resume" ? <Loader2 size={14} className="animate-spin" /> : <><PlayCircle size={14} /> Reativar</>}
                  </button>
                )}
                {isActive && (
                  <button onClick={() => setConfirmAction("cancel")} disabled={!!actionLoading}
                    style={{ flex: 1, minWidth: 100, background: "white", color: "#DC2626", border: "1px solid #DC2626", borderRadius: 10, padding: "10px 0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: actionLoading ? 0.5 : 1 }}>
                    {actionLoading === "cancel" ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> Cancelar</>}
                  </button>
                )}
              </div>
            )}

            {apple && isPaid && (
              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 12px", fontSize: 12, color: "#6B7280" }}>
                Para gerenciar sua assinatura, acesse Ajustes → Apple ID → Assinaturas.
              </div>
            )}
          </div>
        </div>

        {/* Resumo de ganhos */}
        {earnings && (
          <div style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
            <button onClick={() => setShowEarnings(!showEarnings)}
              style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#D1FAE5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TrendingUp size={18} color="#059669" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Resumo de Ganhos</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{earnings.total_sessions} sessões · {brl(earnings.total_earned)} líquido</div>
                </div>
              </div>
              {showEarnings ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
            </button>

            {showEarnings && (
              <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid #F3F4F6" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, margin: "12px 0" }}>
                  {[
                    { label: "Total recebido", value: brl(earnings.total_earned), color: "#059669", bg: "#D1FAE5" },
                    { label: "Comissões pagas", value: brl(earnings.total_commission_paid), color: "#DC2626", bg: "#FEE2E2" },
                    { label: "Sessões", value: earnings.total_sessions, color: COLORS.secondary, bg: "#DBEAFE" },
                  ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: s.color, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {earnings.recent?.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.dark, marginBottom: 8 }}>Últimas sessões</div>
                    {earnings.recent.map((e: any, i: number) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "0.5px solid #F3F4F6" }}>
                        <div>
                          <div style={{ fontSize: 12, color: COLORS.dark }}>{fmt(e.date)}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>Comissão {e.commission_rate}% = {brl(e.commission_amount)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#059669" }}>+{brl(e.net_amount)}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF" }}>de {brl(e.session_price)}</div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Histórico de cobranças */}
        <div style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
          <button onClick={() => setShowBilling(!showBilling)}
            style={{ width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Receipt size={18} color={COLORS.primary} />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Histórico de Cobranças</div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>{billing.length ? `${billing.length} registros` : "Nenhuma cobrança"}</div>
              </div>
            </div>
            {showBilling ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
          </button>

          {showBilling && (
            <div style={{ padding: "0 16px 16px", borderTop: "0.5px solid #F3F4F6" }}>
              {billing.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#9CA3AF", fontSize: 13 }}>
                  Nenhuma cobrança registrada
                  {apple && <div style={{ fontSize: 11, marginTop: 4 }}>Para cobranças Apple, acesse Ajustes → Apple ID → Assinaturas</div>}
                </div>
              ) : billing.map((b: any) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #F3F4F6" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{b.description}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{fmt(b.date)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark }}>{brl(b.amount)}</div>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: b.status === "approved" ? "#D1FAE5" : b.status === "pending" ? "#FEF3C7" : "#FEE2E2", color: b.status === "approved" ? "#065F46" : b.status === "pending" ? "#92400E" : "#991B1B" }}>
                      {b.status === "approved" ? "Pago" : b.status === "pending" ? "Pendente" : b.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comparativo de planos */}
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
          <button onClick={() => setShowPlans(!showPlans)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", marginBottom: showPlans ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color={COLORS.primary} />
              <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Comparativo de Planos</span>
            </div>
            {showPlans ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
          </button>

          {showPlans && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(PLAN_CONFIG).filter(([id]) => id !== "basico").map(([planId, cfg]) => {
                  const isCurrent = sub?.plan === planId;
                  const Icon = cfg.icon;
                  return (
                    <div key={planId} style={{ borderRadius: 12, border: `2px solid ${isCurrent ? cfg.color : "#E5E7EB"}`, padding: "12px 14px", background: isCurrent ? cfg.color + "08" : "white" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                          <Icon size={18} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark, display: "flex", alignItems: "center", gap: 6 }}>
                            {cfg.name}
                            {isCurrent && <span style={{ fontSize: 10, background: COLORS.primary, color: "white", padding: "2px 8px", borderRadius: 20 }}>Atual</span>}
                          </div>
                          <div style={{ fontSize: 12, color: "#6B7280" }}>{cfg.price} · {cfg.commission}% comissão</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: isCurrent ? 0 : 10 }}>
                        {cfg.features.slice(0, 3).map((f, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
                            <CheckCircle size={12} color="#059669" /> {f}
                          </div>
                        ))}
                      </div>
                      {!isCurrent && !apple && (
                        <button onClick={() => router.push(`/mobile/subscription-checkout?plan=${planId}`)}
                          style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "none", background: cfg.color, color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                          Assinar {cfg.name}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Calculadora de economia */}
              {sub?.plan && (
                <div style={{ background: "#FDF2F8", borderRadius: 12, padding: 14, marginTop: 12, border: "0.5px solid #FBCFE8" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <RefreshCw size={14} color={COLORS.primary} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>Quanto você economiza com o Premium?</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>
                    Em 20 sessões de R$200: comissão atual ({planCfg.commission}%) = {brl(20 * 200 * planCfg.commission / 100)},
                    com Premium (3%) = {brl(20 * 200 * 3 / 100)}.
                    Economia de <strong style={{ color: "#059669" }}>{brl(20 * 200 * (planCfg.commission - 3) / 100)}</strong>/mês.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal confirmar ação */}
      {confirmAction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: COLORS.dark }}>
              {confirmAction === "pause" ? "Pausar assinatura?" : confirmAction === "resume" ? "Reativar assinatura?" : "Cancelar assinatura?"}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              {confirmAction === "pause" ? "Você voltará ao plano gratuito (20% comissão) e poderá reativar quando quiser." :
               confirmAction === "resume" ? "Sua assinatura será reativada imediatamente." :
               "Você voltará ao plano gratuito ao final do período atual. Esta ação não pode ser desfeita."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => executeAction(confirmAction)}
                style={{ flex: 1, background: confirmAction === "cancel" ? "#DC2626" : confirmAction === "pause" ? "#D97706" : COLORS.secondary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer" }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
