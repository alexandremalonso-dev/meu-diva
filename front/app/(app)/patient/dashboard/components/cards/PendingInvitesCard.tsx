"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { getFotoSrc } from '@/lib/utils';

interface Invite {
  id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  therapist?: {
    full_name: string;
    email: string;
    foto_url?: string;
    session_price?: number;
  };
  duration_minutes?: number;
}

export function PendingInvitesCard() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadInvites(); }, []);

  const loadInvites = async () => {
    try {
      const data = await api("/api/invites/me");
      setInvites(Array.isArray(data) ? data.filter((i: any) => i.status === "proposed") : []);
    } catch (err) {
      console.error("Erro ao carregar convites:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR") + " às " + date.toLocaleTimeString("pt-BR").slice(0, 5);
  };

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-3">Convites Pendentes</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {invites.map((invite) => {
          const therapistName = invite.therapist?.full_name || `Terapeuta #${invite.therapist_user_id}`;
          const fotoUrl = getFotoUrl(invite.therapist?.foto_url);
          const sessionPrice = invite.therapist?.session_price || 200;
          const dateStr = formatDate(invite.starts_at);

          return (
            <div
              key={invite.id}
              onClick={() => router.push('/patient/invites')}
              className="bg-gradient-to-br from-[#E03673] to-[#E03673]/80 text-white rounded-lg shadow p-3 sm:p-4 hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
            >
              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-full overflow-hidden bg-white/20 flex items-center justify-center text-white font-bold text-base sm:text-lg">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt={therapistName} className="h-full w-full object-cover" />
                  ) : (
                    <span>{therapistName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white text-xs sm:text-sm leading-tight truncate">{therapistName}</p>
                  <p className="text-[10px] sm:text-xs text-white/80 truncate">{dateStr}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-2 sm:mb-3">
                <div>
                  <p className="text-[10px] sm:text-xs text-white/80">Valor</p>
                  <p className="font-medium text-white text-xs sm:text-sm">R$ {sessionPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs text-white/80">Duração</p>
                  <p className="font-medium text-white text-xs sm:text-sm">{invite.duration_minutes || 50} min</p>
                </div>
              </div>

              <div className="flex gap-2">
                <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-white/20 text-white">
                  ⏳ Aguardando
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}