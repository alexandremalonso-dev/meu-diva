"use client";

import { useState } from "react";
import { Check, Loader2, Package } from "lucide-react";
import { api } from "@/lib/api";

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" };

interface PackageInfo {
  chave: string;
  productId: string;
  nome: string;
  preco: string;
  sessoes: number;
}

const PACKAGES: PackageInfo[] = [
  { chave: "no_diva_01", productId: "6820287370", nome: "No Divã 01", preco: "R$ 75/mês",  sessoes: 1 },
  { chave: "no_diva_02", productId: "6820287570", nome: "No Divã 02", preco: "R$ 150/mês", sessoes: 2 },
  { chave: "no_diva_04", productId: "6820288293", nome: "No Divã 04", preco: "R$ 300/mês", sessoes: 4 },
  { chave: "no_diva_08", productId: "6820289143", nome: "No Divã 08", preco: "R$ 600/mês", sessoes: 8 },
];

export function ApplePackageCards() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePurchase = async (pkg: PackageInfo) => {
    setLoading(pkg.productId);
    setError(null);
    try {
      const { NativePurchases, PURCHASE_TYPE } = await import("@capgo/native-purchases");
      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: pkg.productId,
        quantity: 1,
        productType: PURCHASE_TYPE.INAPP,
      });
      if (transaction?.productIdentifier) {
        await api("/api/payments/apple/validate-package", {
          method: "POST",
          body: JSON.stringify({
            product_id: transaction.productIdentifier,
            transaction_id: transaction.transactionIdentifier,
            plan_key: pkg.chave,
          }),
        });
        setSuccess(`${pkg.nome} contratado! Suas sessões já estão disponíveis.`);
      }
    } catch (e: any) {
      if (!e.message?.toLowerCase().includes("cancel")) {
        setError(e.message || "Erro ao processar compra.");
      }
    } finally {
      setLoading(null);
    }
  };

  if (success) {
    return (
      <div style={{ background: "#D1FAE5", borderRadius: 14, padding: 20, textAlign: "center", border: "1px solid #A7F3D0" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#065F46", marginBottom: 4 }}>✅ {success}</div>
        <div style={{ fontSize: 12, color: "#059669" }}>Acesse "Meus Pacotes" para agendar.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PACKAGES.map(pkg => {
          const isLoading = loading === pkg.productId;
          return (
            <div key={pkg.chave} style={{ background: "white", borderRadius: 14, padding: 14, border: `1px solid ${COLORS.primary}30`, display: "flex", flexDirection: "column" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.primary + "15", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <Package size={18} color={COLORS.primary} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.dark, marginBottom: 2 }}>{pkg.nome}</div>
              <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 8 }}>
                <strong style={{ color: COLORS.dark }}>{pkg.sessoes}</strong> {pkg.sessoes === 1 ? "sessão" : "sessões"}/mês
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.primary, marginBottom: 12 }}>{pkg.preco}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12, flex: 1 }}>
                {["Videochamada", "Renovação mensal", "Cancele quando quiser"].map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#374151" }}>
                    <Check size={11} color={COLORS.primary} style={{ flexShrink: 0 }} /> {f}
                  </div>
                ))}
              </div>
              <button
                onClick={() => handlePurchase(pkg)}
                disabled={!!loading}
                style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: loading ? "#D1D5DB" : COLORS.primary, color: "white", fontSize: 13, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : "Contratar"}
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={async () => {
          try {
            const { NativePurchases } = await import("@capgo/native-purchases");
            await NativePurchases.restoreTransactions();
            alert("Compras restauradas com sucesso!");
          } catch (e: any) {
            if (!e.message?.toLowerCase().includes("cancel")) {
              alert("Não foi possível restaurar as compras. Tente novamente.");
            }
          }
        }}
        style={{ width:"100%", background:"transparent", border:"1px solid #E5E7EB", borderRadius:10, padding:"10px 0", fontSize:13, color:"#6B7280", cursor:"pointer", marginBottom:8 }}>
        Restaurar compras
      </button>

      <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", lineHeight: 1.5 }}>
        Pagamento processado pela App Store. As sessões valem dentro do mês vigente.{" "}
        <a href="https://meudivaonline.com/termos-uso" style={{ color: "#2F80D3" }}>Termos de Uso</a>
        {" "}e{" "}
        <a href="https://meudivaonline.com/politica-privacidade" style={{ color: "#2F80D3" }}>Política de Privacidade</a>.
      </div>
    </div>
  );
}
