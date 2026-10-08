"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Package, Loader2, AlertCircle, CheckCircle, ArrowRight, Calendar,
  CalendarCheck, XCircle, Info, Ticket,
} from "lucide-react";

interface Lot {
  id: number;
  plano_nome: string;
  sessions_total: number;
  used: number;
  remaining: number;
  valid_until: string;
}

interface Me {
  visible: boolean;
  subscription: {
    status: string;
    plano_chave: string;
    plano_nome: string;
    preco_mensal: number;
    sessoes_mensais: number;
    current_period_end: string | null;
    can_cancel: boolean;
  } | null;
  lots: Lot[];
  sessions_remaining: number;
  next_expiry: string | null;
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  authorized: { label: "Ativo", color: "text-green-700", bg: "bg-green-100" },
  pending: { label: "Em análise", color: "text-yellow-700", bg: "bg-yellow-100" },
  paused: { label: "Pausado", color: "text-yellow-700", bg: "bg-yellow-100" },
  cancelled: { label: "Cancelado", color: "text-red-700", bg: "bg-red-100" },
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function PatientPacotesPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function load() {
    try {
      const data: any = await api("/api/patient/pacotes/me");
      if (!data?.visible) {
        router.replace("/patient/dashboard");
        return;
      }
      setMe(data);
    } catch {
      setError("Não foi possível carregar seus pacotes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function doCancel() {
    setConfirmCancel(false);
    setCancelling(true);
    setError("");
    try {
      const r: any = await api("/api/patient/pacotes/cancel", { method: "POST" });
      setSuccess(r?.message || "Pacote cancelado.");
      await load();
    } catch (e: any) {
      setError(e?.message || "Não foi possível cancelar agora.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 flex justify-center">
        <Loader2 className="w-8 h-8 text-[#E03673] animate-spin" />
      </div>
    );
  }

  const sub = me?.subscription || null;
  const st = sub ? STATUS[sub.status] || { label: sub.status, color: "text-gray-700", bg: "bg-gray-100" } : null;
  const lots = me?.lots || [];

  return (
    <>
      <ConfirmDialog
        open={confirmCancel}
        variant="danger"
        title="Cancelar pacote"
        message={`Cancelar o pacote? Não haverá novas cobranças.${me?.next_expiry ? ` As sessões já pagas continuam valendo até ${fmt(me.next_expiry)}.` : ""}`}
        confirmLabel="Cancelar pacote"
        cancelLabel="Voltar"
        loading={cancelling}
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meus pacotes</h1>
            <p className="text-sm text-gray-500 mt-1">Acompanhe suas sessões e gerencie sua assinatura</p>
          </div>
          <Link href="/patient/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />{success}
          </div>
        )}

        {!sub && lots.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#E03673]/10 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-[#E03673]" />
            </div>
            <p className="font-semibold text-gray-900">Você ainda não tem um pacote</p>
            <p className="text-sm text-gray-500 mt-1 mb-4">Contrate um pacote mensal de sessões de terapia online.</p>
            <Link href="/pacotes" className="inline-block px-5 py-2.5 rounded-xl bg-[#E03673] text-white text-sm font-semibold hover:bg-[#c42d63] transition-colors">
              Ver pacotes
            </Link>
          </div>
        )}

        {sub && st && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#E03673] to-pink-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Pacote atual</p>
                    <h2 className="text-2xl font-bold">{sub.plano_nome}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                  <p className="text-white/80 text-sm mt-2">{brl(sub.preco_mensal)}/mês</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Ticket className="w-3 h-3" /> Sessões restantes</p>
                  <p className="text-2xl font-bold text-gray-900">{me?.sessions_remaining || 0}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Sessões por mês</p>
                  <p className="text-2xl font-bold text-gray-900">{sub.sessoes_mensais}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {sub.can_cancel ? "Próxima cobrança" : "Encerrado"}</p>
                  <p className="text-lg font-semibold text-gray-900">{sub.can_cancel ? fmt(sub.current_period_end) : "—"}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <Link href="/busca" className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#E03673] text-white font-medium hover:bg-[#c42d63] transition-colors">
                  <CalendarCheck className="w-4 h-4" /> Agendar sessão
                </Link>
                {sub.can_cancel && (
                  <button
                    onClick={() => setConfirmCancel(true)}
                    disabled={cancelling}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Cancelar pacote
                  </button>
                )}
                {!sub.can_cancel && (
                  <Link href="/pacotes" className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Contratar novo pacote
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {lots.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Suas sessões</h3>
            <div className="space-y-2">
              {lots.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{l.plano_nome}</p>
                    <p className="text-xs text-gray-500">Válidas até {fmt(l.valid_until)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{l.remaining} de {l.sessions_total}</p>
                    <p className="text-xs text-gray-500">{l.used} {l.used === 1 ? "usada" : "usadas"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-xs text-blue-900">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>As sessões contratadas valem dentro do mês vigente. As que não forem usadas expiram ao fim desse período.</p>
            <p>Os pacotes valem com os terapeutas que participam deste formato.</p>
          </div>
        </div>
      </div>
    </>
  );
}
