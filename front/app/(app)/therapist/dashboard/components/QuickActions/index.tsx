"use client";

import Link from "next/link";
import { Settings, Mail, Calendar, Users, ChevronRight } from "lucide-react";

interface QuickActionsProps {
  onAvailabilityClick: () => void;
  onInviteClick: () => void;
  showInviteForm: boolean;
}

export function QuickActions({ onAvailabilityClick, onInviteClick, showInviteForm }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <button
        onClick={onAvailabilityClick}
        className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left group"
      >
        <div className="flex items-start gap-3">
          <Settings className="w-6 h-6 text-white flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Gerenciar disponibilidade</h3>
            <p className="text-white/80">Defina seus horários de atendimento</p>
          </div>
        </div>
      </button>

      <button
        onClick={onInviteClick}
        className="bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow text-left group"
      >
        <div className="flex items-start gap-3">
          <Mail className="w-6 h-6 text-white flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Enviar convite</h3>
            <p className="text-white/80">Convide pacientes frequentes</p>
          </div>
        </div>
      </button>
      
      <Link
        href="/therapist/sessions/completed"
        className="block bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow group"
      >
        <div className="flex items-start gap-3">
          <Calendar className="w-6 h-6 text-white flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold mb-2">Sessões Realizadas</h3>
            <p className="text-white/80">Histórico completo das sessões</p>
          </div>
        </div>
      </Link>
    </div>
  );
}