'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, MailCheck, AlertCircle, CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'

// Depois de confirmar o e-mail o usuário já entra logado e segue para o próximo passo do seu perfil.
const destinoPorPapel = (role?: string) =>
  role === 'therapist' ? '/adesao'
  : role === 'empresa' ? '/empresa/dashboard'
  : role === 'patient' ? '/pacotes?novo=1'
  : '/'

export default function VerificarEmailPage() {
  const [email, setEmail] = useState('')
  const [emailFixo, setEmailFixo] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [autoTentando, setAutoTentando] = useState(false)

  const confirmar = async (emailArg: string, codeArg: string) => {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res: any = await api('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email: emailArg.trim(), code: codeArg.replace(/\D/g, '') }),
      })
      if (res?.access_token) {
        localStorage.setItem('access_token', res.access_token)
        if (res.refresh_token) localStorage.setItem('refresh_token', res.refresh_token)
        localStorage.setItem('biometric_email', emailArg.trim())
        setDone(true)
        window.location.href = destinoPorPapel(res.user?.role)
        return
      }
      setError('E-mail confirmado, mas não foi possível entrar automaticamente. Use seu e-mail e senha para entrar.')
    } catch (e: any) {
      setError(e?.message || 'Não foi possível confirmar. Tente de novo.')
    } finally {
      setLoading(false)
      setAutoTentando(false)
    }
  }

  // Abre com ?email=...&code=...: vem do link do e-mail e confirma sozinho
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const e = p.get('email') || ''
    const c = (p.get('code') || '').replace(/\D/g, '')
    if (e) { setEmail(e); setEmailFixo(true) }
    if (e && c.length === 6) {
      setCode(c)
      setAutoTentando(true)
      confirmar(e, c)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const reenviar = async () => {
    if (!email.trim()) { setError('Informe o e-mail do cadastro.'); return }
    setResending(true)
    setError(null)
    setInfo(null)
    try {
      const r: any = await api('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      if (r?.sent) setInfo('Enviamos um novo código. Se não encontrar, confira a caixa de spam.')
      else if (r?.limited) setError('Muitos reenvios por enquanto. Tente de novo mais tarde.')
      else setInfo('Aguarde um instante para pedir outro código.')
      setCooldown(Math.min(Number(r?.retry_after) || 60, 120))
    } catch (e: any) {
      setError(e?.message || 'Não foi possível reenviar agora.')
    } finally {
      setResending(false)
    }
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-pink-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Image src="/jitsi-watermark.png" alt="Meu Divã" width={48} height={48} className="w-12 h-12 object-contain" priority />
          <span className="text-gray-900 font-semibold text-lg">Meu Divã</span>
        </div>

        {done || autoTentando ? (
          <div className="text-center py-6">
            {done ? <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" /> : <Loader2 className="w-10 h-10 text-[#E03673] animate-spin mx-auto mb-3" />}
            <p className="text-gray-800 font-semibold">{done ? 'E-mail confirmado!' : 'Confirmando seu e-mail...'}</p>
            <p className="text-gray-500 text-sm mt-1">{done ? 'Entrando na sua conta...' : 'Só um instante.'}</p>
            {!done && error && <p className="text-red-600 text-sm mt-4">{error}</p>}
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-[#E03673]/10 flex items-center justify-center mx-auto mb-3">
                <MailCheck className="w-7 h-7 text-[#E03673]" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Confirme seu e-mail</h1>
              <p className="text-gray-500 text-sm mt-2">
                {emailFixo && email
                  ? <>Enviamos um código de 6 números para <strong className="text-gray-800">{email}</strong>.</>
                  : 'Digite o e-mail do cadastro e o código de 6 números que enviamos.'}
              </p>
            </div>

            {!emailFixo && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] outline-none"
                />
              </div>
            )}

            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Código</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter' && code.replace(/\D/g, '').length === 6) confirmar(email, code) }}
              placeholder="000000"
              className="w-full p-3 text-center text-3xl tracking-[0.4em] font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] outline-none"
            />

            {error && (
              <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
              </div>
            )}
            {info && <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-800 text-sm">{info}</div>}

            <button
              onClick={() => confirmar(email, code)}
              disabled={loading || code.replace(/\D/g, '').length !== 6 || !email.trim()}
              className="w-full mt-5 py-3 rounded-xl text-white font-semibold bg-[#E03673] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</> : 'Confirmar'}
            </button>

            <button
              onClick={reenviar}
              disabled={resending || cooldown > 0}
              className="w-full mt-3 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? 'Enviando...' : cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
            </button>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm text-gray-500 space-y-1">
              <p>Digitou o e-mail errado? <a href="/auth/signup" className="text-[#E03673] hover:underline">Voltar ao cadastro</a></p>
              <p>Já confirmou? <a href="/auth/login" className="text-[#E03673] hover:underline">Entrar</a></p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
