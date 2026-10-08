'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Shield, Star, Crown, Check, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const HELP_EMAIL = 'contato@meudivaonline.com'

// 🔥 Nota de degustação do Essencial. O plano no Mercado Pago tem 7 dias grátis
// (primeira cobrança no 8º dia). Se o checkout não aplicar o teste, troque para false.
const SHOW_TRIAL_NOTE = true

type PlanId = 'essencial' | 'profissional' | 'premium'
const ORDER: PlanId[] = ['essencial', 'profissional', 'premium']

type Base = {
  name: string
  tagline: string
  icon: 'shield' | 'star' | 'crown'
  accent: string
  commission: string
  price: number
  features: string[]
  extra: string[]
}

// Valores de reserva, usados só se a API de planos não responder.
const BASE: Record<PlanId, Base> = {
  essencial: {
    name: 'Essencial', tagline: 'Para começar na plataforma', icon: 'shield', accent: '#6b7280',
    commission: '20%', price: 19.9,
    features: ['Até 10 pacientes ativos', 'Agendamento básico', 'Prontuário digital', 'Visibilidade no marketplace', 'Relatórios financeiros'],
    extra: [],
  },
  profissional: {
    name: 'Profissional', tagline: 'Para crescer com consistência', icon: 'star', accent: '#2F80D3',
    commission: '10%', price: 79,
    features: ['Até 50 pacientes ativos', 'Relatórios financeiros', 'Estatísticas avançadas', 'Suporte por chat'],
    extra: ['Mais destaque no marketplace'],
  },
  premium: {
    name: 'Premium', tagline: 'Para escalar sua prática clínica', icon: 'crown', accent: '#E03673',
    commission: '3%', price: 149,
    features: ['Pacientes ilimitados', 'Relatórios completos', 'Estatísticas avançadas', 'Suporte prioritário'],
    extra: ['Destaque máximo no marketplace'],
  },
}

function PlanIcon({ kind }: { kind: 'shield' | 'star' | 'crown' }) {
  if (kind === 'crown') return <Crown className="w-5 h-5" />
  if (kind === 'star') return <Star className="w-5 h-5" />
  return <Shield className="w-5 h-5" />
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function AdesaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enforce, setEnforce] = useState(false)
  const [plans, setPlans] = useState<Record<string, { price: number; features: string[] }>>({})

  useEffect(() => {
    let active = true
    const preview = new URLSearchParams(window.location.search).get('preview') === '1'

    ;(async () => {
      try {
        const st: any = await api('/api/therapist/onboarding/status')
        if (!active) return
        if (!st?.needs_plan && !preview) {
          router.replace('/therapist/dashboard')
          return
        }
        setEnforce(!!st?.enforce)
      } catch (e: any) {
        if (!active) return
        setError('Não foi possível carregar a página. Entre na sua conta e tente de novo.')
        setLoading(false)
        return
      }

      try {
        const r = await fetch(`${BACKEND_URL}/api/plans/`)
        if (r.ok) {
          const d = await r.json()
          const map: Record<string, { price: number; features: string[] }> = {}
          ;(d.plans || []).forEach((p: any) => {
            map[p.id] = { price: Number(p.price_brl), features: Array.isArray(p.features) ? p.features : [] }
          })
          if (active) setPlans(map)
        }
      } catch {}

      if (active) setLoading(false)
    })()

    return () => { active = false }
  }, [router])

  const mailto = `mailto:${HELP_EMAIL}?subject=${encodeURIComponent('Ajuda com meu plano')}`

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#111318] via-[#181b22] to-[#14161c] relative overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#2F80D3]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 w-[32rem] h-[32rem] rounded-full bg-[#E03673]/25 blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Image src="/jitsi-watermark.png" alt="Meu Divã" width={64} height={64} className="w-16 h-16 object-contain" priority />
          <span className="text-white font-semibold text-xl">Meu Divã</span>
        </div>

        {loading && !error && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
          </div>
        )}

        {error && (
          <div className="max-w-md mx-auto bg-white rounded-2xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-gray-700 mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-lg bg-[#E03673] text-white text-sm font-medium">
                Tentar de novo
              </button>
              <a href="/auth/login" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium">
                Entrar
              </a>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Escolha seu plano para começar</h1>
              <p className="text-white/70 max-w-2xl mx-auto">
                Sua conta foi criada. Falta escolher o plano para começar a atender. Você pode trocar de plano depois.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
              {ORDER.map((id) => {
                const b = BASE[id]
                const api_ = plans[id]
                const price = api_ && api_.price > 0 ? api_.price : b.price
                const apiFeatures = (api_?.features || []).map((f) => f.replace(/^✓\s*/, '')).filter(Boolean)
                const feats = [...(apiFeatures.length ? apiFeatures : b.features), ...b.extra]

                return (
                  <div key={id} className="bg-white rounded-2xl shadow-xl p-6 flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: b.accent }}>
                        <PlanIcon kind={b.icon} />
                      </div>
                      <div>
                        <h2 className="font-bold text-gray-900">{b.name}</h2>
                        <p className="text-xs text-gray-500">{b.tagline}</p>
                      </div>
                    </div>

                    <p className="text-3xl font-extrabold text-gray-900">
                      R$ {brl(price)}
                      <span className="text-sm font-normal text-gray-400">/mês</span>
                    </p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">
                      Comissão por sessão: <strong className="text-gray-800">{b.commission}</strong>
                    </p>

                    {id === 'essencial' && SHOW_TRIAL_NOTE && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 mb-4 leading-relaxed">
                        7 dias para experimentar: a primeira mensalidade só é cobrada a partir do 8º dia, e você pode cancelar antes. Cartão necessário para iniciar.
                      </p>
                    )}

                    <ul className="space-y-2 mb-6 flex-1">
                      {feats.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: b.accent }} />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => router.push(`/subscription-checkout?plan=${id}`)}
                      className="w-full py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
                      style={{ backgroundColor: b.accent }}
                    >
                      Escolher {b.name}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="text-center space-y-3">
              {enforce ? (
                <p className="text-white/60 text-sm">Para acessar a plataforma, escolha um plano.</p>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/therapist/dashboard')}
                    className="px-5 py-2.5 rounded-xl border border-white/30 text-white/90 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Fazer depois
                  </button>
                  <p className="text-white/50 text-xs">Você poderá escolher seu plano depois, em Minha assinatura.</p>
                </>
              )}
              <p className="text-white/50 text-xs">
                Precisa de ajuda ou não conseguiu concluir o pagamento?{' '}
                <a href={mailto} className="text-[#ff8bb3] underline">Fale com a gente</a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
