'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CreditCard, CheckCircle2, Crown, Star, Shield } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-6dd38a4a-5036-4838-8104-92314dc8414a'

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

let mpInstance: any = null
async function loadMpSdk(publicKey: string): Promise<any> {
  if (mpInstance) return mpInstance
  return new Promise((resolve, reject) => {
    if ((window as any).MercadoPago) {
      mpInstance = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' })
      return resolve(mpInstance)
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => {
      mpInstance = new (window as any).MercadoPago(publicKey, { locale: 'pt-BR' })
      resolve(mpInstance)
    }
    script.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'))
    document.head.appendChild(script)
  })
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

function SuccessScreen({ planName }: { planName: string }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #E03673, #2F80D3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CheckCircle2 size={48} color="#fff" />
      </div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Assinatura ativada!</h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '360px', margin: 0, lineHeight: 1.6 }}>
        Seu plano <strong>{planName}</strong> foi ativado com sucesso. Falta só um passo: enviar seus documentos para validar o perfil e ganhar o selo de terapeuta verificado.
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

// 🔥 A documentação do Mercado Pago orienta evitar novas tentativas imediatas
// com os mesmos dados após uma recusa (o antifraude pode tratar como duplicada
// e continuar recusando). O tempo abaixo é escolha nossa, não da documentação.
const BLOCK_MINUTES = 3
const BLOCK_KEY = 'mp_sub_block_until'

// 🔥 Valida o dígito verificador do CPF (o Mercado Pago pede documento real do pagador)
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const planId = (searchParams.get('plan') || 'profissional') as 'essencial' | 'profissional' | 'premium'
  const plan = PLANS[planId] || PLANS.profissional

  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [blockedUntil, setBlockedUntil] = useState<number>(0)
  const [nowTs, setNowTs] = useState<number>(Date.now())
  const blocked = blockedUntil > nowTs

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BLOCK_KEY) || 0)
      if (saved > Date.now()) {
        setBlockedUntil(saved)
        const min = Math.ceil((saved - Date.now()) / 60000)
        setError(`Por segurança, aguarde ${min} min antes de tentar novamente.`)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (blockedUntil <= Date.now()) return
    const t = setInterval(() => {
      const n = Date.now()
      setNowTs(n)
      if (n >= blockedUntil) {
        clearInterval(t)
        setError(null)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [blockedUntil])

  useEffect(() => {
    api('/api/users/me').then((me: any) => setUserEmail(me.email || '')).catch(() => {})
  }, [])

  // 🔥 Script de segurança do Mercado Pago (gera MP_DEVICE_SESSION_ID)
  useEffect(() => {
    if (document.getElementById('mp-security-script')) return
    const s = document.createElement('script')
    s.id = 'mp-security-script'
    s.src = 'https://www.mercadopago.com/v2/security.js'
    s.setAttribute('view', 'checkout')
    document.head.appendChild(s)
  }, [])

  const maskCard = (v: string) => v.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19)
  const maskExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }
  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError('Informe o nome no cartão.'); return }
    if (name.trim().split(/\s+/).length < 2) { setError('Informe nome e sobrenome, como estão no cartão.'); return }
    if (cardNumber.replace(/\s/g, '').length < 16) { setError('Número do cartão inválido.'); return }
    if (expiry.length < 5) { setError('Validade inválida.'); return }
    if (cvv.length < 3) { setError('CVV inválido.'); return }
    if (!cpfValido(cpf)) { setError('CPF inválido. Confira os números.'); return }
    if (blockedUntil > Date.now()) {
      const min = Math.ceil((blockedUntil - Date.now()) / 60000)
      setError(`Por segurança, aguarde ${min} min antes de tentar novamente.`)
      return
    }

    setLoading(true)
    setError(null)

    let chamouAssinatura = false
    const bloquearNovaTentativa = () => {
      const until = Date.now() + BLOCK_MINUTES * 60000
      setBlockedUntil(until)
      try { localStorage.setItem(BLOCK_KEY, String(until)) } catch {}
    }

    try {
      const mp = await loadMpSdk(MP_PUBLIC_KEY)
      const [expMonth, expYear] = expiry.split('/')
      const rawCard = cardNumber.replace(/\s/g, '')

      const tokenResult = await mp.createCardToken({
        cardNumber: rawCard,
        cardholderName: name,
        identificationType: 'CPF',
        identificationNumber: cpf.replace(/\D/g, ''),
        cardExpirationMonth: expMonth,
        cardExpirationYear: `20${expYear}`,
        securityCode: cvv,
      })

      if (!tokenResult || tokenResult.error) {
        throw new Error(tokenResult?.error?.message || 'Erro ao tokenizar cartão.')
      }

      chamouAssinatura = true
      const result = await api('/api/payments/create-subscription', {
        method: 'POST',
        body: JSON.stringify({
          plan: planId,
          card_token_id: tokenResult.id,
          payer_email: userEmail,
          payer_cpf: cpf.replace(/\D/g, ''),
          device_id: (window as any).MP_DEVICE_SESSION_ID || '',
        }),
      })

      if (result.status === 'authorized' || result.status === 'active') {
        setSuccess(true)
      } else {
        setError(`${result.detail || 'Assinatura não aprovada. Verifique os dados do cartão.'} Por segurança, aguarde ${BLOCK_MINUTES} min antes de tentar novamente.`)
        bloquearNovaTentativa()
      }
    } catch (e: any) {
      const base = e.message || 'Erro ao processar assinatura.'
      if (chamouAssinatura) {
        setError(`${base} Por segurança, aguarde ${BLOCK_MINUTES} min antes de tentar novamente.`)
        bloquearNovaTentativa()
      } else {
        setError(base)
      }
    } finally {
      setLoading(false)
    }
  }, [name, cpf, cardNumber, expiry, cvv, planId, userEmail, blockedUntil])

  if (success) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <PublicHeader />
      <SuccessScreen planName={plan.name} />
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
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>Pagamento seguro via Mercado Pago • Recorrência mensal</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

            {error && (
              <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || blocked}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${plan.color} 0%, ${plan.color}cc 100%)`,
                color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Processando…</> : `Assinar por ${formatCurrency(plan.price)}/mês`}
            </button>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {['Mercado Pago', 'SSL 256-bit', 'PCI DSS'].map(b => (
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