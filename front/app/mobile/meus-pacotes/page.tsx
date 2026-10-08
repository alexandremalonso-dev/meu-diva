"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Package, Loader2, AlertCircle, CheckCircle,
  Calendar, CalendarCheck, XCircle, Info, Ticket
} from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const STATUS: Record<string, { label: string; color: string }> = {
  authorized: { label: "Ativo",      color: "#059669" },
  pending:    { label: "Em análise", color: "#D97706" },
  paused:     { label: "Pausado",    color: "#D97706" },
  cancelled:  { label: "Cancelado",  color: "#DC2626" },
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function MeusPacotesPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data: any = await api("/api/patient/pacotes/me");
      setMe(data);
    } catch {
      setError("Não foi possível carregar seus pacotes.");
    } finally {
      setLoading(false);
    }
  }

  async function doCancel() {
    setConfirmCancel(false);
    setCancelling(true);
    setError("");
    try {
      const r: any = await api("/api/patient/pacotes/cancel", { method: "POST" });
      setSuccess(r?.message || "Pacote cancelado. As sessões já pagas continuam valendo até o fim do período.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Não foi possível cancelar agora.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f0f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} className="animate-spin" color={COLORS.primary} />
      </div>
    );
  }

  const sub = me?.subscription || null;
  const st = sub ? STATUS[sub.status] || { label: sub.status, color: "#6B7280" } : null;
  const lots = me?.lots || [];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f0f5", paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ background: COLORS.primary, padding: "16px 16px 20px" }}>
        <button onClick={() => router.back()} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, padding: "6px 10px", color: "white", display: "flex", alignItems: "center", gap: 6, marginBottom: 12, cursor: "pointer" }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color: "white", fontSize: 20, fontWeight: 600 }}>Meus Pacotes</div>
        <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>Acompanhe suas sessões e assinatura</div>
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

        {/* Sem pacote */}
        {!sub && lots.length === 0 && (
          <div style={{ background: "white", borderRadius: 14, padding: 24, textAlign: "center", border: "0.5px solid #E5E7EB" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Package size={24} color={COLORS.primary} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 6 }}>Você ainda não tem um pacote</div>
            <div style={{ fontSize: 13, color: "#6B7280" }}>
              Acesse meudivaonline.com para conhecer os combos disponíveis.
            </div>
          </div>
        )}

        {/* Card da assinatura */}
        {sub && st && (
          <div style={{ background: "white", borderRadius: 14, overflow: "hidden", border: "0.5px solid #E5E7EB" }}>
            {/* Banner */}
            <div style={{ background: "linear-gradient(135deg, #E03673, #c02c5e)", padding: 16, color: "white" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Package size={22} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Pacote atual</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{sub.plano_nome}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, background: "rgba(255,255,255,0.2)", borderRadius: 20, padding: "3px 10px", marginBottom: 4 }}>{st.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.85 }}>{brl(sub.preco_mensal)}/mês</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#F3F4F6" }}>
              {[
                { icon: Ticket, label: "Sessões restantes", value: me?.sessions_remaining || 0 },
                { icon: Calendar, label: "Por mês", value: sub.sessoes_mensais },
                { icon: Calendar, label: sub.can_cancel ? "Próx. cobrança" : "Encerrado", value: sub.can_cancel ? fmt(sub.current_period_end) : "—" },
              ].map((item, i) => (
                <div key={i} style={{ background: "white", padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                    <item.icon size={10} /> {item.label}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.dark }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => router.push("/mobile/busca")}
                style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <CalendarCheck size={16} /> Agendar sessão
              </button>
              {sub.can_cancel && (
                <button
                  onClick={() => setConfirmCancel(true)}
                  disabled={cancelling}
                  style={{ background: "white", color: "#DC2626", border: "1px solid #DC2626", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: cancelling ? 0.5 : 1 }}>
                  {cancelling ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={16} /> Cancelar pacote</>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Lotes de sessões */}
        {lots.length > 0 && (
          <div style={{ background: "white", borderRadius: 14, padding: 16, border: "0.5px solid #E5E7EB" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark, marginBottom: 10 }}>Suas sessões</div>
            {lots.map((l: any) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.dark }}>{l.plano_nome}</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>Válidas até {fmt(l.valid_until)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>{l.remaining} de {l.sessions_total}</div>
                  <div style={{ fontSize: 11, color: "#6B7280" }}>{l.used} {l.used === 1 ? "usada" : "usadas"}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Aviso */}
        <div style={{ background: "#EFF6FF", border: "0.5px solid #BFDBFE", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, fontSize: 12, color: "#1E40AF" }}>
          <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div>As sessões contratadas valem dentro do mês vigente. As que não forem usadas expiram ao fim desse período.</div>
            <div style={{ marginTop: 4 }}>Os pacotes valem com os terapeutas que participam deste formato.</div>
          </div>
        </div>

      </div>

      {/* Modal cancelar */}
      {confirmCancel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
          <div style={{ background: "white", borderRadius: "16px 16px 0 0", padding: 24, width: "100%", maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: COLORS.dark }}>Cancelar pacote?</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
              Não haverá novas cobranças.{me?.next_expiry ? ` As sessões já pagas continuam valendo até ${fmt(me.next_expiry)}.` : ""}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancel(false)} style={{ flex: 1, background: "#F3F4F6", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, cursor: "pointer" }}>
                Voltar
              </button>
              <button onClick={doCancel} disabled={cancelling}
                style={{ flex: 1, background: "#DC2626", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : "Cancelar pacote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
