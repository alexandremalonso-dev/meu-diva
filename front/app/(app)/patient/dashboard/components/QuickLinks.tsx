import Link from 'next/link';
import { Calendar, ArrowRight } from 'lucide-react';

export function QuickLinks() {
  return (
    <div className="space-y-4">
      {/* 🔥 Calendário Completo - AZUL */}
      <Link
        href="/busca"
        className="block bg-gradient-to-br from-[#2F80D3] to-[#2F80D3]/80 text-white p-6 rounded-lg shadow hover:shadow-lg transition-all hover:scale-105"
      >
        <div className="flex items-center gap-3 mb-2">
          <Calendar className="w-5 h-5 text-white" />
          <h3 className="text-lg font-semibold">Consultar Mais Disponibilidades</h3>
        </div>
        <p className="text-white/80 pl-8">Buscar terapeutas e horários disponíveis</p>
        <div className="mt-4 text-sm opacity-90 flex items-center gap-2 pl-8">
          <span>Acessar busca</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </Link>
    </div>
  );
}