'use client'
// asaas-cartao-page v1: o cartão é digitado aqui, no nosso site, e a cobrança é feita pelo Asaas (POST /api/asaas/assinar).

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, Crown, Star, Shield } from 'lucide-react'
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

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1.5px solid #e5e7eb',
  borderRadius: '10px', fontSize: '15px', color: '#1a1a2e', background: '#fff',
  outline: 'none', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 500, color: '#6b7280', letterSpacing: '0.02em',
  textTransform: 'uppercase', display: 'block', marginBottom: '6px',
}

function SuccessScreen({ planName, planKey }: { planName: string; planKey: string }) {
  const router = useRouter()
  const [ativo, setAtivo] = useState(false)

  // A ativação vem pelo aviso do Asaas (alguns segundos): confere até o plano ficar ativo.
  useEffect(() => {
    let tries = 0
    let stop = false
    const tick = async () => {
      tries++
      try {
        const r: any = await api('/api/payments/therapist/subscription', { silent: true } as any)
        if (stop) return
        if (r?.subscription?.plan === planKey && r?.subscription?.status === 'active') { setAtivo(true); return }
      } catch {}
      if (!stop && tries < 40) setTimeout(tick, 2500)
    }
    tick()
    return () => { stop = true }
  }, [planKey])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #E03673, #2F80D3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CheckCircle2 size={48} color="#fff" />
      </div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{ativo ? 'Assinatura ativada!' : 'Assinatura recebida!'}</h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '360px', margin: 0, lineHeight: 1.6 }}>
        {ativo
          ? <>Seu plano <strong>{planName}</strong> foi ativado com sucesso. Falta só um passo: enviar seus documentos para validar o perfil e ganhar o selo de terapeuta verificado.</>
          : <>Estamos ativando o seu plano <strong>{planName}</strong>. Isso leva só alguns instantes; você também recebe uma notificação quando estiver pronto.</>}
      </p>
      <button
        onClick={() => router.push('/therapist/documents/required')}
        style={{ marginTop: '8px', padding: '13px 32px', background: 'linear-gradient(135deg, #E03673, #c42d63)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
      >
        Enviar documentos
      </button>
      <button
        onClick={() => router.push('/therapist/dashboard')}
        style={{ marginTop: '4px', padding: '8px 16px', background: 'transparent', color: '#6b7280', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
      >
        Fazer depois
      </button>
    </div>
  )
}

function cpfValido(raw: string): boolean {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

function SubscriptionCheckoutContent() {
  const searchParams = useSearchParams()
  const planId = (searchParams.get('plan') || 'profissional') as 'essencial' | 'profissional' | 'premium'
  const plan = PLANS[planId] || PLANS.profissional
  const planKey = (PLANS[planId] ? planId : 'profissional') as string
  const trial = TRIAL_DIAS[planKey] || 0
  const primeiraCobranca = new Date(Date.now() + trial * 86400000).toLocaleDateString('pt-BR')

  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [cep, setCep] = useState('')
  const [addrNumber, setAddrNumber] = useState('')
  const [phone, setPhone] = useState('')

  const numeroRef = useRef<HTMLInputElement>(null)
  const [enderecoCep, setEnderecoCep] = useState<string | null>(null)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  // Ao completar o CEP, busca rua/bairro/cidade (rota /api/asaas/cep) e leva o cursor para o número. Se falhar, o formulário segue normalmente.
  useEffect(() => {
    const d = cep.replace(/\D/g, '')
    if (d.length !== 8) { setEnderecoCep(null); setAvisoCep(null); return }
    let ativo = true
    setBuscandoCep(true)
    ;(async () => {
      try {
        const r: any = await api(`/api/asaas/cep/${d}`, { silent: true } as any)
        if (!ativo) return
        const rua = [r?.logradouro, r?.bairro].filter(Boolean).join(', ')
        const cidade = [r?.cidade, r?.uf].filter(Boolean).join('/')
        setEnderecoCep([rua, cidade].filter(Boolean).join(' — '))
        setAvisoCep(null)
        numeroRef.current?.focus()
      } catch (e: any) {
        if (!ativo) return
        setEnderecoCep(null)
        setAvisoCep(String(e?.message || '').includes('não encontrado') ? 'CEP não encontrado. Confira os números.' : 'Não foi possível buscar o endereço agora. Digite o número do endereço mesmo assim.')
      } finally {
        if (ativo) setBuscandoCep(false)
      }
    })()
    return () => { ativo = false }
  }, [cep])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const maskCard = (v: string) => v.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19)
  const maskExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }
  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  const maskCep = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }
  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError('Informe o nome no cartão.'); return }
    if (name.trim().split(/\s+/).length < 2) { setError('Informe nome e sobrenome, como estão no cartão.'); return }
    if (cardNumber.replace(/\s/g, '').length < 13) { setError('Número do cartão inválido.'); return }
    if (expiry.length < 5) { setError('Validade inválida.'); return }
    if (cvv.length < 3) { setError('CVV inválido.'); return }
    if (!cpfValido(cpf)) { setError('CPF inválido. Confira os números.'); return }
    if (cep.replace(/\D/g, '').length !== 8) { setError('CEP inválido.'); return }
    if (!addrNumber.trim()) { setError('Informe o número do endereço.'); return }
    if (phone.replace(/\D/g, '').length < 10) { setError('Celular inválido. Informe com DDD.'); return }

    setLoading(true)
    setError(null)
    try {
      await api('/api/asaas/assinar', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'terapeuta',
          plano: planKey,
          cartao: { nome: name.trim(), numero: cardNumber.replace(/\s/g, ''), validade: expiry, ccv: cvv },
          titular: { cpf: cpf.replace(/\D/g, ''), cep: cep.replace(/\D/g, ''), numero: addrNumber.trim(), celular: phone.replace(/\D/g, '') },
        }),
      })
      setCardNumber('')
      setCvv('')
      setSuccess(true)
    } catch (e: any) {
      setError(e?.message || 'Não foi possível concluir a assinatura agora. Tente novamente em instantes.')
    } finally {
      setLoading(false)
    }
  }, [name, cpf, cardNumber, expiry, cvv, cep, addrNumber, phone, planKey])

  if (success) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <PublicHeader />
      <SuccessScreen planName={plan.name} planKey={planKey} />
      <PublicFooter />
    </main>
  )

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

        {/* Formulário */}
        <section style={{ background: '#fff', borderRadius: '20px', border: '1.5px solid #f0e8ec', padding: '32px 28px', boxShadow: '0 4px 24px rgba(224,54,115,0.06)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>Assinar plano {plan.name}</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>Pagamento processado pelo Asaas • Recorrência mensal</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {trial > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 16px' }}>
                <p style={{ fontSize: '14px', color: '#166534', margin: 0, fontWeight: 600 }}>{trial} dias grátis</p>
                <p style={{ fontSize: '13px', color: '#166534', margin: '4px 0 0', lineHeight: 1.5 }}>
                  O cartão é validado agora, mas a primeira cobrança de {formatCurrency(plan.price)} só acontece em {primeiraCobranca}. Cancele antes disso e não paga nada.
                </p>
              </div>
            )}
            <div>
              <label style={labelStyle}>Nome no cartão</label>
              <input style={inputStyle} type="text" placeholder="Como aparece no cartão" value={name} onChange={e => setName(e.target.value)} autoComplete="cc-name" />
            </div>
            <div>
              <label style={labelStyle}>CPF do titular</label>
              <input style={inputStyle} type="text" placeholder="000.000.000-00" value={cpf} onChange={e => setCpf(maskCpf(e.target.value))} inputMode="numeric" />
            </div>
            <div>
              <label style={labelStyle}>Número do cartão</label>
              <input style={inputStyle} type="text" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(maskCard(e.target.value))} inputMode="numeric" autoComplete="cc-number" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Validade</label>
                <input style={inputStyle} type="text" placeholder="MM/AA" value={expiry} onChange={e => setExpiry(maskExpiry(e.target.value))} inputMode="numeric" autoComplete="cc-exp" />
              </div>
              <div>
                <label style={labelStyle}>CVV</label>
                <input style={inputStyle} type="text" placeholder="000" value={cvv} onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>CEP do titular</label>
                <input style={inputStyle} type="text" placeholder="00000-000" value={cep} onChange={e => setCep(maskCep(e.target.value))} inputMode="numeric" autoComplete="postal-code" />
              </div>
              <div>
                <label style={labelStyle}>Nº do endereço</label>
                <input style={inputStyle} type="text" ref={numeroRef} placeholder="123" value={addrNumber} onChange={e => setAddrNumber(e.target.value.slice(0, 10))} />
              </div>
            </div>
            {(buscandoCep || enderecoCep || avisoCep) && (
              <p style={{ fontSize: '12px', margin: '-4px 0 0', color: avisoCep ? '#b45309' : '#166534', lineHeight: 1.5 }}>
                {buscandoCep ? 'Buscando endereço…' : (enderecoCep ? `✓ ${enderecoCep}` : avisoCep)}
              </p>
            )}
            <div>
              <label style={labelStyle}>Celular do titular</label>
              <input style={inputStyle} type="text" placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(maskPhone(e.target.value))} inputMode="tel" autoComplete="tel" />
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '6px 0 0' }}>CEP, número e celular são exigidos pelo Asaas para liberar a cobrança no cartão.</p>
            </div>

            {error && (
              <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${plan.color} 0%, ${plan.color}cc 100%)`,
                color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Processando…</> : (trial > 0 ? `Começar ${trial} dias grátis` : `Assinar por ${formatCurrency(plan.price)}/mês`)}
            </button>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {['Asaas', 'Conexão segura', 'Não guardamos seu cartão'].map(b => (
                <span key={b} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280' }}>{b}</span>
              ))}
            </div>
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
