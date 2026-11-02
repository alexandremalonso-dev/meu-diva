"use client";
// asaas-garantia-componente: garantia de N dias do plano do terapeuta (N vem do servidor). Aparece em "Meu plano" só enquanto o reembolso é possível.

import { useEffect, useState } from "react";
import { ShieldCheck, Undo2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

type Garantia = {
  garantia_dias: number;
  elegivel: boolean;
  motivo?: string | null;
  valor?: number;
  dias_restantes?: number;
  expira_em?: string;
  reembolso?: { status: string; valor: number; pedido_em: string | null } | null;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso?: string) => {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

export function GarantiaReembolso() {
  const [g, setG] = useState<Garantia | null>(null);
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await api("/api/asaas/garantia", { silent: true } as any);
        if (ativo) setG(r as Garantia);
      } catch (_) {
        /* sem garantia para mostrar: a tela segue normal */
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const pedir = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r: any = await api("/api/asaas/garantia/reembolsar", { method: "POST", body: JSON.stringify({}) });
      setFeito(r?.mensagem || "Reembolso solicitado. A devolução aparece na fatura do seu cartão em alguns dias úteis.");
      setAberto(false);
      setTimeout(() => window.location.reload(), 4000);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível pedir o reembolso agora. Tente novamente em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  if (feito) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
        <p className="text-sm text-green-800">{feito}</p>
      </div>
    );
  }

  if (g?.reembolso) {
    const concluido = g.reembolso.status === "CONCLUIDO";
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex gap-3">
        <Undo2 className="w-5 h-5 text-[#E03673] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-gray-900">{concluido ? "Reembolso concluído" : "Reembolso solicitado"}</p>
          <p className="text-sm text-gray-600 mt-1">
            {brl(g.reembolso.valor)} {concluido ? "foram devolvidos" : "serão devolvidos"} ao seu cartão. A devolução aparece na fatura em alguns dias úteis.
          </p>
        </div>
      </div>
    );
  }

  if (!g || !g.elegivel) return null;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Garantia de {g.garantia_dias} dias</p>
              <p className="text-sm text-gray-600 mt-0.5">
                Seu dinheiro de volta sem perguntas: você pode pedir o reembolso de {brl(g.valor || 0)} até {dataBR(g.expira_em)}
                {typeof g.dias_restantes === "number" ? ` (${g.dias_restantes === 0 ? "último dia" : `${g.dias_restantes} dia${g.dias_restantes === 1 ? "" : "s"} restante${g.dias_restantes === 1 ? "" : "s"}`})` : ""}.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setErro(null); setAberto(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Undo2 className="w-4 h-4" />
            Pedir reembolso
          </button>
        </div>
      </div>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900">Confirmar reembolso</h3>
            <p className="text-sm text-gray-600 mt-2">
              Vamos devolver <strong>{brl(g.valor || 0)}</strong> ao seu cartão. Ao confirmar, a assinatura é <strong>cancelada agora</strong> e você volta ao plano Básico.
              A devolução aparece na fatura do cartão em alguns dias úteis. Esta garantia só pode ser usada uma vez.
            </p>
            {erro && (
              <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {erro}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setAberto(false)} disabled={enviando} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Voltar
              </button>
              <button onClick={pedir} disabled={enviando} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                Confirmar reembolso
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
