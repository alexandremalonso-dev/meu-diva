"use client";
// asaas-precos: LEITOR ÚNICO dos preços dos planos do terapeuta. A fonte é o admin (/admin/valor-terapeuta → tabela plan_prices), lida por GET /api/plans/.
// Nenhuma tela deve escrever preço no código: use usePlanPrices(), <PrecoPlano /> ou <PrecoAPartirDe />. Sem valor de reserva: se o servidor não responder, a tela mostra "—".

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type PlanPrices = Record<string, number>;

const TTL_MS = 60_000;
let cache: { em: number; v: PlanPrices } | null = null;
let pendente: Promise<PlanPrices> | null = null;

export const formatBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalizar(r: any): PlanPrices {
  const lista: any[] = Array.isArray(r) ? r : r?.plans || r?.data || [];
  const m: PlanPrices = {};
  for (const p of lista) {
    const k = String(p?.id ?? p?.plan ?? p?.key ?? "").toLowerCase();
    const v = Number(p?.price_brl ?? p?.price);
    if (k && Number.isFinite(v) && v > 0) m[k] = v;
  }
  return m;
}

export function carregarPrecos(): Promise<PlanPrices> {
  if (cache && Date.now() - cache.em < TTL_MS) return Promise.resolve(cache.v);
  if (!pendente) {
    pendente = api("/api/plans/", { silent: true } as any)
      .then((r: any) => {
        const v = normalizar(r);
        if (Object.keys(v).length > 0) cache = { em: Date.now(), v };
        return v;
      })
      .catch(() => ({} as PlanPrices))
      .finally(() => {
        pendente = null;
      });
  }
  return pendente;
}

/** null = carregando; {} = o servidor não respondeu; senão um mapa { plano: valor } */
export function usePlanPrices(): PlanPrices | null {
  const [p, setP] = useState<PlanPrices | null>(cache ? cache.v : null);
  useEffect(() => {
    let ativo = true;
    carregarPrecos().then((r) => {
      if (ativo) setP(r);
    });
    return () => {
      ativo = false;
    };
  }, []);
  return p;
}

export function menorPrecoPago(p: PlanPrices | null): number | null {
  if (!p) return null;
  const v = Object.values(p).filter((x) => x > 0);
  return v.length ? Math.min(...v) : null;
}

// asaas-precos-final: planos de EMPRESA e faixa de repasse lidos do admin pelo servidor (so para quem tem acesso). Nenhum valor escrito aqui.
export type PlanoEmpresa = { chave: string; nome: string; preco_mensal_por_colaborador: number; sessoes_inclusas_por_colaborador: number };

export async function carregarPlanosEmpresa(): Promise<PlanoEmpresa[]> {
  try {
    const r: any = await api("/api/plans/empresa", { silent: true } as any);
    const lista: any[] = Array.isArray(r) ? r : r?.plans || [];
    return lista
      .map((p) => ({
        chave: String(p?.chave || ""),
        nome: String(p?.nome || p?.chave || ""),
        preco_mensal_por_colaborador: Number(p?.preco_mensal_por_colaborador) || 0,
        sessoes_inclusas_por_colaborador: Number(p?.sessoes_inclusas_por_colaborador) || 0,
      }))
      .filter((p) => p.chave);
  } catch (_) {
    return [];
  }
}

export async function carregarRepasse(): Promise<{ min: number; max: number } | null> {
  try {
    const r: any = await api("/api/plans/repasse", { silent: true } as any);
    const min = Number(r?.min);
    const max = Number(r?.max);
    return Number.isFinite(min) && Number.isFinite(max) && r?.min !== null && r?.max !== null ? { min, max } : null;
  } catch (_) {
    return null;
  }
}
