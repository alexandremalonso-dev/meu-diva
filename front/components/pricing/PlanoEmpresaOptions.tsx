"use client";
// asaas-precos: opções de plano de EMPRESA lidas do admin (/admin/valor-empresa → empresa_planos). Uso dentro de <select>. Nada de preço escrito na tela.

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatBRL } from "@/lib/planPrices";

type PlanoEmpresa = { chave: string; nome: string; preco_mensal_por_colaborador?: number };

export function PlanoEmpresaOptions() {
  const [planos, setPlanos] = useState<PlanoEmpresa[] | null>(null);
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r: any = await api("/api/admin/empresas/planos?apenas_ativos=true", { silent: true } as any);
        if (ativo) setPlanos(Array.isArray(r) ? r : []);
      } catch (_) {
        if (ativo) setPlanos([]);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);
  if (planos === null) return <option disabled>Carregando planos…</option>;
  if (planos.length === 0) return <option disabled>Nenhum plano disponível</option>;
  return (
    <>
      {planos.map((p) => (
        <option key={p.chave} value={p.chave}>
          {p.nome}
          {typeof p.preco_mensal_por_colaborador === "number" ? ` (${formatBRL(p.preco_mensal_por_colaborador)}/colaborador)` : ""}
        </option>
      ))}
    </>
  );
}
