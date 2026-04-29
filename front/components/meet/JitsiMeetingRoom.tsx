"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useApi } from "@/lib/useApi";
import { Loader2, X, Maximize2, Minimize2, RefreshCw, Clock } from "lucide-react";
import { ReviewModal } from "@/components/ReviewModal";

interface JitsiMeetingRoomProps {
  appointmentId: number;
  userRole: "patient" | "therapist" | "admin";
  onClose: () => void;
}

interface JitsiMeetUrlResponse {
  meet_url: string;
  room_name?: string;
  therapist_name?: string;
  patient_name?: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JITSI_DOMAIN =
  process.env.NEXT_PUBLIC_JITSI_DOMAIN ||
  (process.env.NODE_ENV === "production"
    ? "meet.meudivaonline.com"
    : "meet-homolog.meudivaonline.com");

function extractRoomName(meetUrl: string): string {
  try {
    const url = new URL(meetUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || meetUrl;
  } catch {
    return meetUrl.split("/").filter(Boolean).pop() || meetUrl;
  }
}

export function JitsiMeetingRoom({ appointmentId, userRole, onClose }: JitsiMeetingRoomProps) {
  const { execute: apiCall } = useApi();

  const [meetUrl, setMeetUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("Usuário");
  const [therapistName, setTherapistName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Paciente começa aguardando — overlay visível até entrar na conferência
  const [waitingForHost, setWaitingForHost] = useState(userRole === "patient");

  // Estados para avaliação
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [appointmentCompleted, setAppointmentCompleted] = useState(false);
  const [therapistNameForReview, setTherapistNameForReview] = useState("");

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const joinRegisteredRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  // =============================
  // CARREGAR SCRIPT DA API JITSI
  // =============================
  useEffect(() => {
    if (window.JitsiMeetExternalAPI) {
      setApiReady(true);
      return;
    }

    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.id = "jitsi-external-api";
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => setApiReady(true);
    script.onerror = () => {
      scriptLoadedRef.current = false;
      setError("Não foi possível carregar a API do Jitsi. Verifique sua conexão.");
    };
    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById("jitsi-external-api");
      if (existing) {
        try { document.head.removeChild(existing); } catch {}
      }
      scriptLoadedRef.current = false;
    };
  }, []);

  // =============================
  // REGISTRO DE ENTRADA (AUDITORIA)
  // =============================
  useEffect(() => {
    if (joinRegisteredRef.current || !appointmentId) return;

    const registerJoin = async () => {
      try {
        await apiCall({
          url: `/api/jitsi/session/${appointmentId}/join`,
          method: "POST",
        });
        joinRegisteredRef.current = true;
      } catch {
        // Falha silenciosa — não bloqueia a videochamada
      }
    };

    registerJoin();
  }, [appointmentId, apiCall]);

  // =============================
  // REGISTRO DE SAÍDA + CLEANUP
  // =============================
  useEffect(() => {
    return () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const url = `${apiUrl}/api/jitsi/session/${appointmentId}/left`;
        navigator.sendBeacon(url);
      } catch {}

      if (jitsiApiRef.current) {
        try { jitsiApiRef.current.dispose(); } catch {}
        jitsiApiRef.current = null;
      }
    };
  }, [appointmentId]);

  // =============================
  // BUSCAR URL DA SALA
  // =============================
  const fetchMeetUrl = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiCall<JitsiMeetUrlResponse>({
        url: `/api/jitsi/meet-url/${appointmentId}`,
      });

      if (!response?.meet_url) {
        throw new Error("URL da sala não encontrada. A sessão pode não ter sido iniciada.");
      }

      const url = response.meet_url;
      const room = response.room_name || extractRoomName(url);

      setMeetUrl(url);
      setRoomName(room);

      if (response.therapist_name) {
        setTherapistName(response.therapist_name);
        setTherapistNameForReview(response.therapist_name);
      }

      const name =
        userRole === "therapist"
          ? response.therapist_name
          : response.patient_name;

      setDisplayName(name || "Usuário");
    } catch (err: any) {
      setError(err.message || "Erro ao iniciar videochamada. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, userRole, apiCall]);

  useEffect(() => {
    fetchMeetUrl();
  }, [fetchMeetUrl, retryCount]);

  // =============================
  // INICIALIZAR JITSI
  // =============================
  useEffect(() => {
    if (!apiReady || !meetUrl || !roomName || !jitsiContainerRef.current) return;
    if (!window.JitsiMeetExternalAPI) return;

    if (jitsiApiRef.current) {
      try { jitsiApiRef.current.dispose(); } catch {}
      jitsiApiRef.current = null;
    }

    try {
      const isModerator = userRole === "therapist" || userRole === "admin";

      const options: any = {
        roomName,
        parentNode: jitsiContainerRef.current,
        width: "100%",
        height: "100%",

        userInfo: { displayName },

        configOverwrite: {
          prejoinPageEnabled: false,
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          defaultBackground: "#1a1a2e",
          toolbarConfig: { alwaysVisible: false },
          // ✅ Moderador definido pelo userRole — sem JWT
          startAsModerator: isModerator,
        },

        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          APP_NAME: "Meu Divã",
          NATIVE_APP_NAME: "Meu Divã",
          PROVIDER_NAME: "Meu Divã",
          DEFAULT_BACKGROUND: "#1a1a2e",
          TOOLBAR_BUTTONS: [
            "microphone", "camera", "closedcaptions", "desktop",
            "fullscreen", "fodeviceselection", "hangup", "chat",
            "raisehand", "videoquality", "filmstrip", "tileview", "help",
          ],
        },
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);

      // Remove overlay quando entrar na conferência
      jitsiApiRef.current.addEventListener("videoConferenceJoined", () => {
        setWaitingForHost(false);
        try {
          jitsiApiRef.current.executeCommand("displayName", displayName);
        } catch {}
      });

      // Detecta quando o usuário sai da sessão
      jitsiApiRef.current.addEventListener("videoConferenceLeft", () => {
        setAppointmentCompleted(true);
      });

      jitsiApiRef.current.addEventListener("readyToClose", () => {
        onClose();
      });

    } catch (err) {
      console.error("[Jitsi] Erro ao inicializar:", err);
      setError("Erro ao inicializar a videochamada. Tente novamente.");
    }
  }, [apiReady, meetUrl, roomName, displayName, userRole, onClose]);

  // =============================
  // VERIFICAR E ABRIR MODAL DE AVALIAÇÃO
  // =============================
  useEffect(() => {
    const checkAndOpenReviewModal = async () => {
      if (appointmentCompleted && userRole === "patient") {
        try {
          const checkResponse = await apiCall<{ has_review: boolean }>({
            url: `/api/reviews/appointment/${appointmentId}/check`,
          });
          if (!checkResponse?.has_review) {
            setShowReviewModal(true);
          }
        } catch (error) {
          console.error("Erro ao verificar avaliação:", error);
        }
      }
    };
    checkAndOpenReviewModal();
  }, [appointmentCompleted, appointmentId, userRole, apiCall]);

  const handleReviewSuccess = () => {
    console.log("✅ Avaliação enviada com sucesso!");
  };

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev);
  const handleRetry = () => { setRetryCount((c) => c + 1); setError(null); };

