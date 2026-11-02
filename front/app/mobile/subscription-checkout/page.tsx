'use client'
// asaas-cartao-mobile v2: cartão digitado aqui e cobrança pelo Asaas (POST /api/asaas/assinar). Espelha (public)/subscription-checkout.

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, Crown, Star, Shield, ShieldCheck, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { usePlanPrices, formatBRL } from '@/lib/planPrices'

const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" }

const PLANS: Record<string, any> = {
  essencial:    { name: 'Essencial',    commission: '20%', color: '#6b7280', icon: Shield,  features: ['Perfil na plataforma','Agenda e gestão de sessões','Videochamada integrada','Pagamento automático','Relatório financeiro'] },
  profissional: { name: 'Profissional', commission: '10%', color: '#2F80D3', icon: Star,    features: ['Comissão reduzida (10%)','Melhor posicionamento na busca','Acesso a mais pacientes','Relatórios básicos'] },
  premium:      { name: 'Premium',      commission: '3%',  color: '#E03673', icon: Crown,   features: ['Comissão mínima (3%)','Destaque máximo na plataforma','Leads prioritários','Analytics avançado'] },
}

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const maskCard = (v: string) => v.replace(/\D/g,'').replace(/(\d{4})/g,'$1 ').trim().slice(0,19)
const maskExpiry = (v: string) => { const d = v.replace(/\D/g,'').slice(0,4); return d.length >= 3 ? `${d.slice(0,2)}/${d.slice(2)}` : d }
const maskCpf = (v: string) => { const d = v.replace(/\D/g,'').slice(0,11); if(d.length<=3)return d; if(d.length<=6)return `${d.slice(0,3)}.${d.slice(3)}`; if(d.length<=9)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`; return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` }
const maskCep = (v: string) => { const d = v.replace(/\D/g,'').slice(0,8); return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d }
const maskPhone = (v: string) => {
  let d = v.replace(/\D/g,'').replace(/^0+/,'')
  if(d.length>11&&d.startsWith('55'))d=d.slice(2)
  d=d.slice(0,11)
  if(d.length<=2)return d
  if(d.length<=6)return `(${d.slice(0,2)}) ${d.slice(2)}`
  if(d.length<=10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}
function cpfValido(raw: string): boolean {
  const d = raw.replace(/\D/g,''); if(d.length!==11||/^(\d)\1{10}$/.test(d))return false
  const dv=(len:number)=>{let s=0;for(let i=0;i<len;i++)s+=Number(d[i])*(len+1-i);const r=(s*10)%11;return r===10?0:r}
  return dv(9)===Number(d[9])&&dv(10)===Number(d[10])
}

const inputSt = (f?: boolean): React.CSSProperties => ({ width:'100%', padding:'12px 14px', border:`1.5px solid ${f ? COLORS.primary : '#e5e7eb'}`, borderRadius:'10px', fontSize:'15px', outline:'none', background:'#fff', boxSizing:'border-box' })
const labelSt: React.CSSProperties = { fontSize:12, color:'#6B7280', marginBottom:4, display:'block' }

function SuccessScreen({ planName, planKey }: { planName: string; planKey: string }) {
  const router = useRouter()
  const [ativo, setAtivo] = useState(false)

  // A ativação vem pelo aviso do Asaas (alguns segundos): confere até o plano ficar ativo (~100 s)
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
    <div style={{ minHeight:'100vh', background:'#f7f0f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#E03673,#2F80D3)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <CheckCircle2 size={48} color="#fff" />
      </div>
      <div style={{ fontSize:22, fontWeight:700, color:COLORS.dark, marginBottom:8, textAlign:'center' }}>{ativo ? 'Assinatura ativada!' : 'Assinatura recebida!'}</div>
      <div style={{ fontSize:14, color:'#6b7280', maxWidth:320, textAlign:'center', lineHeight:1.6, marginBottom:24 }}>
        {ativo
          ? <>Seu plano <strong>{planName}</strong> foi ativado. Agora envie seus documentos para validar o perfil.</>
          : <>Estamos ativando o seu plano <strong>{planName}</strong>. Isso leva só alguns instantes; você também recebe uma notificação quando estiver pronto.</>}
      </div>
      <button onClick={() => router.push('/mobile/terapeuta-documentos')}
        style={{ background:'linear-gradient(135deg,#E03673,#c42d63)', color:'#fff', fontSize:15, fontWeight:600, border:'none', borderRadius:12, padding:'13px 32px', cursor:'pointer', marginBottom:10 }}>
        Enviar documentos
      </button>
      <button onClick={() => router.push('/mobile/dashboard')}
        style={{ background:'transparent', color:'#6b7280', fontSize:13, border:'none', cursor:'pointer', textDecoration:'underline' }}>
        Fazer depois
      </button>
    </div>
  )
}

function SubscriptionCheckoutContent() {
  const router = useRouter()
  const params = useSearchParams()
  const planId = (params.get('plan') || 'profissional') as string
  const plan = PLANS[planId] || PLANS.profissional
  const planKey = (PLANS[planId] ? planId : 'profissional') as string
  const PlanIcon = plan.icon
  const [garantiaDias, setGarantiaDias] = useState<number | null>(null)
  const precos = usePlanPrices()
  const preco = precos?.[planKey]
  useEffect(() => {
    const cap = (window as any).Capacitor
    if (cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios') return // iOS: compra pela App Store, sem garantia Asaas
    let ativo = true
    ;(async () => {
      try {
        const g: any = await api('/api/asaas/garantia', { silent: true } as any)
        if (ativo && g?.garantia_dias) setGarantiaDias(Number(g.garantia_dias))
      } catch {}
    })()
    return () => { ativo = false }
  }, [])

  // iOS nativo: redireciona para dash onde AppleSubscriptionCards cuida do IAP (Apple 3.1.1: sem preço/compra por fora)
  useEffect(() => {
    const cap = (window as any).Capacitor
    if (cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios') {
      router.replace('/mobile/dashboard')
    }
  }, [router])

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
  const [success, setSuccess] = useState(false)
  const [naoRepetir, setNaoRepetir] = useState(false)
  const [focused, setFocused] = useState('')

  const numeroRef = useRef<HTMLInputElement>(null)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)
  const [buscandoCep, setBuscandoCep] = useState(false)

  // Mesma lógica dos perfis: ao completar o CEP busca o endereço e preenche rua, bairro, cidade e UF (editáveis)
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

  const handleSubmit = useCallback(async () => {
    if (loading || naoRepetir || !preco) return
    if (!name.trim()) { setError('Informe o nome no cartão.'); return }
    if (name.trim().split(/\s+/).length < 2) { setError('Informe nome e sobrenome, como estão no cartão.'); return }
    if (cardNumber.replace(/\s/g, '').length < 13) { setError('Número do cartão inválido.'); return }
    if (expiry.length < 5) { setError('Validade inválida.'); return }
    if (cvv.length < 3) { setError('CVV inválido.'); return }
    if (!cpfValido(cpf)) { setError('CPF inválido. Confira os números.'); return }
    if (cep.replace(/\D/g, '').length !== 8) { setError('CEP inválido.'); return }
    if (rua.trim().length < 3) { setError('Informe a rua do endereço.'); return }
    if (!addrNumber.trim()) { setError('Informe o número do endereço (ou S/N).'); return }
    if (cidade.trim().length < 2) { setError('Informe a cidade.'); return }
    if (!/^[A-Za-z]{2}$/.test(uf.trim())) { setError('Informe o estado (UF).'); return }
    { const ph = phone.replace(/\D/g, ''); if (ph.length !== 11 || ph[2] !== '9') { setError('Celular inválido. Informe o DDD e o número com 9 dígitos, sem +55.'); return } }

    setLoading(true)
    setError(null)
    try {
      await api('/api/asaas/assinar', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'terapeuta',
          plano: planKey,
          cartao: { nome: name.trim(), numero: cardNumber.replace(/\s/g, ''), validade: expiry, ccv: cvv },
          titular: { cpf: cpf.replace(/\D/g, ''), cep: cep.replace(/\D/g, ''), rua: rua.trim(), numero: addrNumber.trim(), complemento: complemento.trim(), bairro: bairro.trim(), cidade: cidade.trim(), uf: uf.trim().toUpperCase(), celular: phone.replace(/\D/g, '') },
        }),
      })
      setCardNumber('')
      setCvv('')
      setSuccess(true)
    } catch (e: any) {
      // 504 (timeout do Asaas): NÃO repetir, o plano ativa sozinho se o pagamento tiver passado
      if ((e as any)?.status === 504) {
        setNaoRepetir(true)
        setError('O pagamento está sendo confirmado. Não tente de novo: se tiver passado, seu plano ativa sozinho em instantes.')
      } else {
        setError(e?.message || 'Não foi possível concluir a assinatura agora. Tente novamente em instantes.')
      }
    } finally {
      setLoading(false)
    }
  }, [loading, naoRepetir, name, cpf, cardNumber, expiry, cvv, cep, rua, addrNumber, complemento, bairro, cidade, uf, phone, planKey, preco])

  if (success) return <SuccessScreen planName={plan.name} planKey={planKey} />

  const f = (k: string) => ({ onFocus: () => setFocused(k), onBlur: () => setFocused(''), style: inputSt(focused === k) })

  return (
    <div style={{ minHeight:'100vh', background:'#f7f0f5', paddingBottom:100 }}>
      <div style={{ background:plan.color, padding:'16px 16px 20px' }}>
        <button onClick={()=>router.back()} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'6px 10px', color:'white', display:'flex', alignItems:'center', gap:6, marginBottom:12, cursor:'pointer' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color:'white', fontSize:20, fontWeight:600 }}>Assinar plano {plan.name}</div>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13 }}>Pagamento processado pelo Asaas • Recorrência mensal</div>
      </div>

      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
        {/* Resumo do plano */}
        <div style={{ background:'white', borderRadius:14, padding:16, border:'0.5px solid #E5E7EB' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:`${plan.color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <PlanIcon size={24} color={plan.color} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>Plano selecionado</div>
              <div style={{ fontSize:18, fontWeight:700, color:COLORS.dark }}>{plan.name}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:22, fontWeight:800, color:plan.color }}>{preco ? formatBRL(preco) : (precos === null ? 'R$ …' : 'R$ —')}</div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>/mês</div>
            </div>
          </div>
          <div style={{ background:'#F9FAFB', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#374151', marginBottom:10 }}>
            Comissão por sessão: <strong style={{ color:plan.color }}>{plan.commission}</strong>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {plan.features.map((ft:string, i:number) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151' }}>
                <CheckCircle2 size={13} color="#16a34a" /> {ft}
              </div>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div style={{ background:'white', borderRadius:14, padding:16, border:'0.5px solid #E5E7EB' }}>
          <div style={{ fontSize:15, fontWeight:600, color:COLORS.dark, marginBottom:4 }}>Dados do cartão</div>
          <div style={{ fontSize:13, color:'#9CA3AF', marginBottom:16 }}>Recorrência mensal automática</div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {!!garantiaDias && (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:14, color:'#166534', fontWeight:600 }}>
                  <ShieldCheck size={16} style={{ verticalAlign:'-3px', marginRight:6 }} />Garantia de {garantiaDias} dias
                </div>
                <div style={{ fontSize:12, color:'#166534', marginTop:4, lineHeight:1.5 }}>
                  Seu dinheiro de volta sem perguntas até {garantiaDias} dias após a compra. Você pede em Meu plano, com um clique.
                </div>
              </div>
            )}

            <div><label style={labelSt}>Nome no cartão</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Como aparece no cartão" autoComplete="cc-name" {...f('name')} /></div>
            <div><label style={labelSt}>CPF do titular</label>
              <input value={cpf} onChange={e=>setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" {...f('cpf')} /></div>
            <div><label style={labelSt}>Número do cartão</label>
              <input value={cardNumber} onChange={e=>setCardNumber(maskCard(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" autoComplete="cc-number" {...f('card')} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={labelSt}>Validade</label>
                <input value={expiry} onChange={e=>setExpiry(maskExpiry(e.target.value))} placeholder="MM/AA" inputMode="numeric" autoComplete="cc-exp" {...f('exp')} /></div>
              <div><label style={labelSt}>CVV</label>
                <input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="000" type="password" inputMode="numeric" autoComplete="cc-csc" {...f('cvv')} /></div>
            </div>

            <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginTop:4 }}>Endereço do titular do cartão</div>
            <div><label style={labelSt}>CEP *</label>
              <input value={cep} onChange={e=>setCep(maskCep(e.target.value))} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" {...f('cep')} />
              {(buscandoCep || avisoCep) && (
                <div style={{ fontSize:12, marginTop:6, color: avisoCep ? '#b45309' : '#6b7280' }}>{buscandoCep ? 'Buscando endereço…' : avisoCep}</div>
              )}
            </div>
            <div><label style={labelSt}>Rua *</label>
              <input value={rua} onChange={e=>setRua(e.target.value)} autoComplete="address-line1" {...f('rua')} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={labelSt}>Número *</label>
                <input ref={numeroRef} value={addrNumber} onChange={e=>setAddrNumber(e.target.value.slice(0,10))} placeholder="123 ou S/N" {...f('num')} /></div>
              <div><label style={labelSt}>Complemento</label>
                <input value={complemento} onChange={e=>setComplemento(e.target.value.slice(0,60))} placeholder="Apto, bloco, sala" autoComplete="address-line2" {...f('comp')} /></div>
            </div>
            <div><label style={labelSt}>Bairro</label>
              <input value={bairro} onChange={e=>setBairro(e.target.value)} {...f('bairro')} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px', gap:10 }}>
              <div><label style={labelSt}>Cidade *</label>
                <input value={cidade} onChange={e=>setCidade(e.target.value)} autoComplete="address-level2" {...f('cidade')} /></div>
              <div><label style={labelSt}>UF *</label>
                <input value={uf} onChange={e=>setUf(e.target.value.replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,2))} maxLength={2} placeholder="MG" autoComplete="address-level1" {...f('uf')} /></div>
            </div>
            <div><label style={labelSt}>Celular do titular</label>
              <input value={phone} onChange={e=>setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" {...f('phone')} />
              <div style={{ fontSize:12, color:'#9CA3AF', marginTop:6 }}>O endereço e o celular do titular são exigidos pelo Asaas para liberar a cobrança no cartão. No celular, informe só o DDD e o número, sem +55.</div>
            </div>

            {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 12px' }}>{error}</div>}

            <button onClick={handleSubmit} disabled={loading||naoRepetir||!preco}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:16, background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`, color:'#fff', fontSize:16, fontWeight:700, border:'none', borderRadius:12, cursor:loading||naoRepetir||!preco?'not-allowed':'pointer', opacity:loading||naoRepetir||!preco?0.6:1 }}>
              {loading ? <><Loader2 size={18} className="animate-spin" /> Processando…</> : (preco ? `Assinar por ${formatBRL(preco)}/mês` : (precos === null ? 'Carregando preço…' : 'Preço indisponível no momento'))}
            </button>

            <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:12, padding:'10px 14px' }}>
              <Shield size={16} color="#2F80D3" style={{ flexShrink:0, marginTop:1 }} />
              <span style={{ fontSize:12, color:'#1d4ed8' }}>Cancele quando quiser, sem perder acesso à plataforma.</span>
            </div>

            <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              {['Asaas','Conexão segura','Não guardamos seu cartão'].map(b=><span key={b} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'#f3f4f6', color:'#6b7280' }}>{b}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MobileSubscriptionCheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#f7f0f5', display:'flex', alignItems:'center', justifyContent:'center' }}><Loader2 size={32} className="animate-spin" color="#E03673" /></div>}>
      <SubscriptionCheckoutContent />
    </Suspense>
  )
}
