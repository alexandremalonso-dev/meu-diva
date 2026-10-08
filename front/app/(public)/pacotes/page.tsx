'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Loader2, Check, AlertCircle, Package } from 'lucide-react'
import { api } from '@/lib/api'

const HELP_EMAIL = 'contato@meudivaonline.com'

interface Plan {
  chave: string
  nome: string
  preco_mensal: number
  sessoes_mensais: number
  descricao?: string | null
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PacotesAdesaoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [hasPackage, setHasPackage] = useState(false)
  const [welcome, setWelcome] = useState(false)

  useEffect(() => {
    // /pacotes?novo=1: paciente que acabou de confirmar o e-mail (a escolha do pacote é opcional)
    setWelcome(new URLSearchParams(window.location.search).get('novo') === '1')
    let active = true
    ;(async () => {
      try {
        const [p, m]: any[] = await Promise.all([
          api('/api/patient/pacotes/plans', { silent: true } as any),
          api('/api/patient/pacotes/me', { silent: true } as any),
        ])
        if (!active) return
        setVisible(!!p?.visible)
        setPlans(Array.isArray(p?.plans) ? p.plans : [])
        setHasPackage(!!m?.subscription?.can_cancel)
      } catch {
        if (!active) return
        setError('Não foi possível carregar os pacotes. Entre na sua conta de paciente e tente de novo.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const mailto = `mailto:${HELP_EMAIL}?subject=${encodeURIComponent('Dúvida sobre os pacotes de sessões')}`

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#111318] via-[#181b22] to-[#14161c] relative overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-[#2F80D3]/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 w-[32rem] h-[32rem] rounded-full bg-[#E03673]/25 blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Image src="/jitsi-watermark.png" alt="Meu Divã" width={64} height={64} className="w-16 h-16 object-contain" priority />
          <span className="text-white font-semibold text-xl">Meu Divã</span>
        </div>

        {loading && (
          <div className="flex justify-center py-24">
            <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="max-w-md mx-auto bg-white rounded-2xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-gray-700 mb-4">{error}</p>
            <a href="/auth/login" className="inline-block px-4 py-2 rounded-lg bg-[#E03673] text-white text-sm font-medium">Entrar</a>
          </div>
        )}

        {!loading && !error && !visible && (
          <div className="max-w-md mx-auto bg-white rounded-2xl p-6 text-center">
            <Package className="w-8 h-8 text-[#E03673] mx-auto mb-3" />
            <p className="text-gray-800 font-semibold mb-1">Os pacotes de sessões chegam em breve.</p>
            <p className="text-gray-500 text-sm mb-4">Por enquanto, você pode agendar sessões avulsas direto com os terapeutas.</p>
            <a href="/busca" className="inline-block px-4 py-2 rounded-lg bg-[#E03673] text-white text-sm font-medium">Buscar terapeutas</a>
          </div>
        )}

        {!loading && !error && visible && (
          <>
            {welcome && (
              <div className="max-w-2xl mx-auto mb-8 p-5 rounded-2xl bg-white/10 border border-white/20 text-center">
                <p className="text-2xl font-bold text-white mb-2">Bem-vindo(a) ao Meu Divã!</p>
                <p className="text-white/80 text-sm leading-relaxed">
                  Seu e-mail foi confirmado e sua conta está pronta. Quer já começar com um pacote de sessões?
                  A terapia funciona melhor com regularidade, e o pacote ajuda a manter o ritmo: a assinatura renova sozinha todo mês e você cancela quando quiser.
                  É opcional: se preferir, escolha um terapeuta e agende sessões avulsas.
                </p>
                <button
                  onClick={() => router.push('/patient/dashboard')}
                  className="mt-4 px-5 py-2 rounded-lg border border-white/40 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Fazer depois e ir para o meu painel
                </button>
              </div>
            )}

            <div className="text-center mb-10">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pacotes de sessões No Divã</h1>
              <p className="text-white/70 max-w-2xl mx-auto">
                Escolha quantas sessões de terapia online quer por mês. A assinatura renova todo mês e você pode cancelar quando quiser.
              </p>
            </div>

            {hasPackage && (
              <div className="max-w-xl mx-auto mb-6 p-3 rounded-xl bg-white/10 border border-white/20 text-white/90 text-sm text-center">
                Você já tem um pacote ativo. Para contratar outro, cancele o atual em{' '}
                <a href="/patient/pacotes" className="underline">Meus pacotes</a>.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {plans.map((p) => (
                <div key={p.chave} className="bg-white rounded-2xl shadow-xl p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-[#E03673] flex items-center justify-center text-white">
                      <Package className="w-5 h-5" />
                    </div>
                    <h2 className="font-bold text-gray-900">{p.nome}</h2>
                  </div>
                  <p className="text-3xl font-extrabold text-gray-900">
                    R$ {brl(p.preco_mensal)}
                    <span className="text-sm font-normal text-gray-400">/mês</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1 mb-4">
                    <strong className="text-gray-900">{p.sessoes_mensais}</strong> {p.sessoes_mensais === 1 ? 'sessão' : 'sessões'} por mês
                  </p>
                  <ul className="space-y-2 mb-6 flex-1">
                    <li className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#E03673]" /><span>Sessões por videochamada</span></li>
                    <li className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#E03673]" /><span>Renovação mensal automática</span></li>
                    <li className="flex items-start gap-2 text-sm text-gray-600"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#E03673]" /><span>Cancele quando quiser</span></li>
                  </ul>
                  <button
                    onClick={() => router.push(`/pacote-checkout?plan=${p.chave}`)}
                    disabled={hasPackage}
                    className="w-full py-3 rounded-xl text-white font-semibold bg-[#E03673] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Escolher {p.nome}
                  </button>
                </div>
              ))}
            </div>

            {welcome && (
              <div className="text-center mb-8">
                <button
                  onClick={() => router.push('/patient/dashboard')}
                  className="px-6 py-2.5 rounded-lg border border-white/40 text-white text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Fazer depois e ir para o meu painel
                </button>
              </div>
            )}

            <div className="max-w-2xl mx-auto text-center space-y-2 text-white/60 text-xs leading-relaxed">
              <p>As sessões contratadas valem dentro do mês vigente. As que não forem usadas expiram ao fim desse período.</p>
              <p>Ao cancelar, não há novas cobranças, e as sessões já pagas continuam valendo até o fim do período.</p>
              <p>Os pacotes valem com os terapeutas que participam deste formato.</p>
              <p>Dúvidas? <a href={mailto} className="text-[#ff8bb3] underline">Fale com a gente</a> ou <a href="/patient/dashboard" className="text-[#ff8bb3] underline">volte ao painel</a>.</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
