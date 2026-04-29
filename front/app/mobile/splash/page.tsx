"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";

export default function MobileSplash() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => {
      if (user) {
        router.replace("/mobile/dashboard");
      } else {
        router.replace("/mobile/login");
      }
    }, 2800);
    return () => clearTimeout(timer);
  }, [user, loading]);

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

      {/* BOLINHAS DE FUNDO decorativas */}
      <div style={{ position: "absolute", top: 60, left: 40, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", top: 140, right: 20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", bottom: 120, left: 20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", bottom: 60, right: 40, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
      <div style={{ position: "absolute", top: "40%", left: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

      {/* LOGO — sem fundo branco, grande e com drop-shadow */}
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

      {/* TAGLINE */}
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, letterSpacing: 0.5 }}>
          Cuidado que Acolhe
        </div>
      </div>

      {/* BOLINHAS SUBINDO */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 12,
        height: 44,
      }}>
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