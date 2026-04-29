"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { JitsiMeetingRoom } from "@/components/meet/JitsiMeetingRoom";
import { ArrowLeft } from "lucide-react";

export default function PatientVideochamadaPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const appointmentId = parseInt(params.appointmentId as string);

  const handleClose = () => {
    router.push("/patient/sessions/upcoming");
  };

  if (!user || user.role !== "patient") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Acesso negado. Apenas pacientes.</p>
      </div>
    );
  }

  if (isNaN(appointmentId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">ID da sessão inválido</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header com navegação */}
      <div className="flex items-center gap-4 p-4 bg-gray-800 border-b border-gray-700">
        <button
          onClick={handleClose}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Voltar para sessões</span>
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-white font-semibold">Sessão #{appointmentId}</h1>
          <p className="text-gray-400 text-sm">Você é participante</p>
        </div>
      </div>

      {/* Sala Jitsi */}
      <div className="flex-1 p-4">
        <JitsiMeetingRoom
          appointmentId={appointmentId}
          userRole="patient"
          onClose={handleClose}
        />
      </div>
    </div>
  );
}