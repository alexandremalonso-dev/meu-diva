"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, CalendarCheck, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.() && cap?.getPlatform?.() === "ios";
}

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

export function PackagesCard() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg: any = await api("/api/patient/pacotes/config", { silent: true });
        if (!active || !cfg?.visible) return;
        const [p, m]: any[] = await Promise.all([
          api("/api/patient/pacotes/plans", { silent: true }),
          api("/api/patient/pacotes/me", { silent: true }),
        ]);
        if (!active) return;
        setPlans(Array.isArray(p?.plans) ? p.plans : []);
        setMe(m || null);
        setVisible(true);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  if (!visible) return null;

  const live = !!me?.subscription && ["authorized", "pending", "paused"].includes(me.subscription.status);
  const hasCredits = (me?.sessions_remaining || 0) > 0;
  const ios = isIOS();

  // Tem pacote ativo — mostra resumo
  if (live || hasCredits) {
    return (
      <div style={{ background: "white", borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.primary}30` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Package size={20} color={COLORS.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              Seu pacote{me?.subscription ? ` · ${me.subscription.plano_nome}` : ""}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.dark }}>
              {me?.sessions_remaining || 0} {(me?.sessions_remaining || 0) === 1 ? "sessão restante" : "sessões restantes"}
            </div>
            {me?.next_expiry && (
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>Válidas até {fmt(me.next_expiry)}</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push("/mobile/busca")}
            style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CalendarCheck size={14} /> Agendar
          </button>
          <button onClick={() => router.push("/mobile/meus-pacotes")}
            style={{ flex: 1, background: "white", color: COLORS.dark, border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Gerenciar <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #E5E7EB" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={18} color={COLORS.primary} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Pacotes de sessões</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Organize seu cuidado com constância</div>
          </div>
        </div>
        <button onClick={() => router.push("/mobile/meus-pacotes")}
          style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
          Ver todos <ChevronRight size={14} />
        </button>
      </div>

      {ios ? (
        // iOS: sem preços, sem botão de compra — direciona para o site
        <div style={{ background: "#FDF2F8", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: COLORS.dark, marginBottom: 2 }}>Contrate um pacote em</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.primary }}>meudivaonline.com/pacotes</div>
        </div>
      ) : (
        // Android/Web: cards individuais com preços e link para checkout
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {plans.map((p: any) => (
            <button key={p.chave}
              onClick={() => router.push(`/mobile/pacote-checkout?plan=${p.chave}`)}
              style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 10px", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{p.nome}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                {p.sessoes_mensais} {p.sessoes_mensais === 1 ? "sessão" : "sessões"}/mês
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.primary, marginTop: 6 }}>
                {brl(p.preco_mensal)}<span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>/mês</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
