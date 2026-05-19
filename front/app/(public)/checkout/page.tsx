'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CreditCard, QrCode, Copy, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

// Chave pública do Mercado Pago
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-6dd38a4a-5036-4838-8104-92314dc8414a'

interface TherapistSummary {
  name: string
  crp: string
  specialties: string[]
  photo_url: string | null
  session_price: number
  session_duration_minutes: number
}

interface CheckoutSession {
  mp_public_key: string
  already_paid?: boolean
  payment_id: number | null
  appointment_id: number
  amount: number
  total_amount: number
  wallet_balance: number
  therapist: TherapistSummary
  appointment_date: string
  appointment_time: string
}

const COUNTDOWN_SECONDS = 10 * 60

function useCountdown(initial: number) {
  const [seconds, setSeconds] = useState(initial)
  const expired = seconds <= 0
  useEffect(() => {
    if (expired) return
    const id = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(id)
  }, [expired])
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return { mm, ss, expired }
}

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(Number(value))) return 'R$ --'
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function getPhotoSrc(url: string | null): string {
  if (!url) return '/avatar-placeholder.png'
  if (url.startsWith('blob:') || url.startsWith('http')) return url
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`
}

// SDK do MP
let mpInstance: any = null
async function loadMpSdk(publicKey: string): Promise<any> {
  const key = publicKey || MP_PUBLIC_KEY
  if (!key) throw new Error('NEXT_PUBLIC_MP_PUBLIC_KEY não configurada')
  if (mpInstance) return mpInstance
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'))
    if ((window as any).MercadoPago) {
      mpInstance = new (window as any).MercadoPago(key, { locale: 'pt-BR' })
      return resolve(mpInstance)
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => {
      mpInstance = new (window as any).MercadoPago(key, { locale: 'pt-BR' })
      resolve(mpInstance)
    }
    script.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'))
    document.head.appendChild(script)
  })
}

// ---------------------------------------------------------------------------
// Formulário de Cartão
// ---------------------------------------------------------------------------
function CardForm({ mpPublicKey, paymentId, amount, payerEmail, onSuccess, onError }: {
  mpPublicKey: string; paymentId: number; amount: number
  payerEmail: string; onSuccess: () => void; onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    if (cardNumber.replace(/\s/g, '').length < 16) { setError('Número do cartão inválido.'); return }
    if (expiry.length < 5) { setError('Validade inválida.'); return }
    if (cvv.length < 3) { setError('CVV inválido.'); return }

    setLoading(true); setError(null)
    try {
      const mp = await loadMpSdk(mpPublicKey || MP_PUBLIC_KEY)
      const [expMonth, expYear] = expiry.split('/')
      const rawCard = cardNumber.replace(/\s/g, '')
      const tokenResult = await mp.createCardToken({
        cardNumber: rawCard, cardholderName: name,
        cardExpirationMonth: expMonth, cardExpirationYear: `20${expYear}`, securityCode: cvv,
      })
      if (!tokenResult || tokenResult.error) throw new Error(tokenResult?.error?.message || 'Erro ao tokenizar cartão.')

      const bin = rawCard.slice(0, 6)
      const pmResult = await mp.getPaymentMethods({ bin })
      const paymentMethodId = pmResult?.results?.[0]?.id || 'credit_card'
      const issuerId = pmResult?.results?.[0]?.issuer?.id

      const result = await api('/api/payments/process-payment', {
        method: 'POST',
        body: JSON.stringify({
          payment_id: paymentId, card_token: tokenResult.id,
          payment_method_id: paymentMethodId, issuer_id: issuerId,
          payer_email: payerEmail, payer_cpf: cpf.replace(/\D/g, ''),
        }),
      })

      if (result.status === 'approved') onSuccess()
      else if (result.status === 'pending') setError('Pagamento em análise. Você receberá confirmação por e-mail.')
      else { setError(result.detail || 'Pagamento recusado.'); onError(result.detail || 'Pagamento recusado.') }
    } catch (e: any) {
      setError(e.message || 'Erro ao processar pagamento.')
    } finally {
      setLoading(false)
    }
  }, [name, cpf, cardNumber, expiry, cvv, mpPublicKey, paymentId, payerEmail, onSuccess, onError])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', border: '1.5px solid #e5e7eb',
    borderRadius: '10px', fontSize: '15px', color: '#1a1a2e', background: '#fff',
    outline: 'none', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 500, color: '#6b7280', letterSpacing: '0.02em',
    textTransform: 'uppercase', display: 'block', marginBottom: '6px',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div><label style={labelStyle}>Nome no cartão</label>
        <input style={inputStyle} type="text" placeholder="Como aparece no cartão" value={name} onChange={(e) => setName(e.target.value)} autoComplete="cc-name" />
      </div>
      <div><label style={labelStyle}>CPF do titular</label>
        <input style={inputStyle} type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} inputMode="numeric" />
      </div>
      <div><label style={labelStyle}>Número do cartão</label>
        <input style={inputStyle} type="text" placeholder="0000 0000 0000 0000" value={cardNumber} onChange={(e) => setCardNumber(maskCard(e.target.value))} inputMode="numeric" autoComplete="cc-number" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={labelStyle}>Validade</label>
          <input style={inputStyle} type="text" placeholder="MM/AA" value={expiry} onChange={(e) => setExpiry(maskExpiry(e.target.value))} inputMode="numeric" autoComplete="cc-exp" />
        </div>
        <div><label style={labelStyle}>CVV</label>
          <input style={inputStyle} type="text" placeholder="000" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" />
        </div>
      </div>
      {error && <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>{error}</p>}
      <button onClick={handleSubmit} disabled={loading} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '16px', background: 'linear-gradient(135deg, #E03673 0%, #c42d63 100%)',
        color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}>
        {loading ? <><Loader2 size={18} className="animate-spin" /> Processando…</> : `Pagar ${formatCurrency(amount)}`}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulário de Pix
// ---------------------------------------------------------------------------
function PixForm({ paymentId, amount, payerEmail, onSuccess }: {
  paymentId: number; amount: number; payerEmail: string; onSuccess: () => void
}) {
  const [cpf, setCpf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; mp_payment_id: string; expires_at: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }

  const handleGeneratePix = async () => {
    if (cpf.replace(/\D/g, '').length < 11) { setError('CPF inválido.'); return }
    setLoading(true); setError(null)
    try {
      const result = await api('/api/payments/create-pix', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId, payer_email: payerEmail, payer_cpf: cpf.replace(/\D/g, '') }),
      })
      setPixData(result)
      // Inicia polling a cada 5s para verificar pagamento
      pollingRef.current = setInterval(async () => {
        try {
          const status = await api(`/api/payments/status/${paymentId}`)
          if (status.status === 'paid') {
            clearInterval(pollingRef.current!)
            onSuccess()
          }
        } catch (_) {}
      }, 5000)
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar Pix.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current) }, [])

  const handleCopy = async () => {
    if (!pixData?.qr_code) return
    await navigator.clipboard.writeText(pixData.qr_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
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

  if (pixData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '16px', width: '100%', textAlign: 'center' }}>
          <p style={{ color: '#166534', fontWeight: 600, fontSize: '14px', margin: '0 0 4px' }}>QR Code gerado com sucesso!</p>
          <p style={{ color: '#166534', fontSize: '13px', margin: 0 }}>Escaneie com o app do seu banco ou use o código copia e cola.</p>
        </div>

        {pixData.qr_code_base64 && (
          <img
            src={`data:image/png;base64,${pixData.qr_code_base64}`}
            alt="QR Code Pix"
            style={{ width: '200px', height: '200px', borderRadius: '12px', border: '1.5px solid #e5e7eb' }}
          />
        )}

        <div style={{ width: '100%' }}>
          <label style={labelStyle}>Código Pix (copia e cola)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={{ ...inputStyle, fontSize: '11px', color: '#6b7280', flex: 1 }}
              readOnly value={pixData.qr_code}
            />
            <button onClick={handleCopy} style={{
              padding: '12px 16px', background: copied ? '#16a34a' : '#E03673',
              color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {copied ? <><CheckCircle2 size={16} /> Copiado!</> : <><Copy size={16} /> Copiar</>}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', fontSize: '13px' }}>
          <Loader2 size={16} className="animate-spin" />
          Aguardando confirmação do pagamento…
        </div>

        <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0, textAlign: 'center' }}>
          O Pix expira em 30 minutos. Após o pagamento, a confirmação é automática.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
        <p style={{ color: '#1d4ed8', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Pagamento via Pix</p>
        <p style={{ color: '#1d4ed8', fontSize: '13px', margin: 0 }}>Instantâneo, sem taxas adicionais. O QR Code expira em 30 minutos.</p>
      </div>

      <div>
        <label style={labelStyle}>CPF do titular</label>
        <input style={inputStyle} type="text" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(maskCpf(e.target.value))} inputMode="numeric" />
      </div>

      {error && <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>{error}</p>}

      <button onClick={handleGeneratePix} disabled={loading} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '16px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
        color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
        cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}>
        {loading ? <><Loader2 size={18} className="animate-spin" /> Gerando QR Code…</> : <><QrCode size={18} /> Gerar QR Code Pix — {formatCurrency(amount)}</>}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tela de sucesso
// ---------------------------------------------------------------------------
function SuccessScreen({ therapist, date, time }: { therapist: TherapistSummary; date: string; time: string }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 0', textAlign: 'center' }}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #E03673, #2F80D3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Sessão confirmada!</h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '360px', margin: 0, lineHeight: 1.6 }}>
        Sua sessão com <strong>{therapist.name}</strong> foi agendada para <strong>{formatDate(date)}</strong> às <strong>{time}</strong>.
      </p>
      <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>Você receberá os detalhes por e-mail em breve.</p>
      <button onClick={() => router.push('/patient/dashboard')} style={{
        marginTop: '8px', padding: '13px 32px', background: 'linear-gradient(135deg, #E03673, #c42d63)',
        color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer',
      }}>Ir para o painel</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conteúdo principal
// ---------------------------------------------------------------------------
function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const appointmentId = searchParams.get('appointment_id')

  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const [activeTab, setActiveTab] = useState<'card' | 'pix'>('card')

  const { mm, ss, expired } = useCountdown(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (!appointmentId) { setFetchError('Agendamento não identificado.'); setLoading(false); return }
    ;(async () => {
      try {
        const [sessionData, meData] = await Promise.all([
          api('/api/payments/create-payment-intent', { method: 'POST', body: JSON.stringify({ appointment_id: Number(appointmentId) }) }),
          api('/api/users/me'),
        ])
        if (sessionData.already_paid) { setSuccess(true) }
        setSession(sessionData)
        setUserEmail(meData.email || '')
      } catch (e: any) {
        setFetchError(e.message ?? 'Não foi possível iniciar o pagamento.')
      } finally {
        setLoading(false)
      }
    })()
  }, [appointmentId])

  useEffect(() => { if (expired && !success) router.push('/patient/dashboard') }, [expired, success, router])

  if (loading) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', paddingBottom: '60px' }}>
      <PublicHeader />
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[160, 24, 24, 208].map((h, i) => (
          <div key={i} style={{ height: h, borderRadius: '10px', background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 37%, #f0f0f0 63%)', backgroundSize: '400% 100%' }} />
        ))}
      </div>
      <PublicFooter />
    </main>
  )

  if (fetchError || !session) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8' }}>
      <PublicHeader />
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#dc2626', fontSize: '16px', marginBottom: '16px' }}>{fetchError ?? 'Sessão não encontrada.'}</p>
        <button onClick={() => router.back()} style={{ padding: '10px 24px', background: '#E03673', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Voltar</button>
      </div>
      <PublicFooter />
    </main>
  )

  const { mp_public_key: _mp_key, payment_id, therapist, appointment_date, appointment_time } = session
  const amount: number = Number(session.amount ?? session.therapist?.session_price ?? 0)
  const mp_public_key = _mp_key || MP_PUBLIC_KEY

  if (success) return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', paddingBottom: '60px', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
      <PublicHeader />
      <SuccessScreen therapist={therapist} date={appointment_date} time={appointment_time} />
      <PublicFooter />
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', color: '#1a1a2e', paddingBottom: '60px' }}>
      <PublicHeader />

      <div style={{ maxWidth: '900px', margin: '36px auto 0', padding: '0 20px', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '28px', alignItems: 'start' }}>

        {/* Resumo */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 14px', background: expired ? '#fef2f2' : '#fff3f0', border: `1.5px solid ${expired ? '#fca5a5' : '#fecaca'}`, borderRadius: '100px', fontSize: '13px', fontWeight: 600, color: expired ? '#991b1b' : '#c2410c', width: 'fit-content' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            {expired ? 'Tempo esgotado — redirecionando…' : `Reserva expira em ${mm}:${ss}`}
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #f0e8ec', padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden', border: '2.5px solid #f8d7e5' }}>
              <Image src={getPhotoSrc(therapist.photo_url)} alt={therapist.name} width={72} height={72} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 2px', color: '#1a1a2e' }}>{therapist.name}</p>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0 0 10px' }}>CRP {therapist.crp}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {therapist.specialties.slice(0, 3).map((s) => (
                  <span key={s} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '100px', background: '#fce8f1', color: '#be185d' }}>{s}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', border: '1.5px solid #f0e8ec', padding: '16px 20px' }}>
            {[
              { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E03673" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>, label: 'Data e hora', value: `${formatDate(appointment_date)} · ${appointment_time}`, isPrice: false },
              { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E03673" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: 'Duração', value: `${therapist.session_duration_minutes} minutos`, isPrice: false },
              { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E03673" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, label: 'Valor', value: formatCurrency(amount), isPrice: true },
            ].map(({ icon, label, value, isPrice }, i, arr) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #f9f0f5' : 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#9ca3af', fontWeight: 500, flexShrink: 0 }}>{icon}{label}</span>
                <span style={{ fontSize: isPrice ? '18px' : '13px', fontWeight: isPrice ? 700 : 600, color: isPrice ? '#E03673' : '#374151', textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '12px 16px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F80D3" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
            <p style={{ fontSize: '13px', color: '#1d4ed8', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>Cancelamento gratuito até 24h antes da sessão.</p>
          </div>
        </aside>

        {/* Formulário de pagamento */}
        <section style={{ background: '#fff', borderRadius: '20px', border: '1.5px solid #f0e8ec', padding: '32px 28px', boxShadow: '0 4px 24px rgba(224,54,115,0.06)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' }}>Finalizar agendamento</h1>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' }}>Escolha a forma de pagamento</p>

          {/* Abas */}
          {payment_id && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {[
                { key: 'card', label: 'Cartão', icon: <CreditCard size={16} /> },
                { key: 'pix', label: 'Pix', icon: <QrCode size={16} /> },
              ].map(({ key, label, icon }) => (
                <button key={key} onClick={() => setActiveTab(key as 'card' | 'pix')} style={{
                  flex: 1, padding: '10px', border: `2px solid ${activeTab === key ? '#E03673' : '#e5e7eb'}`,
                  borderRadius: '10px', background: activeTab === key ? '#fff0f5' : '#fff',
                  color: activeTab === key ? '#E03673' : '#6b7280', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                }}>
                  {icon} {label}
                </button>
              ))}
            </div>
          )}

          {payment_id ? (
            activeTab === 'card' ? (
              <CardForm mpPublicKey={mp_public_key} paymentId={payment_id} amount={amount} payerEmail={userEmail} onSuccess={() => setSuccess(true)} onError={() => {}} />
            ) : (
              <PixForm paymentId={payment_id} amount={amount} payerEmail={userEmail} onSuccess={() => setSuccess(true)} />
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#16a34a', fontWeight: 600 }}>
              ✅ Sessão paga com saldo da carteira!
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px', justifyContent: 'center' }}>
            {['Mercado Pago', 'SSL 256-bit', 'PCI DSS'].map((b) => (
              <span key={b} style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: '#f3f4f6', color: '#6b7280', letterSpacing: '0.02em' }}>{b}</span>
            ))}
          </div>
        </section>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @media (max-width: 720px) { .checkout-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <PublicFooter />
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#f9f7f8' }}>
        <div style={{ maxWidth: 700, margin: '60px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[160, 24, 24, 208].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 10, background: '#e8e8e8' }} />
          ))}
        </div>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  )
}