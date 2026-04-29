"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";
import type { Appointment } from '../../types';
import { Calendar, User, CheckCircle, AlertCircle, Video, Copy, MessageSquare } from "lucide-react";
import { ComplaintModal } from "@/components/Modals/ComplaintModal";
import { getFotoSrc } from '@/lib/utils';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UpcomingSessionCardProps {
  session: Appointment;
  onClick: (session: Appointment) => void;
  formatDate: (date: string) => string;
  getStatusText: (status: string) => string;
  onJoinMeet?: (appointment: Appointment) => void;
  onComplaintSuccess?: () => void;
}

export function UpcomingSessionCard({ 
  session, 
  onClick, 
  formatDate, 
  getStatusText,
  onJoinMeet,
  onComplaintSuccess
}: UpcomingSessionCardProps) {
  
  const router = useRouter();
  const { openQueixa } = useSidebar();
  const [copied, setCopied] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);

  const getBadgeStyle = (status: string) => {
    if (status === 'confirmed') return 'bg-[#2F80D3] text-white font-bold';
    if (status === 'rescheduled') return 'bg-green-600 text-white font-bold';
    if (status === 'scheduled') return 'bg-[#2F80D3] text-white font-bold';
    if (status === 'proposed') return 'bg-[#2F80D3] text-white font-bold';
    return 'bg-white/20 text-white font-bold';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'confirmed') return <CheckCircle className="w-3 h-3 mr-1" />;
    if (status === 'proposed') return <AlertCircle className="w-3 h-3 mr-1" />;
    return null;
  };

  const handleStartSession = () => {
    if (session.id) router.push(`/patient/videochamada/${session.id}`);
    if (session.id) openQueixa(session.id);
  };

  const handleCopyLink = () => {
    if (session.video_call_url) {
      navigator.clipboard.writeText(session.video_call_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const therapist = session.therapist;
  const therapistName = therapist?.full_name || `Terapeuta ${session.therapist_user_id}`;
  const fotoUrl = therapist?.foto_url ? getFotoSrc(therapist.foto_url) ?? "" : null;
  const isConfirmed = session.status === 'confirmed' || session.status === 'scheduled';
  const hasMeetLink = !!session.video_call_url;

  return (
    <>
      <div className="w-full bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white p-3 rounded-lg shadow-sm hover:shadow-md transition-all">
        <button onClick={() => onClick(session)} className="w-full text-left">
          {/* Foto + Nome + Status na mesma linha */}
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 h-8 w-8 rounded-full overflow-hidden bg-white/20 flex items-center justify-center">
              {fotoUrl ? (
                <img src={fotoUrl} alt={therapistName} className="h-full w-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-white/80" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm truncate">{therapistName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3 h-3 text-white/70 flex-shrink-0" />
                <p className="text-xs text-white/90 truncate">{formatDate(session.starts_at)}</p>
              </div>
            </div>
            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${getBadgeStyle(session.status)}`}>
              {getStatusIcon(session.status)}
              {getStatusText(session.status)}
            </div>
          </div>
        </button>

        {/* Botões lado a lado */}
        {isConfirmed && (
          <div className="mt-2 pt-2 border-t border-white/20">
            <div className="flex gap-2">
              <button
                onClick={handleStartSession}
                className="flex-1 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#10B981] text-white py-1.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                Iniciar Sessão
              </button>
              <button
                onClick={() => setShowComplaintModal(true)}
                className="flex-1 bg-gradient-to-r from-[#E03673] to-[#E03673]/80 hover:from-[#c02c5e] hover:to-[#E03673] text-white py-1.5 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Registrar Queixa
              </button>
            </div>

            {hasMeetLink && (
              <div className="mt-2 p-2 bg-white/10 rounded-lg border border-white/20">
                <div className="flex items-center gap-2">
                  <code className="text-xs text-white bg-black/20 p-1.5 rounded flex-1 truncate font-mono">
                    {session.video_call_url}
                  </code>
                  <button onClick={handleCopyLink} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                {copied && <p className="text-xs text-green-300 mt-1 text-center">✅ Link copiado!</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <ComplaintModal
        show={showComplaintModal}
        appointmentId={session.id}
        therapistName={therapistName}
        sessionDate={formatDate(session.starts_at)}
        onClose={() => setShowComplaintModal(false)}
        onSuccess={() => {
          setShowComplaintModal(false);
          onComplaintSuccess?.();
        }}
      />
    </>
  );
}