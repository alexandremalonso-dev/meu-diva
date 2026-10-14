"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Shield, Star, Crown, Check, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.meudivaonline.com";
const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

const BASE = {
  essencial:    { name: "Essencial",     tagline: "Para começar na plataforma",        icon: "shield", accent: "#6b7280", commission: "20%", price: 19.9,  features: ["Até 10 pacientes ativos","Agendamento básico","Prontuário digital","Visibilidade no marketplace","Relatórios financeiros"], trial: true },
  profissional: { name: "Profissional",  tagline: "Para crescer com consistência",     icon: "star",   accent: "#2F80D3", commission: "10%", price: 79,    features: ["Até 50 pacientes ativos","Relatórios financeiros","Estatísticas avançadas","Suporte por chat","Mais destaque no marketplace"], trial: false },
  premium:      { name: "Premium",       tagline: "Para escalar sua prática clínica",  icon: "crown",  accent: "#E03673", commission: "3%",  price: 149,   features: ["Pacientes ilimitados","Relatórios completos","Estatísticas avançadas","Suporte prioritário","Destaque máximo no marketplace"], trial: false },
};

const ORDER = ["essencial", "profissional", "premium"] as const;

const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PlanIcon({ kind }: { kind: string }) {
  if (kind === "crown") return <Crown size={20} />;
  if (kind === "star") return <Star size={20} />;
  return <Shield size={20} />;
}

export default function MobileAdesaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enforce, setEnforce] = useState(false);
  const [apiPrices, setApiPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const preview = new URLSearchParams(window.location.search).get("preview") === "1";
    (async () => {
      try {
        const st: any = await api("/api/therapist/onboarding/status");
        if (!active) return;
        if (!st?.needs_plan && !preview) {
          router.replace("/mobile/dashboard");
          return;
        }
        setEnforce(!!st?.enforce);
      } catch {
        if (!active) return;
        setError("Não foi possível carregar. Entre na sua conta e tente de novo.");
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`${BACKEND_URL}/api/plans/`);
        if (r.ok) {
          const d = await r.json();
          const map: Record<string, number> = {};
          (d.plans || []).forEach((p: any) => { map[p.id] = Number(p.price_brl); });
          if (active) setApiPrices(map);
        }
      } catch {}
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [router]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={32} className="animate-spin" color={COLORS.primary} />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, textAlign: "center", maxWidth: 360, width: "100%" }}>
        <AlertCircle size={32} color="#DC2626" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 14, color: "#374151", marginBottom: 16 }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>
          Tentar de novo
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #111318 0%, #181b22 50%, #14161c 100%)", padding: "24px 16px 100px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
        <Image src="/logo.png" alt="Meu Divã" width={48} height={48} style={{ objectFit: "contain" }} priority />
        <span style={{ color: "white", fontWeight: 600, fontSize: 18 }}>Meu Divã</span>
      </div>

      {/* Título */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 8 }}>Escolha seu plano</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
          Sua conta foi criada. Escolha o plano para começar a atender. Você pode trocar depois.
        </div>
      </div>

      {/* Cards de planos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
        {ORDER.map(id => {
          const b = BASE[id];
          const price = apiPrices[id] || b.price;
          return (
            <div key={id} style={{ background: "white", borderRadius: 16, padding: 20, border: id === "profissional" ? `2px solid ${COLORS.secondary}` : "none", position: "relative" }}>
              {id === "profissional" && (
                <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: COLORS.secondary, color: "white", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20 }}>
                  MAIS POPULAR
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: b.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                  <PlanIcon kind={b.icon} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.dark }}>{b.name}</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>{b.tagline}</div>
                </div>
                <div style={{ marginLeft: "auto", textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark }}>R$ {brl(price)}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF" }}>/mês</div>
                </div>
              </div>

              <div style={{ background: "#F9FAFB", borderRadius: 10, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#374151" }}>
                Comissão por sessão: <strong style={{ color: b.accent }}>{b.commission}</strong>
              </div>

              {b.trial && (
                <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "8px 12px", fontSize: 12, color: "#065F46", marginBottom: 12 }}>
                  7 dias para experimentar — a primeira mensalidade só é cobrada no 8º dia.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                {b.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#374151" }}>
                    <Check size={14} color={b.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>

              <button onClick={() => router.push(`/mobile/subscription-checkout?plan=${id}`)}
                style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: b.accent, color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                Escolher {b.name}
              </button>
            </div>
          );
        })}
      </div>

      {/* Fazer depois / help */}
      <div style={{ textAlign: "center" }}>
        {!enforce && (
          <button onClick={() => router.push("/mobile/dashboard")}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "rgba(255,255,255,0.9)", borderRadius: 12, padding: "10px 24px", fontSize: 14, cursor: "pointer", marginBottom: 10 }}>
            Fazer depois
          </button>
        )}
        {enforce && (
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
            Para acessar a plataforma, escolha um plano.
          </div>
        )}
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
          Dúvidas?{" "}
          <a href="mailto:contato@meudivaonline.com" style={{ color: "#ff8bb3" }}>Fale com a gente</a>
        </div>
      </div>
    </div>
  );
}
