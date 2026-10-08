"use client";

import Link from "next/link";
import { Settings, Mail, Calendar } from "lucide-react";

interface QuickActionsProps {
  onAvailabilityClick: () => void;
  onInviteClick: () => void;
  showInviteForm: boolean;
}

export function QuickActions({ onAvailabilityClick, onInviteClick, showInviteForm }: QuickActionsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={onAvailabilityClick}
        className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white px-3 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all text-left flex items-center gap-2.5"
      >
        <Settings className="w-4 h-4 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-fluid-xs font-semibold leading-tight truncate">Gerenciar disponibilidade</p>
          <p className="text-fluid-2xs text-white/70 truncate">Defina seus horários</p>
        </div>
      </button>

      <button
        onClick={onInviteClick}
        className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white px-3 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all text-left flex items-center gap-2.5"
      >
        <Mail className="w-4 h-4 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-fluid-xs font-semibold leading-tight truncate">Enviar convite</p>
          <p className="text-fluid-2xs text-white/70 truncate">Convide pacientes frequentes</p>
        </div>
      </button>

      <Link
        href="/therapist/sessions/completed"
        className="block bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white px-3 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center gap-2.5"
      >
        <Calendar className="w-4 h-4 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-fluid-xs font-semibold leading-tight truncate">Sessões Realizadas</p>
          <p className="text-fluid-2xs text-white/70 truncate">Histórico completo</p>
        </div>
      </Link>
    </div>
  );
}