  // =============================
  // ESTADOS DE UI
  // =============================
  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-xl"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
      >
        <Loader2 className="w-10 h-10 animate-spin text-[#E03673]" />
        <p className="text-white mt-4 text-sm">Iniciando videochamada...</p>
        <p className="text-gray-400 mt-1 text-xs">Sessão #{appointmentId}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-gray-900 rounded-xl gap-4">
        <div className="text-center px-6">
          <p className="text-red-400 font-medium mb-2">⚠️ Erro na videochamada</p>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-[#E03673] text-white rounded-lg hover:bg-[#c02c5e] transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50" : "w-full h-full"}`}
        style={{ background: "#1a1a2e", minHeight: isFullscreen ? "100vh" : "500px" }}
      >
        {/* HEADER */}
        <div
          className="flex justify-between items-center px-4 py-2 flex-shrink-0"
          style={{ background: "linear-gradient(90deg, #E03673 0%, #2F80D3 100%)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-semibold">
              🎥 {userRole === "therapist" ? "Você é o moderador" : "Videochamada"}
            </span>
            <span className="text-white/70 text-xs">· {displayName}</span>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={toggleFullscreen}
              className="text-white/80 hover:text-white p-1 rounded transition-colors"
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-1 rounded transition-colors"
              title="Encerrar chamada"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ÁREA PRINCIPAL */}
        <div className="flex-1 relative" style={{ minHeight: "400px", overflow: "hidden" }}>

          {/* JITSI CONTAINER — sempre montado, invisível enquanto paciente aguarda */}
          <div
            ref={jitsiContainerRef}
            className="w-full h-full absolute inset-0"
            style={{
              minHeight: "400px",
              visibility: waitingForHost ? "hidden" : "visible",
              pointerEvents: waitingForHost ? "none" : "auto",
            }}
          />

          {/* OVERLAY — Paciente aguardando terapeuta */}
          {waitingForHost && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-10 px-6"
              style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}
            >
              <div className="mb-8 text-center">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 mx-auto"
                  style={{ background: "linear-gradient(135deg, #E03673 0%, #2F80D3 100%)" }}
                >
                  <span className="text-3xl">🛋️</span>
                </div>
                <h2 className="text-white text-xl font-bold">Meu Divã</h2>
                <p className="text-gray-400 text-xs mt-1">Cuidado que Acolhe</p>
              </div>

              <div className="text-center max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#E03673] animate-pulse" />
                  <span className="text-[#E03673] font-semibold text-sm">
                    Sua sessão começa em breve
                  </span>
                </div>
                <h3 className="text-white text-lg font-semibold mb-3">
                  A sua sessão ainda não começou
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {therapistName
                    ? `Aguarde o seu terapeuta, ${therapistName} — em breve o seu Divã Online estará disponível.`
                    : "Aguarde o seu terapeuta — em breve o seu Divã Online estará disponível."
                  }
                </p>
              </div>

              <div className="flex gap-2 mt-8">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: "#E03673",
                      animation: `pulse-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>

              <style>{`
                @keyframes pulse-dot {
                  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                  40% { transform: scale(1); opacity: 1; }
                }
              `}</style>

              <button
                onClick={onClose}
                className="mt-8 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
              >
                Sair da sala
              </button>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          className="px-4 py-1 text-center text-xs text-gray-500 flex-shrink-0"
          style={{ background: "#111827" }}
        >
          Sala: {roomName} · Meu Divã — Cuidado que Acolhe
        </div>
      </div>

      {/* MODAL DE AVALIAÇÃO */}
      {showReviewModal && (
        <ReviewModal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          appointmentId={appointmentId}
          therapistName={therapistNameForReview}
          onSuccess={handleReviewSuccess}
        />
      )}
    </>
  );
}