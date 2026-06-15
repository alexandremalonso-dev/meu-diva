"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AuthProvider } from "@/contexts/AuthContext";
import { api, getApiBaseUrl } from "@/lib/api";
import { Loader2, AlertCircle, CheckCircle, User, Briefcase } from "lucide-react";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).Capacitor?.isNativePlatform?.();
}

async function openOAuthUrl(url: string) {
  if (isNativeApp()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
  } else {
    window.location.href = url;
  }
}

function MobileSignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
    role: "patient" as "patient" | "therapist",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.full_name.trim()) { setError("Nome completo é obrigatório"); return; }
    if (!formData.email.trim()) { setError("E-mail é obrigatório"); return; }
    if (!formData.password) { setError("Senha é obrigatória"); return; }
    if (formData.password !== formData.confirm_password) { setError("As senhas não coincidem"); return; }
    if (formData.password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres"); return; }

    setLoading(true);
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      });
      setSuccess("Cadastro realizado! Redirecionando...");
      setTimeout(() => router.push("/mobile/login"), 1500);
    } catch (err: any) {
      setError(err.message || "Erro ao realizar cadastro");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignup = async (provider: "google" | "microsoft" | "apple") => {
    setSocialLoading(true);
    setError("");
    const baseUrl = getApiBaseUrl();
    await openOAuthUrl(`${baseUrl}/api/auth/${provider}/login?mobile=true`);
  };

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

      <div className="flex-1 bg-white rounded-t-3xl -mt-4 px-6 pt-8 pb-10 overflow-y-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Criar conta</h1>

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
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Como você quer acessar o Meu Divã?
            </label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: "patient" })}
                disabled={loading || socialLoading}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  formData.role === "patient" ? "border-[#E03673] bg-[#E03673]/5" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${formData.role === "patient" ? "bg-[#E03673]/10" : "bg-gray-100"}`}>
                    <User className={`w-5 h-5 ${formData.role === "patient" ? "text-[#E03673]" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${formData.role === "patient" ? "text-[#E03673]" : "text-gray-800"}`}>Paciente</p>
                    <p className="text-xs text-gray-500">Quero fazer sessões de terapia e cuidar da minha saúde emocional</p>
                  </div>
                  {formData.role === "patient" && <CheckCircle className="w-5 h-5 text-[#E03673] shrink-0" />}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: "therapist" })}
                disabled={loading || socialLoading}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                  formData.role === "therapist" ? "border-[#E03673] bg-[#E03673]/5" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${formData.role === "therapist" ? "bg-[#E03673]/10" : "bg-gray-100"}`}>
                    <Briefcase className={`w-5 h-5 ${formData.role === "therapist" ? "text-[#E03673]" : "text-gray-400"}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold ${formData.role === "therapist" ? "text-[#E03673]" : "text-gray-800"}`}>Especialista</p>
                    <p className="text-xs text-gray-500">Quero atender pacientes online e fazer gestão da minha carreira</p>
                  </div>
                  {formData.role === "therapist" && <CheckCircle className="w-5 h-5 text-[#E03673] shrink-0" />}
                </div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Nome completo</label>
            <input type="text" name="full_name" value={formData.full_name} onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-gray-50 text-gray-800"
              placeholder="Seu nome completo" disabled={loading || socialLoading} autoComplete="name" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">E-mail</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-gray-50 text-gray-800"
              placeholder="seu@email.com" disabled={loading || socialLoading} autoComplete="email" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Senha</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-gray-50 text-gray-800"
              placeholder="••••••" disabled={loading || socialLoading} autoComplete="new-password" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Confirmar senha</label>
            <input type="password" name="confirm_password" value={formData.confirm_password} onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#E03673] focus:border-transparent outline-none bg-gray-50 text-gray-800"
              placeholder="••••••" disabled={loading || socialLoading} autoComplete="new-password" />
          </div>

          <button type="submit" disabled={loading || socialLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "#E03673" }}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cadastrar"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">ou cadastre-se com</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => handleSocialSignup("google")} disabled={loading || socialLoading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span className="text-sm text-gray-600 font-medium">Google</span>
          </button>

          <button onClick={() => handleSocialSignup("microsoft")} disabled={loading || socialLoading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white">
            <svg className="w-5 h-5" viewBox="0 0 23 23">
              <path fill="#f35325" d="M1 1h10v10H1z" />
              <path fill="#81bc06" d="M12 1h10v10H12z" />
              <path fill="#05a6f0" d="M1 12h10v10H1z" />
              <path fill="#ffba08" d="M12 12h10v10H12z" />
            </svg>
            <span className="text-sm text-gray-600 font-medium">Microsoft</span>
          </button>

          <button onClick={() => handleSocialSignup("apple")} disabled={loading || socialLoading}
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 bg-white">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <span className="text-sm text-gray-600 font-medium">Apple</span>
          </button>
        </div>

        {socialLoading && (
          <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Redirecionando...
          </p>
        )}

        <p className="text-center text-sm text-gray-500 mt-6">
          Já tem uma conta?{" "}
          <Link href="/mobile/login" className="font-medium" style={{ color: "#E03673" }}>
            Faça login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function MobileSignupPage() {
  return (
    <AuthProvider>
      <MobileSignupForm />
    </AuthProvider>
  );
}