"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Check, AlertCircle, Package } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };
const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Plan { chave: string; nome: string; preco_mensal: number; sessoes_mensais: number; }

export default function MobilePacotesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hasPackage, setHasPackage] = useState(false);
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get("novo") === "1");
    let active = true;
    (async () => {
      try {
        const [p, m]: any[] = await Promise.all([
          api("/api/patient/pacotes/plans", { silent: true } as any),
          api("/api/patient/pacotes/me", { silent: true } as any),
        ]);
        if (!active) return;
        setVisible(!!p?.visible);
        setPlans(Array.isArray(p?.plans) ? p.plans : []);
        setHasPackage(!!m?.subscription?.can_cancel);
      } catch {
        if (!active) return;
        setError("Não foi possível carregar os pacotes.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

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
        <button onClick={() => router.push("/mobile/login")} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>
          Entrar
        </button>
      </div>
    </div>
  );

  if (!visible) return (
    <div style={{ minHeight: "100vh", background: "#111318", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "white", borderRadius: 16, padding: 24, textAlign: "center", maxWidth: 360, width: "100%" }}>
        <Package size={32} color={COLORS.primary} style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.dark, marginBottom: 8 }}>Pacotes chegam em breve!</div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>Por enquanto, agende sessões avulsas direto com os terapeutas.</div>
        <button onClick={() => router.push("/mobile/busca")} style={{ background: COLORS.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>
          Buscar terapeutas
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #111318 0%, #181b22 50%, #14161c 100%)", padding: "24px 16px 100px" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
        <Image src="/logo.png" alt="Meu Divã" width={40} height={40} style={{ objectFit: "contain" }} priority />
        <span style={{ color: "white", fontWeight: 600, fontSize: 18 }}>Meu Divã</span>
      </div>

      {/* Boas-vindas */}
      {welcome && (
        <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16, padding: 20, marginBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 8 }}>Bem-vindo(a) ao Meu Divã!</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, marginBottom: 14 }}>
            Seu e-mail foi confirmado. Quer começar com um pacote de sessões? É opcional — a terapia funciona melhor com regularidade, e o pacote ajuda a manter o ritmo.
          </div>
          <button onClick={() => router.push("/mobile/dashboard")}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.4)", color: "white", borderRadius: 10, padding: "10px 20px", fontSize: 13, cursor: "pointer" }}>
            Fazer depois e ir para o meu painel
          </button>
        </div>
      )}

      {/* Título */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "white", marginBottom: 6 }}>Pacotes No Divã</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
          Escolha quantas sessões por mês. Renova todo mês e você cancela quando quiser.
        </div>
      </div>

      {/* Aviso pacote ativo */}
      {hasPackage && (
        <div style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "rgba(255,255,255,0.85)", textAlign: "center" }}>
          Você já tem um pacote ativo.{" "}
          <button onClick={() => router.push("/mobile/meus-pacotes")} style={{ background: "none", border: "none", color: "#ff8bb3", cursor: "pointer", fontWeight: 500, textDecoration: "underline" }}>
            Gerenciar pacote
          </button>
        </div>
      )}

      {/* Cards de combos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {plans.map(p => (
          <div key={p.chave} style={{ background: "white", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Package size={18} color="white" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.dark, marginBottom: 4 }}>{p.nome}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.dark }}>
              R$ {brl(p.preco_mensal)}
              <span style={{ fontSize: 11, fontWeight: 400, color: "#9CA3AF" }}>/mês</span>
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12 }}>
              <strong style={{ color: COLORS.dark }}>{p.sessoes_mensais}</strong> {p.sessoes_mensais === 1 ? "sessão" : "sessões"}/mês
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, flex: 1 }}>
              {["Videochamada", "Renovação mensal", "Cancele quando quiser"].map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151" }}>
                  <Check size={12} color={COLORS.primary} style={{ flexShrink: 0 }} /> {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push(`/mobile/pacote-checkout?plan=${p.chave}`)}
              disabled={hasPackage}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: hasPackage ? "#D1D5DB" : COLORS.primary, color: "white", fontSize: 13, fontWeight: 600, cursor: hasPackage ? "not-allowed" : "pointer" }}>
              Escolher
            </button>
          </div>
        ))}
      </div>

      {/* Fazer depois (welcome) */}
      {welcome && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <button onClick={() => router.push("/mobile/dashboard")}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.4)", color: "white", borderRadius: 10, padding: "10px 24px", fontSize: 13, cursor: "pointer" }}>
            Fazer depois e ir para o meu painel
          </button>
        </div>
      )}

      {/* Notas */}
      <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
        <div>As sessões valem dentro do mês vigente.</div>
        <div>Ao cancelar, as sessões já pagas continuam valendo.</div>
        <div style={{ marginTop: 6 }}>
          Dúvidas?{" "}
          <a href="mailto:contato@meudivaonline.com?subject=Dúvida sobre pacotes" style={{ color: "#ff8bb3" }}>Fale com a gente</a>
        </div>
      </div>
    </div>
  );
}
