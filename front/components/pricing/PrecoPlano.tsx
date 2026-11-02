"use client";
// asaas-precos: preço de um plano lido do admin (nunca escrito na tela). Carregando: "R$ …". Sem resposta do servidor: "R$ —".

import { usePlanPrices, formatBRL, menorPrecoPago } from "@/lib/planPrices";

export function PrecoPlano({ plano, sufixo = "" }: { plano: string; sufixo?: string }) {
  const p = usePlanPrices();
  if (p === null) return <>R$ …</>;
  const v = p[plano.toLowerCase()];
  return <>{v ? `${formatBRL(v)}${sufixo}` : "R$ —"}</>;
}

/** "a partir de" = o menor preço entre os planos pagos cadastrados no admin */
export function PrecoAPartirDe({ sufixo = "" }: { sufixo?: string }) {
  const p = usePlanPrices();
  if (p === null) return <>R$ …</>;
  const v = menorPrecoPago(p);
  return <>{v ? `${formatBRL(v)}${sufixo}` : "R$ —"}</>;
}
