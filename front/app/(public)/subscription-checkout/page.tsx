'use client'
// asaas-checkout-page v1: o cartão é digitado na página do Asaas (hospedada); aqui só abrimos o pedido.

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, Crown, Star, Shield, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

// Teste grátis do Essencial: o mesmo número de dias definido no servidor (asaas_checkout_service.TRIAL_DIAS)
const TRIAL_DIAS: Record<string, number> = { essencial: 7 }

const PLANS = {
  essencial: {
    name: 'Essencial',
    price: 19.9,
    commission: '20%',
    color: '#6b7280',
    icon: <Shield size={28} />,
    features: ['Perfil na plataforma', 'Agenda e gestão de sessões', 'Videochamada integrada', 'Pagamento automático', 'Relatório financeiro'],
  },
  profissional: {
    name: 'Profissional',
    price: 79,
    commission: '10%',
    color: '#2F80D3',
    icon: <Star size={28} />,
    features: ['Comissão reduzida (10%)', 'Melhor posicionamento na busca', 'Acesso a mais pacientes', 'Relatórios básicos'],
  },
  premium: {
    name: 'Premium',
    price: 149,
    commission: '3%',
    color: '#E03673',
    icon: <Crown size={28} />,
    features: ['Comissão mínima (3%)', 'Destaque máximo na plataforma', 'Leads prioritários', 'Analytics avançado'],
  },
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function SubscriptionCheckoutContent() {
  const searchParams = useSearchParams()
  const planId = (searchParams.get('plan') || 'profissional') as 'essencial' | 'profissional' | 'premium'
  const plan = PLANS[planId] || PLANS.profissional
  const planKey = (PLANS[planId] ? planId : 'profissional') as string
  const trial = TRIAL_DIAS[planKey] || 0
  const primeiraCobranca = new Date(Date.now() + trial * 86400000).toLocaleDateString('pt-BR')

  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abrirPagamento = async () => {
    if (opening) return
    setOpening(true)
    setError(null)
    try {
      const r: any = await api('/api/asaas/checkout', {
        method: 'POST',
        body: JSON.stringify({ tipo: 'terapeuta', plano: planKey }),
      })
      if (!r?.url) throw new Error('Não foi possível abrir o pagamento agora. Tente novamente em instantes.')
      window.location.href = r.url
    } catch (e: any) {
      setError(e?.message || 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.')
      setOpening(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', paddingBottom: '60px' }}>
      <PublicHeader />

      <div style={{ maxWidth: '900px', margin: '36px auto 0', padding: '0 20px', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '28px', alignItems: 'start' }}>

        {/* Resumo do plano */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #f0e8ec', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: `${plan.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: plan.color }}>
                {plan.icon}
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Plano selecionado</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{plan.name}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Cobrança mensal</span>
                <span style={{ fontSize: '22px', fontWeight: 700, color: plan.color }}>{formatCurrency(plan.price)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Comissão por sessão</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{plan.commission}</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {plan.features.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                  <CheckCircle2 size={14} color="#16a34a" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '12px 16px' }}>
            <Shield size={18} color="#2F80D3" style={{ flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '13px', color: '#1d4ed8', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
              Cancele quando quiser, sem perder acesso à plataforma.
            </p>
          </div>
        </aside>

        {/* Pagamento */}
        <section style={{ background: '#fff', borderRadius: '20px', border: '1.5px solid #f0e8ec', padding: '32px 28px', boxShadow: '0 4px 24px rgba(224,54,115,0.06)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>Assinar plano {plan.name}</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>Pagamento processado pelo Asaas (certificação PCI-DSS) • Recorrência mensal</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trial > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '14px', color: '#166534', margin: 0, fontWeight: 600 }}>{trial} dias grátis</p>
                <p style={{ fontSize: '13px', color: '#166534', margin: '4px 0 0', lineHeight: 1.5 }}>
                  O cartão é validado agora, mas a primeira cobrança de {formatCurrency(plan.price)} só acontece em {primeiraCobranca}. Cancele antes disso e não paga nada.
                </p>
              </div>
            )}

            <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px 18px' }}>
              <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 8px', fontWeight: 600 }}>Como funciona</p>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4b5563', lineHeight: 1.7 }}>
                <li>Você vai para uma página segura do Asaas para informar os dados do cartão de crédito.</li>
                <li>Depois do pagamento, você volta ao Meu Divã automaticamente.</li>
                <li>Seu plano é ativado em instantes e você segue para enviar os documentos do perfil.</li>
              </ol>
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              onClick={abrirPagamento}
              disabled={opening}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${plan.color} 0%, ${plan.color}cc 100%)`,
                color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
                cursor: opening ? 'not-allowed' : 'pointer', opacity: opening ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              }}
            >
              {opening
                ? <><Loader2 size={18} className="animate-spin" /> Abrindo o pagamento…</>
                : <><Lock size={16} /> {trial > 0 ? `Começar ${trial} dias grátis` : `Continuar para o pagamento • ${formatCurrency(plan.price)}/mês`}</>}
            </button>

            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', margin: 0 }}>
              Cartão de crédito • Cobrança mensal recorrente • Cancele quando quiser
            </p>
          </div>
        </section>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');`}</style>
      <PublicFooter />
    </main>
  )
}

export default function SubscriptionCheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#f9f7f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: '#E03673', animation: 'spin 1s linear infinite' }} />
      </main>
    }>
      <SubscriptionCheckoutContent />
    </Suspense>
  )
}
