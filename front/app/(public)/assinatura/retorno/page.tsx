'use client'
// asaas-checkout-page v1: para onde o Asaas devolve o cliente depois do pagamento (sucesso, cancelado ou expirado).
// A confirmação NUNCA vem desta URL: ela só controla o redirecionamento. Aqui apenas conferimos, em segundo plano, quando o plano/pacote realmente ficou ativo.

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { api } from '@/lib/api'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/layout/PublicFooter'

type Fase = 'verificando' | 'ativo' | 'demora' | 'cancelado' | 'expirado' | 'erro'

const PAGE: React.CSSProperties = { minHeight: '100vh', background: '#f9f7f8', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }
const BOX: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px 20px', textAlign: 'center' }
const BTN: React.CSSProperties = { marginTop: '8px', padding: '13px 32px', background: 'linear-gradient(135deg, #E03673, #c42d63)', color: '#fff', fontSize: '15px', fontWeight: 600, border: 'none', borderRadius: '10px', cursor: 'pointer' }
const LINK: React.CSSProperties = { marginTop: '4px', padding: '8px 16px', background: 'transparent', color: '#6b7280', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', textDecoration: 'underline' }

function RetornoContent() {
  const router = useRouter()
  const params = useSearchParams()
  const pedido = params.get('c') || ''
  const resultado = (params.get('r') || 'sucesso').toLowerCase()

  const [fase, setFase] = useState<Fase>(resultado === 'cancelado' ? 'cancelado' : resultado === 'expirado' ? 'expirado' : 'verificando')
  const [tipo, setTipo] = useState<string>('')
  const [sessoes, setSessoes] = useState<number | null>(null)

  useEffect(() => {
    if (fase !== 'verificando') return
    let parar = false
    ;(async () => {
      let info: any = null
      try {
        info = await api(`/api/asaas/checkout/${encodeURIComponent(pedido)}/status`, { silent: true } as any)
      } catch {
        if (!parar) setFase('erro')
        return
      }
      if (parar) return
      setTipo(info?.tipo || '')
      for (let i = 0; i < 60 && !parar; i++) {
        try {
          if (info?.tipo === 'paciente') {
            const me: any = await api('/api/patient/pacotes/me', { silent: true } as any)
            if ((me?.sessions_remaining || 0) > 0) { setSessoes(me.sessions_remaining); setFase('ativo'); return }
          } else {
            const r: any = await api('/api/payments/therapist/subscription', { silent: true } as any)
            const s = r?.subscription
            if (s?.plan === info?.plano && s?.status === 'active') { setFase('ativo'); return }
          }
        } catch {}
        await new Promise(res => setTimeout(res, 3000))
      }
      if (!parar) setFase('demora')
    })()
    return () => { parar = true }
  }, [fase, pedido])

  const irPlanos = () => router.push(tipo === 'paciente' ? '/pacotes' : '/therapist/subscription')

  let conteudo: React.ReactNode
  if (fase === 'verificando') conteudo = (
    <div style={BOX}>
      <Loader2 size={40} style={{ color: '#E03673' }} className="animate-spin" />
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Confirmando seu pagamento…</h1>
      <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '360px', margin: 0, lineHeight: 1.6 }}>Isso leva só alguns segundos. Não feche esta página.</p>
    </div>
  )
  else if (fase === 'ativo') conteudo = tipo === 'paciente' ? (
    <div style={BOX}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #E03673, #2F80D3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={48} color="#fff" /></div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Pacote contratado!</h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '380px', margin: 0, lineHeight: 1.6 }}>
        Seu pacote está ativo e você já tem <strong>{sessoes} {sessoes === 1 ? 'sessão' : 'sessões'}</strong> disponíveis.
      </p>
      <button onClick={() => router.push('/busca')} style={BTN}>Agendar uma sessão</button>
      <button onClick={() => router.push('/patient/pacotes')} style={LINK}>Ver meu pacote</button>
    </div>
  ) : (
    <div style={BOX}>
      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #E03673, #2F80D3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={48} color="#fff" /></div>
      <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Assinatura ativada!</h1>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '360px', margin: 0, lineHeight: 1.6 }}>
        Seu plano foi ativado com sucesso. Falta só um passo: enviar seus documentos para validar o perfil e ganhar o selo de terapeuta verificado.
      </p>
      <button onClick={() => router.push('/therapist/documents/required')} style={BTN}>Enviar documentos</button>
      <button onClick={() => router.push('/therapist/dashboard')} style={LINK}>Fazer depois</button>
    </div>
  )
  else if (fase === 'demora') conteudo = (
    <div style={BOX}>
      <Clock size={48} color="#2F80D3" />
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Estamos confirmando o seu pagamento</h1>
      <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>
        A confirmação está demorando um pouco mais que o normal. Você não será cobrado em dobro. Assim que o pagamento for confirmado, seu {tipo === 'paciente' ? 'pacote' : 'plano'} é ativado e você recebe uma notificação. Se em uma hora nada mudar, fale com a gente.
      </p>
      <button onClick={() => router.push(tipo === 'paciente' ? '/patient/pacotes' : '/therapist/subscription')} style={BTN}>{tipo === 'paciente' ? 'Ver meu pacote' : 'Ver meu plano'}</button>
    </div>
  )
  else if (fase === 'cancelado' || fase === 'expirado') conteudo = (
    <div style={BOX}>
      <XCircle size={48} color="#9ca3af" />
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>{fase === 'cancelado' ? 'Pagamento cancelado' : 'O tempo para pagar acabou'}</h1>
      <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '380px', margin: 0, lineHeight: 1.6 }}>Nada foi cobrado. Quando quiser, é só começar de novo.</p>
      <button onClick={irPlanos} style={BTN}>Voltar e tentar de novo</button>
    </div>
  )
  else conteudo = (
    <div style={BOX}>
      <XCircle size={48} color="#dc2626" />
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Não conseguimos conferir o pedido</h1>
      <p style={{ fontSize: '14px', color: '#6b7280', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>Entre na sua conta e veja em “Meu plano” ou “Meu pacote” se o pagamento já foi confirmado. Se tiver dúvida, fale com a gente.</p>
      <button onClick={() => router.push('/auth/login')} style={BTN}>Entrar na minha conta</button>
    </div>
  )

  return (
    <main style={PAGE}>
      <PublicHeader />
      {conteudo}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');`}</style>
      <PublicFooter />
    </main>
  )
}

export default function RetornoPage() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: '100vh', background: '#f9f7f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} style={{ color: '#E03673' }} className="animate-spin" />
      </main>
    }>
      <RetornoContent />
    </Suspense>
  )
}
