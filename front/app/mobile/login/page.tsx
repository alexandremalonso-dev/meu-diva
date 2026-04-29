"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Fingerprint, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

const COLORS = {
  primary: "#E03673",
  secondary: "#2F80D3",
  primaryDark: "#c02c5e",
  gray: "#F9F5FF",
  grayBorder: "#E5E7EB",
  grayText: "#6B7280",
  dark: "#3A3B21",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://meudiva-api-backend-592671373665.southamerica-east1.run.app";

export default function MobileLogin() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      localStorage.setItem('biometric_email', email);
      localStorage.setItem('biometric_password', password);
      router.replace("/mobile/dashboard");
    } catch (e: any) {
      setError(e?.message || "E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometric = async () => {
    try {
      const savedEmail = localStorage.getItem('biometric_email');
      const savedPassword = localStorage.getItem('biometric_password');

      if (!savedEmail || !savedPassword) {
        setError("Faça login com e-mail e senha primeiro para ativar a biometria.");
        return;
      }

      await BiometricAuth.authenticate({
        reason: "Acesse o Meu Divã",
        cancelTitle: "Cancelar",
        allowDeviceCredential: true,
        iosFallbackTitle: "Usar senha",
      });

      setLoading(true);
      await login(savedEmail, savedPassword);
      router.replace("/mobile/dashboard");
    } catch (e: any) {
      if (e?.code !== 'userCancel') {
        setError("Biometria não disponível. Use e-mail e senha.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: COLORS.gray,
      display: "flex",
      flexDirection: "column",
    }}>

      {/* HEADER ROSA */}
      <div style={{
        backgroundColor: COLORS.primary,
        padding: "48px 24px 40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          background: "white",
          borderRadius: 20,
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Image src="/logo.png" alt="Meu Divã" width={180} height={72} style={{ objectFit: "contain" }} priority />
        </div>
        <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 4 }}>
          Cuidado que Acolhe
        </div>
      </div>

      {/* FORM */}
      <div style={{
        flex: 1,
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: COLORS.dark, marginBottom: 4 }}>
          Entrar na sua conta
        </div>

        {/* E-MAIL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, color: COLORS.grayText, fontWeight: 500 }}>E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: `1px solid ${COLORS.grayBorder}`,
              fontSize: 15,
              backgroundColor: "white",
              outline: "none",
              color: COLORS.dark,
            }}
          />
        </div>

        {/* SENHA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, color: COLORS.grayText, fontWeight: 500 }}>Senha</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{
                width: "100%",
                padding: "14px 48px 14px 16px",
                borderRadius: 12,
                border: `1px solid ${COLORS.grayBorder}`,
                fontSize: 15,
                backgroundColor: "white",
                outline: "none",
                color: COLORS.dark,
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: COLORS.grayText,
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* ERRO */}
        {error && (
          <div style={{
            background: "#FEE2E2",
            color: "#991B1B",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* BOTÃO ENTRAR */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            backgroundColor: loading ? "#f472a8" : COLORS.primary,
            color: "white",
            border: "none",
            borderRadius: 12,
            padding: "16px",
            fontSize: 16,
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <LogIn size={18} />
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {/* BOTÃO BIOMETRIA */}
        <button
          onClick={handleBiometric}
          disabled={loading}
          style={{
            backgroundColor: "white",
            color: COLORS.secondary,
            border: `1.5px solid ${COLORS.secondary}`,
            borderRadius: 12,
            padding: "14px",
            fontSize: 15,
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Fingerprint size={20} color={COLORS.secondary} />
          Entrar com Digital / Face ID
        </button>

        {/* DIVISOR */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: COLORS.grayBorder }} />
          <span style={{ fontSize: 12, color: COLORS.grayText }}>ou continue com</span>
          <div style={{ flex: 1, height: 1, background: COLORS.grayBorder }} />
        </div>

        {/* BOTÕES SOCIAL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => {
              sessionStorage.setItem('oauth_from_mobile', 'true');
              window.location.href = `${API_URL}/api/auth/google`;
            }}
            style={{
              backgroundColor: "white",
              color: "#374151",
              border: `1.5px solid ${COLORS.grayBorder}`,
              borderRadius: 12,
              padding: "14px",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Entrar com Google
          </button>

          <button
            onClick={() => {
              sessionStorage.setItem('oauth_from_mobile', 'true');
              window.location.href = `${API_URL}/api/auth/microsoft`;
            }}
            style={{
              backgroundColor: "white",
              color: "#374151",
              border: `1.5px solid ${COLORS.grayBorder}`,
              borderRadius: 12,
              padding: "14px",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#F25022" d="M1 1h10v10H1z"/>
              <path fill="#00A4EF" d="M13 1h10v10H13z"/>
              <path fill="#7FBA00" d="M1 13h10v10H1z"/>
              <path fill="#FFB900" d="M13 13h10v10H13z"/>
            </svg>
            Entrar com Microsoft
          </button>
        </div>

        {/* LINKS */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}>
          <button
            onClick={() => router.push("/auth/forgot-password")}
            style={{ background: "none", border: "none", color: COLORS.grayText, fontSize: 13, cursor: "pointer" }}
          >
            Esqueci minha senha
          </button>
          <button
            onClick={() => router.push("/auth/signup")}
            style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 13, fontWeight: 500, cursor: "pointer" }}
          >
            Criar conta
          </button>
        </div>
      </div>
    </div>
  );
}