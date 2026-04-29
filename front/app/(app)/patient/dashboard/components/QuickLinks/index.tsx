"use client";

import Link from "next/link";
import { Calendar, Wallet, ArrowRight } from "lucide-react";

export function QuickLinks() {
  return (
    <div className="space-y-4">
      {/* Card Calendário - AZUL */}
      <Link
        href="/busca"
        className="block bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
      >
        <div className="flex items-start gap-3">
          <Calendar className="w-6 h-6 text-white flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Calendário Completo</h3>
            <p className="text-white/80 text-sm">Buscar terapeutas e horários disponíveis</p>
            <div className="mt-3 text-sm text-white/90 flex items-center gap-1">
              <span>Acessar busca</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>

      {/* Card Carteira - AZUL */}
      <Link
        href="/patient/wallet"
        className="block bg-gradient-to-r from-[#2F80D3] to-[#2F80D3]/80 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-shadow"
      >
        <div className="flex items-start gap-3">
          <Wallet className="w-6 h-6 text-white flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Minha Carteira</h3>
            <p className="text-white/80 text-sm">Ver saldo e extrato</p>
            <div className="mt-3 text-sm text-white/90 flex items-center gap-1">
              <span>Acessar carteira</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}