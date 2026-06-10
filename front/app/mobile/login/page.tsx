"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/lib/api";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

function LoginForm() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [native, setNative] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricPromptShown, setBiometricPromptShown] = useState(false);
  const biometricChecked = useRef(false);

  useEffect(() => {
    const isNative = isNativeApp();
    setNative(isNative);

    if (!isNative || biometricChecked.current) return;
    biometricChecked.current = true;

    const hasSavedSession =
      !!localStorage.getItem("refresh_token") &&
      !!localStorage.getItem("biometric_email");

    if (!hasSavedSession) return;

    import("@aparajita/capacitor-biometric-auth")
      .then(({ BiometricAuth }) =>
        BiometricAuth.checkBiometry().then((result) => {
          if (result.isAvailable) {
            setBiometricAvailable(true);
            triggerBiometric(BiometricAuth);
          }
        })
      )
      .catch(() => {});
  }, []);

  const triggerBiometric = async (BiometricAuth: any) => {
    if (biometricPromptShown) return;
    setBiometricPromptShown(true);
    setError("");

    try {
      await BiometricAuth.authenticate({
        reason: "Confirme sua identidade para entrar no Meu Divã",
        cancelTitle: "Usar senha",
        allowDeviceCredential: true,
        iosFallbackTitle: "Usar senha",
        androidTitle: "Meu Divã",
        androidSubtitle: "Confirme sua identidade",
      });

      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) throw new Error("Sessão expirada");

      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) throw new Error("Sessão expirada. Faça login novamente.");

      const data = await res.json();
      if (data.access_token) localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);

      setSuccess("Identidade confirmada! Entrando...");
      setTimeout(() => (window.location.href = "/mobile/dashboard"), 800);
    } catch (err: any) {
      setBiometricPromptShown(false);
      if (
        err.message &&
        !err.message.includes("cancel") &&
        !err.message.includes("Cancel") &&
        !err.message.includes("UserCancel")
      ) {
        localStorage.removeItem("refresh_token");
        setError("Sessão expirada. Faça login com email e senha.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setSuccess("Login realizado! Redirecionando...");
    } catch (err: any) {
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "microsoft") => {
    setSocialLoading(true);
    setError("");
    const baseUrl = getApiBaseUrl();
    window.location.href = `${baseUrl}/api/auth/${provider}/login?mobile=true`;
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    setError("");
    try {
      const baseUrl = getApiBaseUrl();
      window.location.href = `${baseUrl}/api/auth/apple/login?mobile=true`;
    } catch (err: any) {
      if (!err.message?.includes("cancel")) {
        setError("Erro ao fazer login com Apple. Tente outro método.");
      }
      setAppleLoading(false);
    }
  };

  const signupHref = "/mobile/signup";
  const forgotHref = "/auth/forgot-password";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#f7f0f5" }}>
      <div
        className="flex flex-col items-center justify-center pt-14 pb-10 px-6"
        style={{ backgroundColor: "#E03673" }}
      >
        <div className="bg-white rounded-2xl shadow-lg p-4 mb-4" style={{ width: 120, height: 120 }}>
          <Image src="/logo.png" alt="Meu Divã" width={104} height={104} className="w-full h-full object-contain" priority />
        </div>
        <p className="text-white text-base font-light tracking-wide">Cuidado que Acolhe</p>
      </div>

      <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-10">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Entrar na sua conta</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />{success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-gray-50 text-gray-800"
              placeholder="seu@email.com"
              required
              disabled={loading || socialLoading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-gray-50 text-gray-800 pr-12"
                placeholder="••••••••••"
                required
                disabled={loading || socialLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || socialLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#E03673" }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {biometricAvailable ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                )}
                Entrar
              </>
            )}
          </button>
        </form>

        <div className="flex justify-between mt-4 mb-6">
          <Link href={forgotHref} className="text-sm text-gray-500 hover:text-[#E03673]">
            Esqueci minha senha
          </Link>
          <Link href={signupHref} className="text-sm font-medium" style={{ color: "#E03673" }}>
            Criar conta
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">ou continue com</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Google → Microsoft → Apple (Guideline 4.8) */}
        <div className="flex flex-col gap-3">

          <button
            onClick={() => handleSocialLogin("google")}
            disabled={loading || socialLoading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm text-gray-600 font-medium">Google</span>
          </button>

          <button
            onClick={() => handleSocialLogin("microsoft")}
            disabled={loading || socialLoading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span className="text-sm text-gray-600 font-medium">Microsoft</span>
          </button>

          <button
            onClick={handleAppleLogin}
            disabled={appleLoading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white"
          >
            {appleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            )}
            <span className="text-sm text-gray-600 font-medium">
              {appleLoading ? "Entrando..." : "Apple"}
            </span>
          </button>

        </div>

        {socialLoading && (
          <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Redirecionando para o provedor...
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}