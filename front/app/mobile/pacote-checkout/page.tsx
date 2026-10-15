'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, Shield, Package, ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'
import { ApplePackageCards } from '@/components/mobile/ApplePackageCards'

const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-6dd38a4a-5036-4838-8104-92314dc8414a'
const COLOR = '#E03673'
const COLORS = { primary: "#E03673", secondary: "#2F80D3", dark: "#3A3B21" }
const BLOCK_MINUTES = 3
const BLOCK_KEY = 'mp_sub_block_until'

interface Plan { chave: string; nome: string; preco_mensal: number; sessoes_mensais: number }

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const maskCard = (v: string) => v.replace(/\D/g,'').replace(/(\d{4})/g,'$1 ').trim().slice(0,19)
const maskExpiry = (v: string) => { const d=v.replace(/\D/g,'').slice(0,4); return d.length>=3?`${d.slice(0,2)}/${d.slice(2)}`:d }
const maskCpf = (v: string) => { const d=v.replace(/\D/g,'').slice(0,11); if(d.length<=3)return d; if(d.length<=6)return `${d.slice(0,3)}.${d.slice(3)}`; if(d.length<=9)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`; return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` }
function cpfValido(raw: string): boolean {
  const d=raw.replace(/\D/g,''); if(d.length!==11||/^(\d)\1{10}$/.test(d))return false
  const dv=(len:number)=>{let s=0;for(let i=0;i<len;i++)s+=Number(d[i])*(len+1-i);const r=(s*10)%11;return r===10?0:r}
  return dv(9)===Number(d[9])&&dv(10)===Number(d[10])
}

let mpInstance: any = null
async function loadMp(key: string) {
  if(mpInstance)return mpInstance
  return new Promise((resolve,reject)=>{
    if((window as any).MercadoPago){mpInstance=new (window as any).MercadoPago(key,{locale:'pt-BR'});return resolve(mpInstance)}
    const s=document.createElement('script');s.src='https://sdk.mercadopago.com/js/v2'
    s.onload=()=>{mpInstance=new (window as any).MercadoPago(key,{locale:'pt-BR'});resolve(mpInstance)}
    s.onerror=()=>reject(new Error('Falha ao carregar SDK'));document.head.appendChild(s)
  })
}

const inputSt=(f?:boolean):React.CSSProperties=>({width:'100%',padding:'12px 14px',border:`1.5px solid ${f?COLOR:'#e5e7eb'}`,borderRadius:'10px',fontSize:'15px',outline:'none',background:'#fff',boxSizing:'border-box'})

