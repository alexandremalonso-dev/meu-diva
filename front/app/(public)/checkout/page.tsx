'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CreditCard, QrCode, Copy, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

interface TherapistSummary {
  name: string
  crp: string
  specialties: string[]
  photo_url: string | null
  session_price: number
  session_duration_minutes: number
}

interface CheckoutSession {
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

// ---------------------------------------------------------------------------
// Formulário de Cartão (cobrança pelo Asaas) // asaas-sessao-page v1
// ---------------------------------------------------------------------------
function CardForm({ paymentId, amount, onSuccess, onError }: {
  paymentId: number; amount: number; payerEmail?: string
  onSuccess: () => void; onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [addrNumber, setAddrNumber] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const numeroRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const maskCard = (v: string) => v.replace(/\D/g, '').replace(/(\d{4})/g, '$1 ').trim().slice(0, 19)
  const maskExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }
  const maskCep = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d }
  const maskPhone = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }
  const maskCpf = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 3) return d
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Mesma lógica dos perfis: ao completar o CEP busca o endereço (/api/patients/cep) e preenche rua, bairro, cidade e UF, que continuam editáveis.
  useEffect(() => {
    const d = cep.replace(/\D/g, '')
    if (d.length !== 8) { setAvisoCep(null); return }
    let ativo = true
    setBuscandoCep(true)
    ;(async () => {
      try {
        const r: any = await api(`/api/patients/cep/${d}`, { silent: true } as any)
        if (!ativo) return
        if (r && !r.erro) {
          setRua(r.logradouro || '')
          setBairro(r.bairro || '')
          setCidade(r.localidade || '')
          setUf(String(r.uf || '').toUpperCase())
          setAvisoCep(null)
          numeroRef.current?.focus()
        } else {
          setAvisoCep('CEP não encontrado. Preencha o endereço manualmente.')
        }
      } catch (e: any) {
        if (!ativo) return
        setAvisoCep(String(e?.message || '').includes('não encontrado') ? 'CEP não encontrado. Preencha o endereço manualmente.' : 'Não foi possível buscar o endereço agora. Preencha manualmente.')
      } finally {
        if (ativo) setBuscandoCep(false)
      }
    })()
    return () => { ativo = false }
  }, [cep])

  // Quando o banco ainda está analisando, espera o aviso do Asaas confirmar a sessão (até ~1m50s).
  const aguardarConfirmacao = () => {
    setInfo('Pagamento recebido. Confirmando com o banco…')
    let tentativas = 0
    pollRef.current = setInterval(async () => {
      tentativas += 1
      try {
        const s = await api(`/api/payments/status/${paymentId}`)
        if (s.status === 'paid') { if (pollRef.current) clearInterval(pollRef.current); onSuccess(); return }
      } catch (_) {}
      if (tentativas >= 36) {
        if (pollRef.current) clearInterval(pollRef.current)
        setInfo(null)
        setError('Pagamento em análise. Você receberá a confirmação por e-mail.')
      }
    }, 3000)
  }

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) { setError('Informe o nome no cartão.'); return }
    if (cpf.replace(/\D/g, '').length !== 11) { setError('Informe o CPF do titular.'); return }
    if (cardNumber.replace(/\s/g, '').length < 16) { setError('Número do cartão inválido.'); return }
    if (expiry.length < 5) { setError('Validade inválida.'); return }
    if (cvv.length < 3) { setError('CVV inválido.'); return }
    if (cep.replace(/\D/g, '').length !== 8) { setError('CEP inválido.'); return }
    if (rua.trim().length < 3) { setError('Informe a rua do endereço.'); return }
    if (!addrNumber.trim()) { setError('Informe o número do endereço (ou S/N).'); return }
    if (cidade.trim().length < 2) { setError('Informe a cidade.'); return }
    if (!/^[A-Za-z]{2}$/.test(uf.trim())) { setError('Informe o estado (UF).'); return }
    if (phone.replace(/\D/g, '').length < 10) { setError('Informe o celular do titular, com DDD.'); return }

    setLoading(true); setError(null); setInfo(null)
    try {
      const result = await api('/api/asaas/sessao/cartao', {
        method: 'POST',
        body: JSON.stringify({
          payment_id: paymentId,
          cartao: { nome: name.trim(), numero: cardNumber.replace(/\s/g, ''), validade: expiry, ccv: cvv },
          titular: {
            cpf: cpf.replace(/\D/g, ''), cep: cep.replace(/\D/g, ''), rua: rua.trim(), numero: addrNumber.trim(),
            complemento: complemento.trim(), bairro: bairro.trim(), cidade: cidade.trim(), uf: uf.trim().toUpperCase(),
            celular: phone.replace(/\D/g, ''),
          },
        }),
      })
      setCardNumber(''); setCvv('') // não deixa os dados do cartão na tela depois de enviar

      if (result.status === 'approved') onSuccess()
      else if (result.status === 'pending') aguardarConfirmacao()
      else { const msg = result.detail || 'Pagamento recusado.'; setError(msg); onError(msg) }
    } catch (e: any) {
      setError(e.message || 'Erro ao processar pagamento.')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, cpf, cardNumber, expiry, cvv, cep, rua, addrNumber, complemento, bairro, cidade, uf, phone, paymentId, onSuccess, onError])

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

      <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', margin: '4px 0 -4px' }}>Endereço do titular do cartão</p>
      <div><label style={labelStyle}>CEP *</label>
        <input style={inputStyle} type="text" placeholder="00000-000" value={cep} onChange={(e) => setCep(maskCep(e.target.value))} inputMode="numeric" autoComplete="postal-code" />
        {(buscandoCep || avisoCep) && (
          <p style={{ fontSize: '12px', margin: '6px 0 0', color: avisoCep ? '#b45309' : '#6b7280' }}>{buscandoCep ? 'Buscando endereço…' : avisoCep}</p>
        )}
      </div>
      <div><label style={labelStyle}>Rua *</label>
        <input style={inputStyle} type="text" value={rua} onChange={(e) => setRua(e.target.value)} autoComplete="address-line1" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div><label style={labelStyle}>Número *</label>
          <input ref={numeroRef} style={inputStyle} type="text" placeholder="123 ou S/N" value={addrNumber} onChange={(e) => setAddrNumber(e.target.value.slice(0, 10))} />
        </div>
        <div><label style={labelStyle}>Complemento</label>
          <input style={inputStyle} type="text" placeholder="Apto, bloco, sala" value={complemento} onChange={(e) => setComplemento(e.target.value.slice(0, 60))} autoComplete="address-line2" />
        </div>
      </div>
      <div><label style={labelStyle}>Bairro</label>
        <input style={inputStyle} type="text" value={bairro} onChange={(e) => setBairro(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '12px' }}>
        <div><label style={labelStyle}>Cidade *</label>
          <input style={inputStyle} type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} autoComplete="address-level2" />
        </div>
        <div><label style={labelStyle}>UF *</label>
          <input style={inputStyle} type="text" maxLength={2} placeholder="MG" value={uf} onChange={(e) => setUf(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))} autoComplete="address-level1" />
        </div>
      </div>
      <div><label style={labelStyle}>Celular do titular *</label>
        <input style={inputStyle} type="text" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="numeric" autoComplete="tel" />
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '6px 0 0' }}>O endereço e o celular do titular são exigidos pelo Asaas para liberar a cobrança no cartão.</p>
      </div>

      {info && <p style={{ fontSize: '13px', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>{info}</p>}
      {error && <p style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', margin: 0 }}>{error}</p>}
      <button onClick={handleSubmit} disabled={loading || !!info} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        width: '100%', padding: '16px', background: 'linear-gradient(135deg, #E03673 0%, #c42d63 100%)',
        color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', borderRadius: '12px',
        cursor: (loading || !!info) ? 'not-allowed' : 'pointer', opacity: (loading || !!info) ? 0.6 : 1,
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
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string; asaas_payment_id?: string; expires_at?: string | null } | null>(null)
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
      const result = await api('/api/asaas/sessao/pix', {
        method: 'POST',
        body: JSON.stringify({ payment_id: paymentId, payer_cpf: cpf.replace(/\D/g, '') }),
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
          {pixData.expires_at ? `Este código vale até ${new Date(pixData.expires_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. ` : ''}Após o pagamento, a confirmação é automática.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '16px' }}>
        <p style={{ color: '#1d4ed8', fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>Pagamento via Pix</p>
        <p style={{ color: '#1d4ed8', fontSize: '13px', margin: 0 }}>Instantâneo, sem taxas adicionais. A confirmação é automática depois do pagamento.</p>
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

  const { payment_id, therapist, appointment_date, appointment_time } = session
  const amount: number = Number(session.amount ?? session.therapist?.session_price ?? 0)

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

      <div className="checkout-grid" style={{ maxWidth: '900px', margin: '36px auto 0', padding: '0 20px', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '28px', alignItems: 'start' }}>

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
              <CardForm paymentId={payment_id} amount={amount} payerEmail={userEmail} onSuccess={() => setSuccess(true)} onError={() => {}} />
            ) : (
              <PixForm paymentId={payment_id} amount={amount} payerEmail={userEmail} onSuccess={() => setSuccess(true)} />
            )
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#16a34a', fontWeight: 600 }}>
              ✅ Sessão paga com saldo da carteira!
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '20px', justifyContent: 'center' }}>
            {['Asaas', 'Conexão segura', 'Não guardamos seu cartão'].map((b) => (
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