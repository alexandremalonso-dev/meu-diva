'use client'
// asaas-checkout-page v1: o cartão é digitado na página do Asaas (hospedada); aqui só abrimos o pedido.

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, Shield, Package, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

const COLOR = '#E03673'

interface Plan {
  chave: string
  nome: string
  preco_mensal: number
  sessoes_mensais: number
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function PacoteCheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planKey = (searchParams.get('plan') || '').toLowerCase()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const p: any = await api('/api/patient/pacotes/plans', { silent: true } as any)
        if (!active) return
        if (!p?.visible) { setPlanError('Os pacotes de sessões ainda não estão disponíveis.'); return }
        const found = (p.plans || []).find((x: Plan) => x.chave === planKey)
        if (!found) setPlanError('Pacote não encontrado ou indisponível.')
        else setPlan(found)
      } catch {
        if (active) setPlanError('Não foi possível carregar o pacote. Entre na sua conta de paciente e tente de novo.')
      } finally {
        if (active) setLoadingPlan(false)
      }
    })()
    return () => { active = false }
  }, [planKey])

  const abrirPagamento = async () => {
    if (!plan || opening) return
    setOpening(true)
    setError(null)
    try {
      const r: any = await api('/api/asaas/checkout', {
        method: 'POST',
        body: JSON.stringify({ tipo: 'paciente', plano: plan.chave }),
      })
      if (!r?.url) throw new Error('Não foi possível abrir o pagamento agora. Tente novamente em instantes.')
      window.location.href = r.url
    } catch (e: any) {
      setError(e?.message || 'Não foi possível abrir o pagamento agora. Tente novamente em instantes.')
      setOpening(false)
    }
  }

  if (loadingPlan) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 size={32} style={{ color: COLOR }} className="animate-spin" />
    </main>
  )

  if (planError || !plan) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <PublicHeader />
      <div style={{ maxWidth: '420px', margin: '60px auto', padding: '24px', background: '#fff', borderRadius: '16px', textAlign: 'center', border: '1.5px solid #f0e8ec' }}>
        <p style={{ color: '#374151', marginBottom: '16px' }}>{planError || 'Pacote indisponível.'}</p>
        <button onClick={() => router.push('/patient/dashboard')} style={{ padding: '10px 24px', background: COLOR, color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Voltar ao painel</button>
      </div>
      <PublicFooter />
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', paddingBottom: '60px' }}>
      <PublicHeader />

      <div style={{ maxWidth: '900px', margin: '36px auto 0', padding: '0 20px', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '28px', alignItems: 'start' }}>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #f0e8ec', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: `${COLOR}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLOR }}>
                <Package size={28} />
              </div>
              <div>
                <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Pacote selecionado</p>
                <p style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{plan.nome}</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Cobrança mensal</span>
                <span style={{ fontSize: '22px', fontWeight: 700, color: COLOR }}>{formatCurrency(plan.preco_mensal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Sessões por mês</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>{plan.sessoes_mensais}</span>
              </div>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'Sessões por videochamada',
                'Renovação mensal automática',
                'As sessões contratadas valem dentro do mês vigente',
                'Cancele quando quiser',
              ].map((f, i) => (
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
              Ao cancelar, não há novas cobranças, e as sessões já pagas valem até o fim do período.
            </p>
          </div>
        </aside>

        <section style={{ background: '#fff', borderRadius: '20px', border: '1.5px solid #f0e8ec', padding: '32px 28px', boxShadow: '0 4px 24px rgba(224,54,115,0.06)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>Contratar {plan.nome}</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>Pagamento processado pelo Asaas (certificação PCI-DSS) • Recorrência mensal</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px 18px' }}>
              <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 8px', fontWeight: 600 }}>Como funciona</p>
              <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4b5563', lineHeight: 1.7 }}>
                <li>Você vai para uma página segura do Asaas para informar os dados do cartão de crédito.</li>
                <li>Depois do pagamento, você volta ao Meu Divã automaticamente.</li>
                <li>Suas {plan.sessoes_mensais === 1 ? 'sessão aparece' : 'sessões aparecem'} em instantes, assim que o pagamento é confirmado.</li>
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
                background: `linear-gradient(135deg, ${COLOR} 0%, ${COLOR}cc 100%)`,
                color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
                cursor: opening ? 'not-allowed' : 'pointer', opacity: opening ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              }}
            >
              {opening
                ? <><Loader2 size={18} className="animate-spin" /> Abrindo o pagamento…</>
                : <><Lock size={16} /> Continuar para o pagamento • {formatCurrency(plan.preco_mensal)}/mês</>}
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

export default function PacoteCheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#f9f7f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: COLOR }} className="animate-spin" />
      </main>
    }>
      <PacoteCheckoutContent />
    </Suspense>
  )
}
