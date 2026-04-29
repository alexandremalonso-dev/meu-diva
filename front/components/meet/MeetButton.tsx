"use client";

import { useState } from "react";
import { Video, Loader2 } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { JitsiMeetingRoom } from "@/components/meet/JitsiMeetingRoom";

interface MeetButtonProps {
  appointmentId: number;
  userRole: "patient" | "therapist" | "admin";
  meetLink?: string | null;
  onMeetLinkGenerated?: (link: string) => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MeetButton({
  appointmentId,
  userRole,
  meetLink,
  onMeetLinkGenerated,
  variant = "primary",
  size = "md",
  className = "",
}: MeetButtonProps) {
  const { execute: apiCall } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJitsi, setShowJitsi] = useState(false);

  const handleClick = async () => {
    // Se já tem link ou é paciente — abre direto o embed
    if (meetLink || userRole === "patient") {
      setShowJitsi(true);
      return;
    }

    // Terapeuta/Admin sem link — gera primeiro
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall({
        url: `/api/jitsi/generate/${appointmentId}`,
        method: "POST",
      }) as any;

      if (response?.meet_url) {
        onMeetLinkGenerated?.(response.meet_url);
      }
      setShowJitsi(true);
    } catch (err: any) {
      setError(err.message || "Erro ao gerar link da videochamada");
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const variantClasses = {
    primary: "bg-[#10B981] hover:bg-[#059669] text-white",
    secondary: "bg-[#E03673] hover:bg-[#c02c5e] text-white",
    outline: "border border-[#10B981] text-[#10B981] hover:bg-[#10B981] hover:text-white",
  };

  return (
    <>
      <div className="inline-flex flex-col">
        <button
          onClick={handleClick}
          disabled={loading}
          className={`
            inline-flex items-center gap-2 rounded-lg font-medium transition-all
            ${sizeClasses[size]}
            ${variantClasses[variant]}
            ${loading ? "opacity-50 cursor-not-allowed" : ""}
            ${className}
          `}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Video className="w-4 h-4" />
          )}
          {meetLink ? "Iniciar Videochamada" : "Gerar Link da Sessão"}
        </button>
        {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
      </div>

      {/* ✅ Embed Jitsi em modal fullscreen */}
      {showJitsi && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl h-[80vh] rounded-xl overflow-hidden shadow-2xl">
            <JitsiMeetingRoom
              appointmentId={appointmentId}
              userRole={userRole}
              onClose={() => setShowJitsi(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}