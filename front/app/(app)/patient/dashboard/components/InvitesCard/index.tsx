"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Mail, Calendar, User, ChevronRight, AlertCircle } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Invite = {
  id: number;
  therapist_user_id: number;
  starts_at: string;
  ends_at: string;
  status: string;
  therapist?: {
    full_name: string;
    email: string;
    foto_url?: string;
  };
};

export function InvitesCard() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      const data = await api("/api/invites/me");
      console.log("📨 Convites recebidos:", data);
      const pending = Array.isArray(data) ? data.filter((i: any) => i.status === "proposed") : [];
      setInvites(pending);
      setError(false);
    } catch (error) {
      console.error("Erro ao carregar convites:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  const recentInvites = invites.slice(0, 3);
  const pendingCount = invites.length;

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-6 bg-white/30 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-white/30 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-white/30 rounded w-2/3"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-r from-[#E03673] to-[#E03673]/80 rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-white" />
          <h3 className="text-lg font-semibold text-white">Convites recebidos</h3>
        </div>
        <p className="text-sm text-white/80">Erro ao carregar convites</p>
        <button
          onClick={loadInvites}
          className="mt-2 text-sm text-white hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/patient/invites"
      className="block bg-gradient-to-r from-[#E03673] to-[#E03673]/80 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-white" />
          <h3 className="text-lg font-semibold">Convites recebidos</h3>
        </div>
        {pendingCount > 0 && (
          <span className="bg-white text-[#E03673] text-xs font-bold px-2 py-1 rounded-full">
            {pendingCount}
          </span>
        )}
      </div>

      <p className="text-white/80 text-sm mb-4">
        Convites de terapeutas aguardando sua resposta
      </p>

      {pendingCount > 0 ? (
        <div className="space-y-3 mb-4">
          {recentInvites.map((invite) => {
            const date = new Date(invite.starts_at);
            const formattedDate = date.toLocaleDateString('pt-BR');
            const formattedTime = date.toLocaleTimeString('pt-BR').slice(0,5);
            const therapistName = invite.therapist?.full_name || `Terapeuta #${invite.therapist_user_id}`;
            const fotoUrl = getFotoUrl(invite.therapist?.foto_url);

            return (
              <div key={invite.id} className="bg-white/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {/* 🔥 FOTO DO TERAPEUTA */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden bg-white/30 flex items-center justify-center">
                    {fotoUrl ? (
                      <img 
                        src={fotoUrl} 
                        alt={therapistName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="w-3 h-3 text-white/80" />
                    )}
                  </div>
                  <p className="text-sm font-medium truncate text-white">
                    {therapistName}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-8">
                  <Calendar className="w-3 h-3 text-white/70" />
                  <p className="text-xs text-white/70">
                    {formattedDate} às {formattedTime}
                  </p>
                </div>
              </div>
            );
          })}

          {invites.length > 3 && (
            <p className="text-xs text-white/70 text-center">
              + {invites.length - 3} {invites.length - 3 === 1 ? 'outro' : 'outros'}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-white/80 mb-4 text-center">
          Nenhum convite pendente
        </p>
      )}

      <div className="mt-2 text-sm text-white/90 flex items-center justify-end gap-1">
        <span>Gerenciar convites</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </Link>
  );
}