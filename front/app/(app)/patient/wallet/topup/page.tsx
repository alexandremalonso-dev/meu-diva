"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 🎨 PALETA DE CORES
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  ciano: "#49CCD4",
  laranja: "#FB8811",
  verdeEscuro: "#3A3B21",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
};

const predefinedAmounts = [50, 100, 200, 500, 1000];

export default function TopUpPage() {
  const router = useRouter();

  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePredefinedAmount = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    const num = parseFloat(value.replace(',', '.'));
    if (!isNaN(num) && num > 0) setAmount(num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amount <= 0) {
      setError('Valor deve ser maior que zero');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('💰 Criando pagamento para recarga de R$', amount);

      const token = localStorage.getItem('access_token');
      
      const response = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          amount: amount,
          payment_method: 'stripe'
        }),
      });

      if (response.status === 401) {
        window.location.href = '/auth/login';
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Erro ao criar pagamento');
      }

      console.log('💳 Payment criado:', data);

      // Salvar payment_id para referência
      localStorage.setItem('last_payment_id', data.payment_id);

      // 🔥 REDIRECIONAR DIRETO PARA O STRIPE (SEM MOCK)
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('URL de checkout não recebida');
      }

    } catch (err: any) {
      console.error('Erro na recarga:', err);
      setError(err.message || 'Erro ao processar pagamento');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: CORES.cinza }}>
      {/* Cabeçalho */}
      <div style={{ backgroundColor: CORES.azul }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <h1 style={{ fontSize: "32px", fontWeight: "bold", color: CORES.branco, marginBottom: "8px" }}>
                💰 Adicionar créditos
              </h1>
              <p style={{ fontSize: "16px", color: CORES.branco, opacity: 0.9 }}>
                Escolha um valor para recarregar sua carteira
              </p>
            </div>
            <Link href="/patient/wallet" style={{ textDecoration: "none" }}>
              <button
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  backgroundColor: CORES.branco,
                  color: CORES.azul,
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                ← Voltar para carteira
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ maxWidth: "600px", margin: "0 auto", padding: "48px 16px" }}>
        <div style={{ backgroundColor: CORES.branco, borderRadius: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          <div style={{ padding: "24px" }}>
            {error && (
              <div style={{ marginBottom: "24px", padding: "12px", backgroundColor: "#FEE2E2", borderRadius: "8px", color: "#DC2626", fontSize: "14px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ fontSize: "14px", fontWeight: "500", color: CORES.rosa, marginBottom: "12px", display: "block" }}>
                  Valores sugeridos
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
                  {predefinedAmounts.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handlePredefinedAmount(value)}
                      style={{
                        padding: "10px 20px",
                        backgroundColor: amount === value ? CORES.rosa : CORES.cinza,
                        color: amount === value ? CORES.branco : CORES.cinzaTexto,
                        border: "none",
                        borderRadius: "12px",
                        cursor: "pointer",
                        fontSize: "16px",
                        fontWeight: "500",
                        transition: "all 0.2s",
                      }}
                    >
                      R$ {value}
                    </button>
                  ))}
                </div>

                <label style={{ fontSize: "14px", fontWeight: "500", color: CORES.rosa, marginBottom: "8px", display: "block" }}>
                  Ou digite um valor personalizado
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: CORES.cinzaTexto }}>
                    R$
                  </span>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => handleCustomAmount(e.target.value)}
                    placeholder="0,00"
                    min="10"
                    step="10"
                    style={{
                      width: "100%",
                      padding: "12px 12px 12px 40px",
                      border: `1px solid ${CORES.cinzaBorda}`,
                      borderRadius: "12px",
                      fontSize: "16px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "24px", padding: "16px", backgroundColor: CORES.cinzaClaro, borderRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "16px", color: CORES.cinzaTexto }}>Valor da recarga:</span>
                  <span style={{ fontSize: "24px", fontWeight: "bold", color: CORES.verdeEscuro }}>
                    R$ {amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "14px",
                  backgroundColor: loading ? CORES.cinza : CORES.rosa,
                  color: CORES.branco,
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: "500",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Processando..." : "Continuar para pagamento"}
              </button>
            </form>

            <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: `1px solid ${CORES.cinzaBorda}` }}>
              <p style={{ fontSize: "12px", color: CORES.cinzaTexto, textAlign: "center" }}>
                🔒 Pagamento seguro processado via Stripe
              </p>
              <p style={{ fontSize: "12px", color: CORES.cinzaTexto, textAlign: "center", marginTop: "8px" }}>
                Os créditos são adicionados instantaneamente após a confirmação do pagamento
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ backgroundColor: CORES.cinzaClaro, padding: "32px 16px", marginTop: "32px", textAlign: "center", borderTop: `1px solid ${CORES.cinzaBorda}` }}>
        <p style={{ fontSize: "12px", color: CORES.cinzaTexto }}>
          Meu Divã - Plataforma de saúde emocional
        </p>
      </div>
    </div>
  );
}