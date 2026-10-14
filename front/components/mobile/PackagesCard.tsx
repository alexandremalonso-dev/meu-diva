"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, CalendarCheck, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

function isIOSNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return isNativeApp() && cap?.getPlatform?.() === "ios";
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

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
      } catch {
        // sem acesso: card não aparece
      }
    })();
    return () => { active = false; };
  }, []);

  if (!visible) return null;

  const live = !!me?.subscription && ["authorized", "pending", "paused"].includes(me.subscription.status);
  const hasCredits = (me?.sessions_remaining || 0) > 0;
  const ios = isIOSNative();

  // Tem pacote ativo ou créditos — mostra resumo
  if (live || hasCredits) {
    return (
      <div style={{ background: "white", borderRadius: 14, padding: 14, marginBottom: 10, border: `1px solid ${COLORS.primary}30` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          <button
            onClick={() => router.push("/mobile/busca")}
            style={{ flex: 1, background: COLORS.primary, color: "white", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CalendarCheck size={14} /> Agendar
          </button>
          <button
            onClick={() => router.push("/mobile/meus-pacotes")}
            style={{ flex: 1, background: "white", color: COLORS.dark, border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 0", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            Gerenciar <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // Sem pacote — iOS não mostra preços nem botão de compra
  if (plans.length === 0) return null;

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 14, marginBottom: 10, border: "0.5px solid #E5E7EB" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Package size={18} color={COLORS.primary} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.dark }}>Pacotes de sessões</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Organize seu cuidado com constância</div>
          </div>
        </div>
        {!ios && (
          <button
            onClick={() => router.push("/mobile/meus-pacotes")}
            style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 12, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 2 }}>
            Ver todos <ChevronRight size={14} />
          </button>
        )}
      </div>

      {ios ? (
        // iOS: sem preços, sem botão de compra — redireciona para o site
        <div style={{ background: "#FDF2F8", borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: COLORS.dark, marginBottom: 4 }}>Contrate um pacote em</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.primary }}>meudivaonline.com/pacotes</div>
        </div>
      ) : (
        // Android: mostra planos com preços
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plans.slice(0, 2).map((p) => (
            <button
              key={p.chave}
              onClick={() => router.push(`/mobile/meus-pacotes`)}
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.dark }}>{p.nome}</div>
                <div style={{ fontSize: 11, color: "#6B7280" }}>{p.sessoes_mensais} {p.sessoes_mensais === 1 ? "sessão" : "sessões"}/mês</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.primary }}>{brl(p.preco_mensal)}<span style={{ fontSize: 10, fontWeight: 400, color: "#9CA3AF" }}>/mês</span></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
