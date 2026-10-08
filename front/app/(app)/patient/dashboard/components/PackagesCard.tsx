"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ChevronRight, CalendarCheck } from "lucide-react";
import { api } from "@/lib/api";

interface PlanLite {
  chave: string;
  nome: string;
  preco_mensal: number;
  sessoes_mensais: number;
  descricao?: string | null;
}

interface MeData {
  subscription: { status: string; plano_nome: string; current_period_end: string | null } | null;
  sessions_remaining: number;
  next_expiry: string | null;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

// Card "Pacotes de sessões" do dashboard do paciente. Some sozinho se o paciente não tem acesso.
export function PackagesCard() {
  const [visible, setVisible] = useState(false);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [me, setMe] = useState<MeData | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg: any = await api("/api/patient/pacotes/config", { silent: true });
        if (!active || !cfg?.visible) return;
        const [p, m]: any[] = await Promise.all([
          api("/api/patient/pacotes/plans", { silent: true }),
          api("/api/patient/pacotes/me", { silent: true }),
        ]);
        if (!active) return;
        setPlans(Array.isArray(p?.plans) ? p.plans : []);
        setMe(m || null);
        setVisible(true);
      } catch {
        // sem acesso ou erro: o card simplesmente não aparece
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!visible) return null;

  const live = !!me?.subscription && ["authorized", "pending", "paused"].includes(me.subscription.status);
  const hasCredits = (me?.sessions_remaining || 0) > 0;

  if (live || hasCredits) {
    return (
      <div className="mt-3 bg-white rounded-lg shadow p-5 border border-[#E03673]/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E03673]/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-[#E03673]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Seu pacote{me?.subscription ? ` · ${me.subscription.plano_nome}` : ""}</p>
              <p className="text-lg font-semibold text-gray-900">
                {me?.sessions_remaining || 0} {(me?.sessions_remaining || 0) === 1 ? "sessão restante" : "sessões restantes"}
                {me?.next_expiry && <span className="text-sm font-normal text-gray-500"> · válidas até {fmt(me.next_expiry)}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/busca" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E03673] text-white text-sm font-medium hover:bg-[#c42d63] transition-colors">
              <CalendarCheck className="w-4 h-4" /> Agendar
            </Link>
            <Link href="/patient/pacotes" className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
              Gerenciar <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div className="mt-3 bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-[#E03673]" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pacotes de sessões</h2>
            <p className="text-xs text-gray-500">Contrate um pacote mensal de terapia online e organize seu cuidado com constância.</p>
          </div>
        </div>
        <Link href="/pacotes" className="text-sm text-[#E03673] font-medium hover:underline inline-flex items-center gap-1">
          Ver todos os pacotes <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p) => (
          <Link key={p.chave} href={`/pacote-checkout?plan=${p.chave}`} className="block rounded-xl border border-gray-200 p-4 hover:border-[#E03673] hover:shadow-sm transition-all">
            <p className="font-semibold text-gray-900">{p.nome}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {p.sessoes_mensais} {p.sessoes_mensais === 1 ? "sessão" : "sessões"} por mês
            </p>
            <p className="text-lg font-bold text-[#E03673] mt-2">
              {brl(p.preco_mensal)}
              <span className="text-xs font-normal text-gray-400">/mês</span>
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
