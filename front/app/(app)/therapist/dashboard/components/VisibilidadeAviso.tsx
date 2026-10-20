// AVISO-VISIBILIDADE v1: popup que mostra ao terapeuta, ao entrar no painel, o que falta no perfil para aparecer melhor na busca
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, X, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";

type Acao = { rotulo: string; caminho: string };
type Motivo = { codigo: string; titulo: string; texto: string; acao?: Acao | null };
type Dados = { plano: string; plano_nome: string; introducao: string; motivos: Motivo[] };

// Uma vez por sessão do navegador: depois de fechar (ou de seguir um botão), não reaparece ao voltar ao painel.
const CHAVE = "aviso_visibilidade_visto";

export function VisibilidadeAviso() {
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CHAVE)) return;
    } catch {}
    let vivo = true;
    api("/api/therapists/me/visibilidade", { silent: true })
      .then((d: Dados) => {
        // só aparece se houver algo a corrigir
        if (vivo && d && Array.isArray(d.motivos) && d.motivos.length > 0) setDados(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const fechar = () => {
    try {
      sessionStorage.setItem(CHAVE, "1");
    } catch {}
    setDados(null);
  };

  useEffect(() => {
    if (!dados) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [dados]);

  if (!dados) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={fechar}
      role="dialog"
      aria-modal="true"
      aria-label="Como seu perfil aparece na busca"
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-800">
            <span className="p-1.5 rounded-full bg-[#E03673]/10">
              <Eye className="w-5 h-5 text-[#E03673]" />
            </span>
            Como seu perfil aparece na busca
          </h3>
          <button onClick={fechar} aria-label="Fechar" className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <p className="text-sm text-gray-600">{dados.introducao}</p>
          {dados.motivos.map((m) => (
            <div key={m.codigo} className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">{m.titulo}</p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">{m.texto}</p>
              {m.acao && (
                <Link
                  href={m.acao.caminho}
                  onClick={fechar}
                  className="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-[#E03673] text-white text-sm font-medium hover:opacity-90"
                >
                  {m.acao.rotulo}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button onClick={fechar} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
