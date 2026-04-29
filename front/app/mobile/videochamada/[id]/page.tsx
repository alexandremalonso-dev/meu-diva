"use client";

export const dynamic = "force-dynamic";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/lib/useApi";
import MobileHeader from "@/components/mobile/MobileHeader";
import { Loader2, RefreshCw } from "lucide-react";

export default function MobileVideochamada() {
  const { id } = useParams();
  const { user } = useAuth();
  const router = useRouter();
  const { execute: apiCall } = useApi();

  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appointmentId = Number(id);

  useEffect(() => {
    if (!appointmentId || isNaN(appointmentId)) return;
    fetchMeetUrl();
  }, [appointmentId]);

  const fetchMeetUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall<{
        meet_url: string;
        room_name: string;
        jwt_token?: string;
        therapist_name?: string;
        patient_name?: string;
      }>({
        url: `/api/jitsi/meet-url/${appointmentId}`,
      });

      if (!response?.meet_url) throw new Error("URL da sala não encontrada");

      const { meet_url, jwt_token } = response;

      // ✅ Mesma lógica da web — JWT na URL quando disponível
      let iframeUrl = meet_url;
      if (jwt_token) {
        iframeUrl = `${meet_url}?jwt=${jwt_token}`;
      }

      // ✅ Parâmetros no fragmento para pular tela de entrada e desabilitar deep link
      iframeUrl +=
        `#config.prejoinPageEnabled=false` +
        `&config.disableDeepLinking=true` +
        `&config.enableWelcomePage=false` +
        `&config.startWithAudioMuted=false` +
        `&config.startWithVideoMuted=false` +
        `&config.defaultBackground=%231a1a2e` +
        `&interfaceConfig.SHOW_JITSI_WATERMARK=false` +
        `&interfaceConfig.SHOW_BRAND_WATERMARK=false` +
        `&interfaceConfig.APP_NAME=Meu%20Div%C3%A3` +
        `&interfaceConfig.NATIVE_APP_NAME=Meu%20Div%C3%A3` +
        `&userInfo.displayName=${encodeURIComponent(user?.full_name || "Usuário")}`;

      setMeetUrl(iframeUrl);
    } catch (err: any) {
      setError(err.message || "Erro ao iniciar videochamada");
    } finally {
      setLoading(false);
    }
  };

  if (!appointmentId || isNaN(appointmentId)) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <MobileHeader title="Videochamada" showBack backTo="/mobile/dashboard" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#6B7280" }}>Sessão não encontrada.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#1a1a2e" }}>
      <MobileHeader title="Videochamada" showBack backTo="/mobile/dashboard" />

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

        {/* LOADING */}
        {loading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: "linear-gradient(135deg, #E03673 0%, #2F80D3 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24,
            }}>
              <span style={{ fontSize: 32 }}>🛋️</span>
            </div>
            <Loader2 size={32} color="#E03673" className="animate-spin" style={{ marginBottom: 16 }} />
            <p style={{ color: "white", fontSize: 15, fontWeight: 500 }}>Iniciando videochamada...</p>
            <p style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>Sessão #{appointmentId}</p>
          </div>
        )}

        {/* ERRO */}
        {error && !loading && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 10,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "#1a1a2e", gap: 16, padding: "0 24px",
          }}>
            <p style={{ color: "#EF4444", fontSize: 14, textAlign: "center" }}>⚠️ {error}</p>
            <button
              onClick={fetchMeetUrl}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                backgroundColor: "#E03673", color: "white",
                border: "none", borderRadius: 10, padding: "10px 20px",
                fontSize: 14, cursor: "pointer",
              }}
            >
              <RefreshCw size={16} /> Tentar novamente
            </button>
            <button
              onClick={() => router.replace("/mobile/dashboard")}
              style={{
                backgroundColor: "#374151", color: "white",
                border: "none", borderRadius: 10, padding: "10px 20px",
                fontSize: 14, cursor: "pointer",
              }}
            >
              Voltar
            </button>
          </div>
        )}

        {/* ✅ IFRAME — sem JitsiMeetExternalAPI, sem prompt de app nativo */}
        {meetUrl && !loading && !error && (
          <iframe
            src={meetUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
            allowFullScreen
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}