function SuccessScreen({ plan }: { plan: Plan }) {
  const router = useRouter()
  const [remaining, setRemaining] = useState<number|null>(null)

  useEffect(() => {
    let tries=0, stop=false
    const tick = async () => {
      tries++
      try {
        const me: any = await api('/api/patient/pacotes/me', {silent:true} as any)
        if(stop)return
        if((me?.sessions_remaining||0)>0){setRemaining(me.sessions_remaining);return}
      } catch {}
      if(!stop&&tries<8)setTimeout(tick,2500)
    }
    tick()
    return ()=>{stop=true}
  }, [])

  return (
    <div style={{ minHeight:'100vh', background:'#f7f0f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#E03673,#2F80D3)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20 }}>
        <CheckCircle2 size={48} color="#fff" />
      </div>
      <div style={{ fontSize:22, fontWeight:700, color:COLORS.dark, marginBottom:8, textAlign:'center' }}>Pacote contratado!</div>
      <div style={{ fontSize:14, color:'#6b7280', maxWidth:320, textAlign:'center', lineHeight:1.6, marginBottom:24 }}>
        {remaining!==null
          ? <><strong>{plan.nome}</strong> ativo. Você já tem <strong>{remaining} {remaining===1?'sessão':'sessões'}</strong> disponíveis.</>
          : <>Recebemos sua assinatura do <strong>{plan.nome}</strong>. Suas sessões aparecem em instantes.</>}
      </div>
      <button onClick={()=>router.push('/mobile/busca')}
        style={{ background:'linear-gradient(135deg,#E03673,#c42d63)', color:'#fff', fontSize:15, fontWeight:600, border:'none', borderRadius:12, padding:'13px 32px', cursor:'pointer', marginBottom:10 }}>
        Agendar uma sessão
      </button>
      <button onClick={()=>router.push('/mobile/meus-pacotes')}
        style={{ background:'transparent', color:'#6b7280', fontSize:13, border:'none', cursor:'pointer', textDecoration:'underline' }}>
        Ver meu pacote
      </button>
    </div>
  )
}

function PacoteCheckoutContent() {
  const router = useRouter()
  const params = useSearchParams()
  const planKey = (params.get('plan')||'').toLowerCase()

  const [plan, setPlan] = useState<Plan|null>(null)
  const [planError, setPlanError] = useState<string|null>(null)
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [info, setInfo] = useState<string|null>(null)
  const [success, setSuccess] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<number>(0)
  const [nowTs, setNowTs] = useState<number>(Date.now())
  const [focused, setFocused] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const blocked = blockedUntil > nowTs

  useEffect(() => {
    const cap = (window as any).Capacitor
    if (cap?.isNativePlatform?.() && cap?.getPlatform?.() === 'ios') setIsIOS(true)
    let active = true
    ;(async () => {
      try {
        const p: any = await api('/api/patient/pacotes/plans', {silent:true} as any)
        if(!active)return
        if(!p?.visible){setPlanError('Os pacotes de sessões ainda não estão disponíveis.');return}
        const found = (p.plans||[]).find((x:Plan)=>x.chave===planKey)
        if(!found)setPlanError('Pacote não encontrado ou indisponível.')
        else setPlan(found)
      } catch { if(active)setPlanError('Não foi possível carregar o pacote.') }
      finally { if(active)setLoadingPlan(false) }
    })()
    return ()=>{active=false}
  }, [planKey])

  useEffect(() => {
    try { const s=Number(localStorage.getItem(BLOCK_KEY)||0); if(s>Date.now()){setBlockedUntil(s);setError(`Aguarde ${Math.ceil((s-Date.now())/60000)} min antes de tentar novamente.`)} } catch {}
    api('/api/users/me').then((me:any)=>setUserEmail(me.email||'')).catch(()=>{})
    if(!document.getElementById('mp-sec2')){ const s=document.createElement('script');s.id='mp-sec2';s.src='https://www.mercadopago.com/v2/security.js';s.setAttribute('view','checkout');document.head.appendChild(s) }
  }, [])

  useEffect(() => {
    if(blockedUntil<=Date.now())return
    const t=setInterval(()=>{const n=Date.now();setNowTs(n);if(n>=blockedUntil){clearInterval(t);setError(null)}},1000)
    return ()=>clearInterval(t)
  }, [blockedUntil])

  const bloquear = () => { const u=Date.now()+BLOCK_MINUTES*60000; setBlockedUntil(u); try{localStorage.setItem(BLOCK_KEY,String(u))}catch{} }

  const handleSubmit = useCallback(async () => {
    if(blocked||!plan)return
    if(!name.trim()){setError('Informe o nome no cartão.');return}
    if(!cpfValido(cpf)){setError('CPF inválido.');return}
    if(cardNumber.replace(/\s/g,'').length<16){setError('Número do cartão inválido.');return}
    if(expiry.length<5){setError('Validade inválida.');return}
    if(cvv.length<3){setError('CVV inválido.');return}
    setLoading(true); setError(null); setInfo(null)
    let chamou = false
    try {
      const mp = await loadMp(MP_PUBLIC_KEY)
      const [em,ey] = expiry.split('/')
      const token = await (mp as any).createCardToken({ cardNumber:cardNumber.replace(/\s/g,''), cardholderName:name, cardExpirationMonth:em, cardExpirationYear:`20${ey}`, securityCode:cvv })
      if(!token||token.error)throw new Error(token?.error?.message||'Erro ao tokenizar cartão.')
      chamou = true
      const result = await api('/api/patient/pacotes/subscribe', { method:'POST', body:JSON.stringify({ plan_key:plan.chave, card_token_id:token.id, payer_email:userEmail, payer_cpf:cpf.replace(/\D/g,''), device_id:(window as any).MP_DEVICE_SESSION_ID||'' }) })
      if(result.status==='authorized'||result.status==='active') setSuccess(true)
      else { setError(`${result.detail||'Assinatura não aprovada.'} Aguarde ${BLOCK_MINUTES} min antes de tentar novamente.`); bloquear() }
    } catch(e:any) {
      const msg=e.message||'Erro ao processar.'
      if(chamou){ setError(`${msg} Aguarde ${BLOCK_MINUTES} min antes de tentar novamente.`); bloquear() }
      else setError(msg)
    } finally { setLoading(false) }
  }, [plan, name, cpf, cardNumber, expiry, cvv, userEmail, blocked])

  if(isIOS) return (
    <div style={{ minHeight:'100vh', background:'#f7f0f5', paddingBottom:100 }}>
      <div style={{ background:COLOR, padding:'16px 16px 20px' }}>
        <button onClick={()=>router.back()} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'6px 10px', color:'white', display:'flex', alignItems:'center', gap:6, marginBottom:12, cursor:'pointer' }}>
          ← Voltar
        </button>
        <div style={{ color:'white', fontSize:20, fontWeight:600 }}>Pacotes No Divã</div>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13 }}>Contrate via App Store</div>
      </div>
      <div style={{ padding:16 }}>
        <ApplePackageCards />
      </div>
    </div>
  )

  if(loadingPlan) return <div style={{ minHeight:'100vh', background:'#f7f0f5', display:'flex', alignItems:'center', justifyContent:'center' }}><Loader2 size={32} className="animate-spin" color={COLOR} /></div>

  if(planError||!plan) return (
    <div style={{ minHeight:'100vh', background:'#f7f0f5', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'white', borderRadius:16, padding:24, textAlign:'center', maxWidth:360, width:'100%' }}>
        <div style={{ fontSize:14, color:'#374151', marginBottom:16 }}>{planError||'Pacote indisponível.'}</div>
        <button onClick={()=>router.push('/mobile/meus-pacotes')} style={{ padding:'10px 24px', background:COLOR, color:'#fff', border:'none', borderRadius:10, fontWeight:600, cursor:'pointer' }}>Voltar</button>
      </div>
    </div>
  )

  if(success) return <SuccessScreen plan={plan} />

  return (
    <div style={{ minHeight:'100vh', background:'#f7f0f5', paddingBottom:100 }}>
      <div style={{ background:COLOR, padding:'16px 16px 20px' }}>
        <button onClick={()=>router.back()} style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:8, padding:'6px 10px', color:'white', display:'flex', alignItems:'center', gap:6, marginBottom:12, cursor:'pointer' }}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <div style={{ color:'white', fontSize:20, fontWeight:600 }}>Contratar {plan.nome}</div>
        <div style={{ color:'rgba(255,255,255,0.8)', fontSize:13 }}>Pagamento seguro via Mercado Pago</div>
      </div>

      <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
        {/* Resumo */}
        <div style={{ background:'white', borderRadius:14, padding:16, border:'0.5px solid #E5E7EB' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:48, height:48, borderRadius:12, background:`${COLOR}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Package size={24} color={COLOR} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>Pacote selecionado</div>
              <div style={{ fontSize:18, fontWeight:700, color:COLORS.dark }}>{plan.nome}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:22, fontWeight:800, color:COLOR }}>{fmtCurrency(plan.preco_mensal)}</div>
              <div style={{ fontSize:11, color:'#9CA3AF' }}>/mês</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:2 }}>Sessões/mês</div>
              <div style={{ fontSize:20, fontWeight:700, color:COLORS.dark }}>{plan.sessoes_mensais}</div>
            </div>
            <div style={{ background:'#F9FAFB', borderRadius:10, padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:2 }}>Por sessão</div>
              <div style={{ fontSize:16, fontWeight:700, color:COLORS.dark }}>{fmtCurrency(plan.preco_mensal/plan.sessoes_mensais)}</div>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {['Sessões por videochamada','Renovação mensal automática','As sessões valem dentro do mês vigente','Cancele quando quiser'].map((f,i)=>(
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#374151' }}>
                <CheckCircle2 size={13} color="#16a34a" /> {f}
              </div>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <div style={{ background:'white', borderRadius:14, padding:16, border:'0.5px solid #E5E7EB' }}>
          <div style={{ fontSize:15, fontWeight:600, color:COLORS.dark, marginBottom:4 }}>Dados do cartão</div>
          <div style={{ fontSize:13, color:'#9CA3AF', marginBottom:16 }}>Recorrência mensal automática</div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div><label style={{ fontSize:12, color:'#6B7280', marginBottom:4, display:'block' }}>Nome no cartão</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Como aparece no cartão" onFocus={()=>setFocused('name')} onBlur={()=>setFocused('')} style={inputSt(focused==='name')} /></div>
            <div><label style={{ fontSize:12, color:'#6B7280', marginBottom:4, display:'block' }}>CPF do titular</label>
              <input value={cpf} onChange={e=>setCpf(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" onFocus={()=>setFocused('cpf')} onBlur={()=>setFocused('')} style={inputSt(focused==='cpf')} /></div>
            <div><label style={{ fontSize:12, color:'#6B7280', marginBottom:4, display:'block' }}>Número do cartão</label>
              <input value={cardNumber} onChange={e=>setCardNumber(maskCard(e.target.value))} placeholder="0000 0000 0000 0000" inputMode="numeric" onFocus={()=>setFocused('card')} onBlur={()=>setFocused('')} style={inputSt(focused==='card')} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={{ fontSize:12, color:'#6B7280', marginBottom:4, display:'block' }}>Validade</label>
                <input value={expiry} onChange={e=>setExpiry(maskExpiry(e.target.value))} placeholder="MM/AA" inputMode="numeric" onFocus={()=>setFocused('exp')} onBlur={()=>setFocused('')} style={inputSt(focused==='exp')} /></div>
              <div><label style={{ fontSize:12, color:'#6B7280', marginBottom:4, display:'block' }}>CVV</label>
                <input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="000" type="password" inputMode="numeric" onFocus={()=>setFocused('cvv')} onBlur={()=>setFocused('')} style={inputSt(focused==='cvv')} /></div>
            </div>

            {error && <div style={{ fontSize:13, color:'#dc2626', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 12px' }}>{error}</div>}
            {info && <div style={{ fontSize:13, color:'#1d4ed8', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:8, padding:'10px 12px' }}>{info}</div>}

            <button onClick={handleSubmit} disabled={loading||blocked}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, width:'100%', padding:16, background:`linear-gradient(135deg,${COLOR},${COLOR}cc)`, color:'#fff', fontSize:16, fontWeight:700, border:'none', borderRadius:12, cursor:loading||blocked?'not-allowed':'pointer', opacity:loading||blocked?0.6:1 }}>
              {loading?<><Loader2 size={18} className="animate-spin" /> Processando…</>:`Assinar por ${fmtCurrency(plan.preco_mensal)}/mês`}
            </button>

            <div style={{ display:'flex', alignItems:'flex-start', gap:8, background:'#eff6ff', border:'1.5px solid #bfdbfe', borderRadius:12, padding:'10px 14px' }}>
              <Shield size={16} color="#2F80D3" style={{ flexShrink:0, marginTop:1 }} />
              <span style={{ fontSize:12, color:'#1d4ed8' }}>Ao cancelar, não há novas cobranças, e as sessões já pagas valem até o fim do período.</span>
            </div>

            <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
              {['Mercado Pago','SSL 256-bit','PCI DSS'].map(b=><span key={b} style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'#f3f4f6', color:'#6b7280' }}>{b}</span>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MobilePacoteCheckoutPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#f7f0f5', display:'flex', alignItems:'center', justifyContent:'center' }}><Loader2 size={32} className="animate-spin" color={COLOR} /></div>}>
      <PacoteCheckoutContent />
    </Suspense>
  )
}
