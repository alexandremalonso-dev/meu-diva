"use client";
// asaas-precos-final: faixa do valor por sessão que o terapeuta recebe, lida dos planos ativos do admin. Sem resposta: não mostra nada.

import { useEffect, useState } from "react";
import { carregarRepasse, formatBRL } from "@/lib/planPrices";

export function RepasseFaixa() {
  const [r, setR] = useState<{ min: number; max: number } | null>(null);
  useEffect(() => {
    let ativo = true;
    carregarRepasse().then((v) => {
      if (ativo) setR(v);
    });
    return () => {
      ativo = false;
    };
  }, []);
  if (!r) return null;
  const texto = r.min === r.max ? formatBRL(r.min) : `de ${formatBRL(r.min)} a ${formatBRL(r.max)}`;
  return <>{`(hoje, ${texto} por sessão)`}</>;
}
