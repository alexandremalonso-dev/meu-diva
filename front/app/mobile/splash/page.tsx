"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef } from "react";
import Image from "next/image";

// Splash NÃO usa AuthContext — controla o redirect ela mesma
// Motivo: AuthContext pode redirecionar antes do splash terminar
export default function MobileSplash() {
  const redirected = useRef(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (redirected.current) return;
      redirected.current = true;

      // Verifica token diretamente — sem depender do AuthContext
      const token = localStorage.getItem("access_token");

      if (!token) {
        window.location.replace("/mobile/login");
        return;
      }

      // Tenta validar o token com o backend
      try {
        const baseUrl = (() => {
          const host = window.location.hostname;
          if (host.includes("app.meudivaonline.com") || host.includes("meudiva-frontend-prod")) {
            return "https://api.meudivaonline.com";
          }
          return "http://localhost:8000";
        })();

        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          window.location.replace("/mobile/dashboard");
        } else {
          // Token inválido — limpa e vai para login
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.replace("/mobile/login");
        }
      } catch {
        // Erro de rede — se tem token, tenta o dashboard mesmo assim
        window.location.replace("/mobile/dashboard");
      }
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#E03673",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 40,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Bolinhas decorativas de fundo */}
      <div style={{ position: "absolute", top: 60, left: 40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", top: 140, right: 20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", bottom: 120, left: 20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", bottom: 60, right: 40, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", top: "40%", left: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

      {/* Logo */}
      <Image
        src="/logo-mobile.png"
        alt="Meu Divã"
        width={220}
        height={220}
        style={{
          objectFit: "contain",
          filter: "drop-shadow(0px 6px 20px rgba(0,0,0,0.25))",
        }}
        priority
      />

      {/* Tagline */}
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, letterSpacing: 0.5 }}>
          Cuidado que Acolhe
        </div>
      </div>

      {/* Bolinhas animadas */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 44 }}>
        {[
          { size: 10, delay: "0s", color: "rgba(255,255,255,0.95)" },
          { size: 14, delay: "0.2s", color: "rgba(255,255,255,0.85)" },
          { size: 18, delay: "0.4s", color: "rgba(255,255,255,0.75)" },
        ].map((b, i) => (
          <div
            key={i}
            style={{
              width: b.size,
              height: b.size,
              borderRadius: "50%",
              backgroundColor: b.color,
              animationName: "rise",
              animationDuration: "1.4s",
              animationDelay: b.delay,
              animationIterationCount: "infinite",
              animationTimingFunction: "ease-in-out",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes rise {
          0%   { transform: translateY(0px);  opacity: 0.4; }
          50%  { transform: translateY(-18px); opacity: 1; }
          100% { transform: translateY(0px);  opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}