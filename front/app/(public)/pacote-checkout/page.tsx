'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, Shield, Package } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-6dd38a4a-5036-4838-8104-92314dc8414a'
const COLOR = '#E03673'

interface Plan {
  chave: string
  nome: string
  preco_mensal: number
  sessoes_mensais: number
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

// Mesmo bloqueio e mesma chave do checkout de terapeuta: o antifraude do Mercado Pago é
// da mesma conta, então uma recusa em um checkout vale para o outro.
const BLOCK_MINUTES = 3
const BLOCK_KEY = 'mp_sub_block_until'

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

function SuccessScreen({ plan }: { plan: Plan }) {
  const router = useRouter()
  const [remaining, setRemaining] = useState<number | null>(null)

  // O crédito entra quando o Mercado Pago avisa a cobrança aprovada (alguns segundos).
  useEffect(() => {
    let tries = 0
    let stop = false
    const tick = async () => {
      tries++
      try {
        const me: any = await api('/api/patient/pacotes/me', { silent: true } as any)
        if (stop) return
        if ((me?.sessions_remaining || 0) > 0) { setRemaining(me.sessions_remaining); return }
      } catch {}
      if (!stop && tries < 8) setTimeout(tick, 2500)
    }
    tick()
    return () => { stop = true }
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #E03673, #2F80D3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CheckCircle2 size={48} color="#fff" />
      </div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Pacote contratado!</h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '380px', margin: 0, lineHeight: 1.6 }}>
        {remaining !== null
          ? <>Seu pacote <strong>{plan.nome}</strong> está ativo e você já tem <strong>{remaining} {remaining === 1 ? 'sessão' : 'sessões'}</strong> disponíveis.</>
          : <>Recebemos sua assinatura do <strong>{plan.nome}</strong>. Suas sessões aparecem em alguns instantes, assim que o pagamento é confirmado.</>}
      </p>
      <button
        onClick={() => router.push('/busca')}
        style={{ marginTop: '8px', padding: '13px 32px', background: 'linear-gradient(135deg, #E03673, #c42d63)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }}
      >
        Agendar uma sessão
      </button>
      <button
        onClick={() => router.push('/patient/pacotes')}
        style={{ marginTop: '4px', padding: '8px 16px', background: 'transparent', color: '#6b7280', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
      >
        Ver meu pacote
      </button>
    </div>
  )
}

function PacoteCheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const planKey = (searchParams.get('plan') || '').toLowerCase()

  const [plan, setPlan] = useState<Plan | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)

  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<number>(0)
  const [nowTs, setNowTs] = useState<number>(Date.now())
  const blocked = blockedUntil > nowTs

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
      if (n >= blockedUntil) { clearInterval(t); setError(null) }
    }, 1000)
    return () => clearInterval(t)
  }, [blockedUntil])

  // Script de segurança do Mercado Pago (gera MP_DEVICE_SESSION_ID)
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
    if (!plan) return
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
    setInfo(null)

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
      const result: any = await api('/api/patient/pacotes/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          plan: plan.chave,
          card_token_id: tokenResult.id,
          payer_cpf: cpf.replace(/\D/g, ''),
          device_id: (window as any).MP_DEVICE_SESSION_ID || '',
        }),
      })

      if (result.status === 'authorized') {
        setSuccess(true)
      } else if (result.status === 'pending') {
        setInfo('Seu pagamento está em análise pelo Mercado Pago. Assim que for aprovado, suas sessões aparecem em Meus pacotes.')
      } else {
        setError(`Assinatura não aprovada. Por segurança, aguarde ${BLOCK_MINUTES} min antes de tentar novamente.`)
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
  }, [plan, name, cpf, cardNumber, expiry, cvv, blockedUntil])

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

  if (success) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <PublicHeader />
      <SuccessScreen plan={plan} />
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
            {info && (
              <p style={{ fontSize: '13px', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>
                {info}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || blocked}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '16px',
                background: `linear-gradient(135deg, ${COLOR} 0%, ${COLOR}cc 100%)`,
                color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
                cursor: loading || blocked ? 'not-allowed' : 'pointer', opacity: loading || blocked ? 0.6 : 1,
                fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
              }}
            >
              {loading ? <><Loader2 size={18} className="animate-spin" /> Processando…</> : `Assinar por ${formatCurrency(plan.preco_mensal)}/mês`}
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
