"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Mail, RefreshCw, XCircle, ChevronDown, ChevronUp, Loader2, User } from "lucide-react";
import { getFotoSrc } from '@/lib/utils';

// 🔥 CONSTANTE BACKEND_URL PARA FOTOS
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 🔥 PALETA DE CORES DO PROJETO
const CORES = {
  azul: "#2F80D3",
  rosa: "#E03673",
  rosaClaro: "#FCE4EC",
  rosaEscuro: "#c02c5e",
  cinzaClaro: "#F9F5FF",
  cinza: "#F3F4F6",
  cinzaTexto: "#374151",
  cinzaBorda: "#E5E7EB",
  branco: "#FFFFFF",
  verde: "#10B981",
  vermelho: "#EF4444",
};

type Invite = {
  id: number;
  patient_user_id: number;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: string;
  created_at: string;
  patient_name?: string;
  patient_email?: string;
  patient_foto_url?: string;
};

interface InvitesListProps {
  onInviteCancel?: () => void;
}

export function InvitesList({ onInviteCancel }: InvitesListProps) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      const data = await api("/api/invites/me");
      console.log("📨 Convites carregados:", data);
      setInvites(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar convites:", error);
    } finally {
      setLoading(false);
    }
  }

  const getFotoUrl = (fotoUrl?: string) => {
    if (!fotoUrl) return null;
    return fotoUrl.startsWith('http') ? fotoUrl : getFotoSrc(fotoUrl) ?? "";
  };

  async function handleCancelInvite(inviteId: number) {
    setActionLoading(prev => ({ ...prev, [inviteId]: true }));
    try {
      const response = await fetch(`/api/appointments/${inviteId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled_by_therapist" })
      });

      if (!response.ok) throw new Error("Erro ao cancelar convite");
      
      await loadInvites();
      onInviteCancel?.();
      
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setActionLoading(prev => ({ ...prev, [inviteId]: false }));
    }
  }

  if (loading) return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-[#E03673] animate-spin" />
        <span className="ml-2 text-gray-500">Carregando convites...</span>
      </div>
    </div>
  );

  if (invites.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#E03673]" />
          Convites enviados
          <span className="ml-2 text-sm bg-[#E03673]/10 text-[#E03673] px-2 py-1 rounded-full">
            {invites.length} pendente{invites.length !== 1 ? 's' : ''}
          </span>
        </h2>
        <button
          onClick={loadInvites}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3">
        {invites.map((invite) => {
          const date = new Date(invite.starts_at);
          const formattedDate = date.toLocaleDateString('pt-BR');
          const formattedTime = date.toLocaleTimeString('pt-BR').slice(0,5);
          const isExpanded = expandedId === invite.id;
          const patientName = invite.patient_name || invite.patient_email || `Paciente ${invite.patient_user_id}`;
          const fotoUrl = getFotoUrl(invite.patient_foto_url);
          
          return (
            <div key={invite.id} className="border-l-4 border-[#E03673] bg-[#FCE4EC] p-4 rounded-r-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {/* 🔥 FOTO DO PACIENTE */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden bg-[#E03673]/20 flex items-center justify-center">
                      {fotoUrl ? (
                        <img 
                          src={fotoUrl} 
                          alt={patientName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="w-4 h-4 text-[#E03673]" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">
                        {patientName}
                      </p>
                      <span className="bg-[#E03673]/20 text-[#E03673] text-xs px-2 py-1 rounded-full">
                        ⏳ Pendente
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 ml-11">
                    📅 {formattedDate} às {formattedTime} ({invite.duration_minutes} min)
                  </p>
                  
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#E03673]/20 ml-11">
                      <p className="text-xs text-gray-500 mb-2">
                        Convite enviado em {new Date(invite.created_at).toLocaleDateString('pt-BR')}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancelInvite(invite.id)}
                          disabled={actionLoading[invite.id]}
                          className="text-xs bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                        >
                          {actionLoading[invite.id] ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <XCircle className="w-3 h-3" />
                          )}
                          {actionLoading[invite.id] ? "Cancelando..." : "Cancelar convite"}
                        </button>
                        <button
                          className="text-xs bg-[#2F80D3] text-white px-3 py-1 rounded hover:bg-[#2F80D3]/80 transition-colors"
                        >
                          Reagendar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => setExpandedId(isExpanded ? null : invite.id)}
                  className="text-gray-400 hover:text-[#E03673] transition-colors"
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}