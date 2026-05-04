"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

function getBackendUrl(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  const host = window.location.hostname;
  if (host.includes("meudiva-frontend-non-prod") || host.includes("homologacao")) {
    return "https://meudiva-api-non-prod-365415900882.southamerica-east1.run.app";
  }
  if (host.includes("app.meudivaonline.com") || host.includes("meudiva-frontend-prod")) {
    return "https://api.meudivaonline.com";
  }
  return "http://localhost:8000";
}

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return cap?.getPlatform?.() === "ios";
}

function LoginForm() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showApple, setShowApple] = useState(false);

  useEffect(() => {
    document.title = "Meu Divã - Login";
    // Só mostra Sign in with Apple no iOS nativo
    setShowApple(isNativeApp() && isIOS());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setSuccess("Login realizado com sucesso! Redirecionando...");
    } catch (err: any) {
      console.error("❌ Erro no login:", err);
      setError(err.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider: "google" | "microsoft") => {
    setSocialLoading(true);
    setError("");
    const backendUrl = getBackendUrl();
    window.location.href = `${backendUrl}/api/auth/${provider}/login`;
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    setError("");
    try {
      const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");
      const result = await SignInWithApple.authorize({
        clientId: "com.meudiva.app",
        redirectURI: "https://app.meudivaonline.com/auth/callback",
        scopes: "email name",
      });

      const { identityToken, givenName, familyName, email: appleEmail } = result.response;

      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/auth/apple/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identity_token: identityToken,
          given_name: givenName,
          family_name: familyName,
          email: appleEmail,
        }),
      });

      if (!response.ok) throw new Error("Erro ao autenticar com Apple");

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      setSuccess("Login realizado com sucesso! Redirecionando...");
      window.location.href = "/mobile/dashboard";
    } catch (err: any) {
      console.error("❌ Erro no Apple Sign In:", err);
      if (err.message !== "The user canceled the sign-in flow.") {
        setError("Erro ao fazer login com Apple. Tente outro método.");
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2F80D3]/10 to-[#E03673]/10 py-12 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 rounded-2xl mb-4 shadow-md overflow-hidden p-2" style={{ border: `2px solid #E03673`, backgroundColor: 'transparent' }}>
            <Image
              src="/logo.png"
              alt="Meu Divã"
              width={180}
              height={180}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">Bem-vindo</h1>
          <p className="text-gray-500 mt-2">Entre na sua conta do Meu Divã</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              placeholder="seu@email.com"
              required
              disabled={loading || socialLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none"
              placeholder="••••••••"
              required
              disabled={loading || socialLoading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || socialLoading}
            className="w-full bg-gradient-to-r from-[#2F80D3] to-[#E03673] text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Entrar"}
          </button>

          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-sm text-[#2F80D3] hover:text-[#E03673] transition-colors">
              Esqueceu sua senha?
            </Link>
          </div>
        </form>

        <div className="mt-6 text-center">
          <Link href="/auth/signup" className="text-[#E03673] hover:text-[#c02c5e] text-sm">
            Não tem uma conta? Cadastre-se
          </Link>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-3">Ou continue com</p>

          {/* Sign in with Apple — só aparece no iOS nativo */}
          {showApple && (
            <button
              onClick={handleAppleLogin}
              disabled={appleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 mb-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50"
            >
              {appleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              )}
              {appleLoading ? "Entrando..." : "Continuar com Apple"}
            </button>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => handleSocialLogin("google")}
              disabled={loading || socialLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm text-gray-600">Google</span>
            </button>

            <button
              onClick={() => handleSocialLogin("microsoft")}
              disabled={loading || socialLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23">
                <path fill="#f35325" d="M1 1h10v10H1z"/>
                <path fill="#81bc06" d="M12 1h10v10H12z"/>
                <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                <path fill="#ffba08" d="M12 12h10v10H12z"/>
              </svg>
              <span className="text-sm text-gray-600">Microsoft</span>
            </button>
          </div>

          {socialLoading && (
            <p className="text-xs text-center text-gray-400 mt-2">Redirecionando para o provedor...</p>
          )}
        </div>
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