"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, MailCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";

const destinoPorPapel = (role?: string) =>
  role === "therapist" ? "/mobile/dashboard"
  : role === "patient" ? "/mobile/dashboard"
  : "/mobile/dashboard";

export default function MobileVerificarEmailPage() {
  const [email, setEmail] = useState("");
  const [emailFixo, setEmailFixo] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [autoTentando, setAutoTentando] = useState(false);

  const confirmar = async (emailArg: string, codeArg: string) => {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res: any = await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email: emailArg.trim(), code: codeArg.replace(/\D/g, "") }),
      });
      if (res?.access_token) {
        localStorage.setItem("access_token", res.access_token);
        if (res.refresh_token) localStorage.setItem("refresh_token", res.refresh_token);
        localStorage.setItem("biometric_email", emailArg.trim());
        setDone(true);
        window.location.href = destinoPorPapel(res.user?.role);
        return;
      }
      setError("E-mail confirmado, mas não foi possível entrar. Use seu e-mail e senha.");
    } catch (e: any) {
      setError(e?.message || "Não foi possível confirmar. Tente de novo.");
    } finally {
      setLoading(false);
      setAutoTentando(false);
    }
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get("email") || "";
    const c = (p.get("code") || "").replace(/\D/g, "");
    if (e) { setEmail(e); setEmailFixo(true); }
    if (e && c.length === 6) {
      setCode(c);
      setAutoTentando(true);
      confirmar(e, c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const reenviar = async () => {
    if (!email.trim()) { setError("Informe o e-mail do cadastro."); return; }
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const r: any = await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      if (r?.sent) setInfo("Enviamos um novo código. Se não encontrar, confira o spam.");
      else if (r?.limited) setError("Muitos reenvios. Tente mais tarde.");
      else setInfo("Aguarde um instante para pedir outro código.");
      setCooldown(Math.min(Number(r?.retry_after) || 60, 120));
    } catch (e: any) {
      setError(e?.message || "Não foi possível reenviar agora.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f0f5" }}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center pt-14 pb-10 px-6" style={{ backgroundColor: "#E03673" }}>
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4" style={{ width: 120, height: 120 }}>
          <Image src="/logo.png" alt="Meu Divã" width={104} height={104} className="w-full h-full object-contain" priority />
        </div>
        <p className="text-white text-base font-light tracking-wide">Cuidado que Acolhe</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-10">

        {done || autoTentando ? (
          <div className="flex flex-col items-center justify-center py-12">
            {done
              ? <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
              : <Loader2 className="w-14 h-14 text-[#E03673] animate-spin mb-4" />}
            <p className="text-xl font-bold text-gray-900 mb-2">
              {done ? "E-mail confirmado!" : "Confirmando seu e-mail..."}
            </p>
            <p className="text-gray-500 text-sm">
              {done ? "Entrando na sua conta..." : "Só um instante."}
            </p>
            {!done && error && <p className="text-red-600 text-sm mt-4 text-center">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "#E0367315" }}>
                <MailCheck className="w-8 h-8" style={{ color: "#E03673" }} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Confirme seu e-mail</h1>
              <p className="text-gray-500 text-sm text-center">
                {emailFixo && email
                  ? <>Enviamos um código de 6 números para <strong className="text-gray-800">{email}</strong>.</>
                  : "Digite o e-mail do cadastro e o código de 6 números que enviamos."}
              </p>
            </div>

            {!emailFixo && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] outline-none bg-gray-50"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Código de verificação</label>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && code.replace(/\D/g, "").length === 6) confirmar(email, code); }}
                placeholder="000000"
                className="w-full px-4 py-4 text-center text-4xl tracking-[0.5em] font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] outline-none bg-gray-50"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}
            {info && (
              <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-100 text-sm">{info}</div>
            )}

            <button
              onClick={() => confirmar(email, code)}
              disabled={loading || code.replace(/\D/g, "").length !== 6 || !email.trim()}
              className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "#E03673" }}
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Confirmando...</> : "Confirmar e-mail"}
            </button>

            <button
              onClick={reenviar}
              disabled={resending || cooldown > 0}
              className="w-full mt-3 py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {resending ? "Enviando..." : cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
            </button>

            <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm text-gray-500 space-y-2">
              <p>Digitou o e-mail errado? <a href="/mobile/signup" className="font-medium" style={{ color: "#E03673" }}>Voltar ao cadastro</a></p>
              <p>Já confirmou? <a href="/mobile/login" className="font-medium" style={{ color: "#E03673" }}>Entrar</a></p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
