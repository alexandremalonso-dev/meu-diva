"use client";

import { useEffect, useState, useCallback, Suspense } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { WalletWithTransactions } from '@/types/wallet';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { TransactionList } from '@/components/wallet/TransactionList';
import { useSearchParams } from 'next/navigation';
import { Wallet, CreditCard, ArrowRight, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

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

// 🔥 COMPONENTE PRINCIPAL ENVOLTO EM SUSPENSE
export default function PatientWalletPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    }>
      <PatientWalletContent />
    </Suspense>
  );
}

// 🔥 CONTEÚDO REAL DA PÁGINA
function PatientWalletContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [wallet, setWallet] = useState<WalletWithTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // Estados para recarga
  const [topupAmount, setTopupAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [processingTopup, setProcessingTopup] = useState(false);
  const [topupError, setTopupError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api('/api/wallet/full?limit=20');
      setWallet(data);
      setError(null);
    } catch (err: any) {
      console.error('Erro ao carregar carteira:', err);
      setError('Erro ao carregar carteira');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTopup = async (amount: number) => {
    if (amount < 10) {
      setTopupError('Valor mínimo é R$ 10');
      return;
    }

    setProcessingTopup(true);
    setTopupError(null);

    try {
      const response = await api('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({
          amount,
          payment_method: 'stripe'
        }),
      });

      console.log('💳 Payment criado:', response);

      localStorage.setItem('last_payment_id', response.payment_id);
      window.location.href = response.checkout_url;

    } catch (err: any) {
      setTopupError(err.message || 'Erro ao iniciar pagamento');
      setProcessingTopup(false);
    }
  };

  const handlePredefinedAmount = (value: number) => {
    setTopupAmount(value);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    const num = parseFloat(value.replace(',', '.'));
    if (!isNaN(num) && num > 0) setTopupAmount(num);
  };

  const handleTopupExpanded = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleTopup(topupAmount);
  };

  useEffect(() => {
    const success = searchParams?.get('success');
    const appointmentId = searchParams?.get('appointment_id');
    const paymentId = searchParams?.get('payment_id');

    if (success === 'true') {
      console.log('✅ Retorno do pagamento detectado');

      if (appointmentId) {
        console.log(`📅 Appointment ${appointmentId} pago com sucesso`);
        
        window.dispatchEvent(new CustomEvent('appointmentConfirmed', { 
          detail: { appointmentId } 
        }));
        
        localStorage.removeItem('pending_appointment_id');
      }

      const lastPaymentId = localStorage.getItem('last_payment_id');
      if (lastPaymentId) {
        confirmPayment(lastPaymentId);
      } else if (paymentId) {
        confirmPayment(paymentId);
      }
    }
  }, [searchParams]);

  const confirmPayment = async (paymentId: string) => {
    try {
      console.log('💰 Confirmando pagamento:', paymentId);

      const response = await fetch(`/api/wallet/confirm/${paymentId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log('📥 Status da resposta:', response.status);

      if (response.status === 404) {
        console.log('ℹ️ Pagamento já processado (webhook), atualizando wallet...');
        localStorage.removeItem('last_payment_id');
        setPaymentSuccess(true);
        loadWallet();
        setExpanded(false);
        setTimeout(() => setPaymentSuccess(false), 5000);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || errorData.error || `Erro ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Pagamento confirmado:', data);

      localStorage.removeItem('last_payment_id');
      setPaymentSuccess(true);
      loadWallet();
      setExpanded(false);
      setTimeout(() => setPaymentSuccess(false), 5000);

    } catch (err: any) {
      console.error('❌ Erro ao confirmar pagamento:', err);
      localStorage.removeItem('last_payment_id');
      loadWallet();
    }
  };

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loading && !wallet) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* MENSAGEM DE BOAS-VINDAS */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[#E03673]" />
          <h1 className="text-2xl font-bold text-gray-900">Minha Carteira</h1>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Gerencie seus créditos e histórico de transações
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {paymentSuccess && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            ✅ Pagamento confirmado! Seus créditos foram adicionados.
          </div>
        )}

        {/* CARD DE SALDO - COM CALLBACK PARA EXPANDIR */}
        <BalanceCard
          initialBalance={wallet ? {
            balance: wallet.balance,
            currency: wallet.currency,
            formatted: formatCurrency(wallet.balance)
          } : undefined}
          onRefresh={loadWallet}
          userRole="patient"
          onExpand={() => setExpanded(!expanded)}
          isExpanded={expanded}
        />

        {/* SEÇÃO EXPANSÍVEL DE RECARGA */}
        {expanded && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mt-4 overflow-hidden animate-slideDown">
            <style>{`
              @keyframes slideDown {
                from {
                  opacity: 0;
                  transform: translateY(-10px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              .animate-slideDown {
                animation: slideDown 0.3s ease;
              }
            `}</style>
            
            <div className="bg-[#F9F5FF] px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#2F80D3]" />
                <h2 className="text-base font-semibold text-[#2F80D3]">Adicionar créditos</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Escolha um valor para recarregar sua carteira</p>
            </div>

            <div className="p-5">
              {topupError && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {topupError}
                </div>
              )}

              <form onSubmit={handleTopupExpanded}>
                <div className="mb-5">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {predefinedAmounts.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handlePredefinedAmount(value)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          topupAmount === value
                            ? 'bg-[#E03673] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        R$ {value}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => handleCustomAmount(e.target.value)}
                      placeholder="0,00"
                      min="10"
                      step="10"
                      className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E03673] focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Valor da recarga:</span>
                    <span className="text-xl font-bold text-[#3A3B21]">
                      R$ {topupAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processingTopup}
                  className="w-full py-3 bg-[#E03673] text-white rounded-lg font-medium hover:bg-[#c02c5e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingTopup ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Continuar para pagamento
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-[10px] text-gray-400 text-center">
                  🔒 Pagamento seguro processado via Stripe
                </p>
                <p className="text-[10px] text-gray-400 text-center mt-1">
                  Os créditos são adicionados instantaneamente após a confirmação
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TRANSAÇÕES */}
        <div className="bg-white mt-6 rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-[#E03673]" />
            <h2 className="text-lg font-semibold">Extrato</h2>
          </div>

          {wallet?.recent_transactions?.length ? (
            <TransactionList
              transactions={wallet.recent_transactions}
              filter={filter}
              userRole="patient"
              onFilterChange={setFilter}
            />
          ) : (
            <p className="text-gray-500 text-center py-8">Nenhuma transação encontrada</p>
          )}
        </div>
      </div>
    </>
  );
}